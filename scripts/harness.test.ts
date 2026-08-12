// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
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

  it('skips loudly with no schema yet, and validates the repo layout once #7 lands', () => {
    const shipped =
      existsSync(join(REPO, 'schemas/module-index.schema.json')) &&
      existsSync(join(REPO, 'schemas/module-content.schema.json')) &&
      existsSync(join(REPO, 'public/content/index.json'));
    const result = validate();

    expect(result.status).toBe(0);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toContain(shipped ? 'CONTENT ok' : 'CONTENT SKIP');
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
    expect(result.lines[0]).toMatch(/^SMOKE FAIL 0\/7 \| step shell \(exit 10\)/);
    expect(result.lines.length).toBeLessThanOrEqual(25);
    expect(result.stdout).toContain('log: ');
  }, 30_000);

  it('documents every exit code it can return', () => {
    const help = run('scripts/smoke.sh', ['--help']);

    expect(help.status).toBe(0);
    for (const code of ['10 shell', '14 manifest', '17 content']) {
      expect(help.stdout).toContain(code);
    }
  });
});
