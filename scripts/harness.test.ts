// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * The check scripts' output contract, held in place by tests (scripts/README.md):
 * one line on success, non-zero with a short failing block on failure, and
 * distinct exit codes per stage so a caller can branch without parsing text.
 *
 * Nothing here touches the network: the failure path points smoke.sh at a
 * closed local port, which fails the same way an unreachable deploy does.
 */

const REPO = fileURLToPath(new URL('..', import.meta.url));
const CHECKS = mkdtempSync(join(tmpdir(), 'kata-checks-'));

afterAll(() => {
  rmSync(CHECKS, { recursive: true, force: true });
});

function run(command: string, args: string[], env: Record<string, string> = {}) {
  const result = spawnSync(command, args, {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, KATA_CHECKS_DIR: CHECKS, ...env },
  });
  const stdout = result.stdout ?? '';
  return {
    status: result.status,
    stdout,
    lines: stdout.trim().split('\n'),
  };
}

const FIXTURES = 'scripts/fixtures';
const FIXTURE_SCHEMA = `${FIXTURES}/module-index.fixture.schema.json`;
const validate = (...args: string[]) => run('node', ['scripts/validate-content.mjs', ...args]);

describe('validate-content.mjs', () => {
  it('prints one line and exits 0 for valid content', () => {
    const result = validate(FIXTURE_SCHEMA, `${FIXTURES}/valid`);

    expect(result.status).toBe(0);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toContain('CONTENT ok (2 files)');
  });

  it('exits 3 naming every offending file', () => {
    const result = validate(FIXTURE_SCHEMA, `${FIXTURES}/invalid`);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('missing-title.json');
    expect(result.stdout).toContain("must have required property 'title'");
    expect(result.stdout).toContain('stray-field.json');
    expect(result.stdout).toContain('must NOT have additional properties (streak)');
    expect(result.stdout).toContain('log: ');
  });

  it('exits 2 on a wrong number of arguments', () => {
    expect(validate(FIXTURE_SCHEMA).status).toBe(2);
  });

  it('exits 4 when a named path does not exist', () => {
    const result = validate(FIXTURE_SCHEMA, `${FIXTURES}/nowhere`);

    expect(result.status).toBe(4);
    expect(result.stdout).toContain('missing path');
  });

  it('validates the repo layout in one line (#7 shipped the schemas and index)', () => {
    const result = validate();

    expect(result.status).toBe(0);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toContain('CONTENT ok');
  });
});

/**
 * The shipping content schema + Module index (#7): the index must validate,
 * the schema must reject a module entry missing its required fields, and the
 * Curriculum order/titles must match docs/design.md § Curriculum verbatim.
 */
describe('content schema + Module index (#7)', () => {
  const INDEX_SCHEMA = 'schemas/module-index.schema.json';

  it('rejects a module entry missing ordinal, title, or description', () => {
    const result = validate(INDEX_SCHEMA, `${FIXTURES}/invalid-index`);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('missing-fields.json');
    for (const field of ['ordinal', 'title', 'description']) {
      expect(result.stdout).toContain(`must have required property '${field}'`);
    }
  });

  it('lists all five Modules, in Curriculum order, titles verbatim, all five authored', () => {
    const index = JSON.parse(
      readFileSync(join(REPO, 'public/content/index.json'), 'utf8'),
    ) as {
      schemaVersion: number;
      modules: { id: string; ordinal: number; title: string; pending: boolean }[];
    };

    // docs/design.md § Curriculum — fixed order, foundations-down.
    expect(index.modules.map((m) => m.title)).toEqual([
      'Deep Modules & Information Hiding',
      'Dependency Direction',
      'Testing at Boundaries + TDD loop',
      'Naming & Ubiquitous Language',
      'Error Design',
    ]);
    expect(index.modules.map((m) => m.ordinal)).toEqual([1, 2, 3, 4, 5]);
    expect(index.modules.map((m) => m.id)).toEqual(['m01', 'm02', 'm03', 'm04', 'm05']);
    // A Module is pending until its content pack is authored: #8 shipped m01,
    // #24 shipped m02, #25 shipped m03, #26 shipped m04, #27 shipped m05 —
    // the Curriculum is complete, no pending Module remains.
    expect(index.modules.map((m) => m.pending)).toEqual([false, false, false, false, false]);
  });
});

describe('test-scoped.sh', () => {
  it('refuses to run the full suite without FULL=1', () => {
    const result = run('scripts/test-scoped.sh', []);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain('TEST USAGE ERROR');
    expect(result.stdout).toContain('FULL=1');
  });

  it('exits 2 on a test file that does not exist', () => {
    const result = run('scripts/test-scoped.sh', ['src/nope.test.ts']);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain('no such test file');
  });
});

describe('smoke.sh', () => {
  it('fails on the first step with a short block and the log path', () => {
    // Port 9 (discard) is closed here: every request is refused, the way an
    // unreachable deploy behaves.
    const result = run('scripts/smoke.sh', [], { KATA_URL: 'http://127.0.0.1:9/' });

    expect(result.status).toBe(10); // 10 = app shell, per scripts/README.md
    expect(result.lines[0]).toMatch(/^SMOKE FAIL 0\/13 \| step shell \(exit 10\)/);
    expect(result.lines.length).toBeLessThanOrEqual(25);
    expect(result.stdout).toContain('log: ');
  }, 30_000);

  it('documents every exit code it can return', () => {
    const help = run('scripts/smoke.sh', ['--help']);

    expect(help.status).toBe(0);
    for (const code of [
      '10 shell',
      '14 manifest',
      '17 content',
      '18 exercise folders',
      '19 m02 exercise folders',
      '20 m03 exercise folders',
      '21 m04 exercise folders',
      '22 m05 exercise folders',
    ]) {
      expect(help.stdout).toContain(code);
    }
  });
});

describe('build-exercises.sh (#22)', () => {
  // A fake `dotnet` first on PATH keeps these hermetic: no SDK, no NuGet, and
  // the same behavior on this host and in CI.
  function fakeDotnet(exitCode: number) {
    const bin = mkdtempSync(join(tmpdir(), 'kata-dotnet-'));
    writeFileSync(
      join(bin, 'dotnet'),
      `#!/usr/bin/env bash\necho "fake dotnet build $*"\nexit ${exitCode}\n`,
      { mode: 0o755 },
    );
    return bin;
  }

  function exerciseTree(...folders: string[]) {
    const dir = mkdtempSync(join(tmpdir(), 'kata-exercises-'));
    for (const folder of folders) {
      mkdirSync(join(dir, folder, 'src'), { recursive: true });
      writeFileSync(join(dir, folder, 'src', 'Exercise.csproj'), '<Project />\n');
    }
    return dir;
  }

  const build = (env: Record<string, string>) => run('scripts/build-exercises.sh', [], env);

  it('passes with the explicit zero-folders line while exercises/ is absent', () => {
    const result = build({ KATA_EXERCISES_DIR: join(tmpdir(), 'kata-no-exercises') });

    expect(result.status).toBe(0);
    expect(result.lines).toEqual(['EXERCISES ok | 0 Test Suites (none committed yet)']);
  });

  it('prints one ok line per folder plus the final count', () => {
    const exercises = exerciseTree('m01/m01-e1', 'm01/m01-e2');
    const result = build({
      KATA_EXERCISES_DIR: exercises,
      PATH: `${fakeDotnet(0)}:${process.env.PATH}`,
    });
    rmSync(exercises, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(result.lines).toEqual([
      'ok exercises/m01/m01-e1',
      'ok exercises/m01/m01-e2',
      'EXERCISES ok | 2/2 Test Suites compile',
    ]);
  });

  it('exits 3 naming the broken folder, with the log path', () => {
    const exercises = exerciseTree('m01/m01-e1');
    const result = build({
      KATA_EXERCISES_DIR: exercises,
      PATH: `${fakeDotnet(1)}:${process.env.PATH}`,
    });
    rmSync(exercises, { recursive: true, force: true });

    expect(result.status).toBe(3);
    expect(result.lines[0]).toBe('FAIL exercises/m01/m01-e1');
    expect(result.stdout).toContain('EXERCISES FAIL 0/1 | broken: m01/m01-e1');
    expect(result.stdout).toContain('log: ');
  });

  it('documents every exit code it can return', () => {
    const help = run('scripts/build-exercises.sh', ['--help']);

    expect(help.status).toBe(0);
    for (const code of ['0 ok (including zero folders)', '2 usage/precondition', '3 one or more']) {
      expect(help.stdout).toContain(code);
    }
  });
});
