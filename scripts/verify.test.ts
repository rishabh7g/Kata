import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * The harness is exercised in a sandbox: a tmp dir holding a copy of verify.sh, the five files
 * that guard its stages, and a `bin/` ahead of it on PATH with fake `npm`, `npx` and `node`.
 * Nothing here runs the real toolchain — a test that shelled out to `npm run test` would run
 * vitest inside vitest — so what these tests assert is the harness's own behaviour: stage order,
 * the one-line summary, the failure block, the exit codes, and which stages did NOT run.
 */
// Not `new URL('./verify.sh', import.meta.url)`: Vite rewrites that literal into an asset URL.
const VERIFY_SH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'verify.sh');

/** Canned vitest tail — the line `test_counts` parses. */
const VITEST_OUT = ['', ' Test Files  7 passed (7)', '      Tests  54 passed (54)', ''].join('\n');

type Stage = 'TYPES' | 'ESLINT' | 'PRETTIER' | 'TEST' | 'CONTENT' | 'STRINGS' | 'BUILD';

/** The file each stage is guarded by, relative to the sandbox root. */
const GUARDS = {
  tsconfig: 'tsconfig.json',
  eslint: 'eslint.config.js',
  vite: 'vite.config.ts',
  content: path.join('scripts', 'validate-content.mjs'),
  strings: path.join('tools', 'strings-check.ts'),
} as const;

type Guard = keyof typeof GUARDS;

interface Scenario {
  /** Exit code per stage; anything unset exits 0. */
  exits?: Partial<Record<Stage, number>>;
  /** stdout per stage; TEST defaults to a realistic vitest summary. */
  out?: Partial<Record<Stage, string>>;
  /** Guard files to leave out of the sandbox, to exercise the skips. */
  without?: Guard[];
  args?: string[];
}

interface Run {
  status: number;
  stdout: string;
  stderr: string;
  /** Every command the harness actually invoked, in order. */
  calls: string[];
  /** `.verify/<stage>.log` files that exist after the run. */
  logs: string[];
  dir: string;
}

/** One shim stands in for `npm`, `npx` and `node`: it records the call and replays canned output. */
const SHIM = `#!/usr/bin/env bash
set -uo pipefail
printf '%s %s\\n' "$(basename "$0")" "$*" >> "$FAKE_CALLS"
case "$(basename "$0") $*" in
  "npx tsc --noEmit") key=TYPES ;;
  "npx eslint .") key=ESLINT ;;
  "npx prettier --check .") key=PRETTIER ;;
  "npm run test") key=TEST ;;
  "node scripts/validate-content.mjs") key=CONTENT ;;
  "node tools/strings-check.ts") key=STRINGS ;;
  "npx vite build") key=BUILD ;;
  *) printf 'fake: unexpected invocation\\n' >&2; exit 99 ;;
esac
out_var="FAKE_\${key}_OUT"
exit_var="FAKE_\${key}_EXIT"
[ -n "\${!out_var-}" ] && printf '%s\\n' "\${!out_var}"
exit "\${!exit_var-0}"
`;

const STAGES: Stage[] = ['TYPES', 'ESLINT', 'PRETTIER', 'TEST', 'CONTENT', 'STRINGS', 'BUILD'];
const LOG_NAMES = ['types', 'lint', 'test', 'content', 'strings', 'build'];

const sandboxes: string[] = [];

afterAll(() => {
  for (const dir of sandboxes) rmSync(dir, { recursive: true, force: true });
});

function verify(scenario: Scenario = {}): Run {
  const dir = mkdtempSync(path.join(tmpdir(), 'kata-verify-'));
  sandboxes.push(dir);

  mkdirSync(path.join(dir, 'scripts'));
  writeFileSync(path.join(dir, 'scripts', 'verify.sh'), readFileSync(VERIFY_SH));
  for (const [guard, file] of Object.entries(GUARDS)) {
    if (scenario.without?.includes(guard as Guard)) continue;
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), '// stand-in for the real config\n');
  }

  const bin = path.join(dir, 'bin');
  mkdirSync(bin);
  for (const name of ['npm', 'npx', 'node']) {
    writeFileSync(path.join(bin, name), SHIM, { mode: 0o755 });
  }

  const calls = path.join(dir, 'calls.log');
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    PATH: `${bin}:${process.env['PATH'] ?? ''}`,
    FAKE_CALLS: calls,
    FAKE_TEST_OUT: VITEST_OUT,
  };
  for (const stage of STAGES) {
    const code = scenario.exits?.[stage];
    if (code !== undefined) env[`FAKE_${stage}_EXIT`] = String(code);
    const out = scenario.out?.[stage];
    if (out !== undefined) env[`FAKE_${stage}_OUT`] = out;
  }

  const result = spawnSync(
    'bash',
    [path.join(dir, 'scripts', 'verify.sh'), ...(scenario.args ?? [])],
    { cwd: tmpdir(), env, encoding: 'utf8' },
  );

  return {
    status: result.status ?? -1,
    stdout: result.stdout,
    stderr: result.stderr,
    calls: existsSync(calls) ? readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean) : [],
    logs: LOG_NAMES.filter((name) => existsSync(path.join(dir, '.verify', `${name}.log`))),
    dir,
  };
}

describe('a green run', () => {
  it('prints exactly one line and exits 0', () => {
    const run = verify();

    expect(run.status).toBe(0);
    expect(run.stdout).toBe(
      'TYPES ok | LINT ok | TEST 54/54 ok | CONTENT ok | STRINGS ok | BUILD ok\n',
    );
    expect(run.stderr).toBe('');
  });

  it('runs the six stages in order, prettier inside LINT', () => {
    expect(verify().calls).toEqual([
      'npx tsc --noEmit',
      'npx eslint .',
      'npx prettier --check .',
      'npm run test',
      'node scripts/validate-content.mjs',
      'node tools/strings-check.ts',
      'npx vite build',
    ]);
  });

  it('leaves one log per stage in .verify/', () => {
    expect(verify().logs).toEqual(['types', 'lint', 'test', 'content', 'strings', 'build']);
  });

  it('reads the count off vitest, including when tests are skipped', () => {
    const run = verify({
      out: { TEST: ' Test Files  7 passed (7)\n      Tests  2 skipped | 52 passed (54)' },
    });

    expect(run.stdout).toContain('TEST 52/54 ok');
  });

  it('falls back to a bare TEST ok if the reporter stops printing a count', () => {
    const run = verify({ out: { TEST: 'all good, trust me' } });

    expect(run.stdout).toBe('TYPES ok | LINT ok | TEST ok | CONTENT ok | STRINGS ok | BUILD ok\n');
  });

  it('wipes stale logs from the previous run', () => {
    const run = verify();
    writeFileSync(path.join(run.dir, '.verify', 'stale.log'), 'from a run long past');

    spawnSync('bash', [path.join(run.dir, 'scripts', 'verify.sh')], {
      env: {
        ...process.env,
        PATH: `${run.dir}/bin:${process.env['PATH'] ?? ''}`,
        FAKE_CALLS: `${run.dir}/calls.log`,
      },
      encoding: 'utf8',
    });

    expect(existsSync(path.join(run.dir, '.verify', 'stale.log'))).toBe(false);
  });
});

describe('the first failure stops the run', () => {
  it.each([
    ['TYPES', 'TYPES', 10],
    ['LINT', 'ESLINT', 20],
    ['LINT', 'PRETTIER', 20],
    ['TEST', 'TEST', 30],
    ['CONTENT', 'CONTENT', 40],
    ['STRINGS', 'STRINGS', 60],
    ['BUILD', 'BUILD', 50],
  ] as [string, Stage, number][])('%s failing (%s) exits %i', (label, stage, code) => {
    const run = verify({ exits: { [stage]: 1 } });

    expect(run.status).toBe(code);
    expect(run.stdout).toMatch(new RegExp(`^FAIL ${label} \\(exit ${code}\\)\n`));
  });

  it('prints the failing log tail and its path, and nothing else', () => {
    const run = verify({ exits: { TYPES: 2 }, out: { TYPES: 'src/App.tsx(1,1): error TS2322' } });

    expect(run.stdout).toBe(
      [
        'FAIL TYPES (exit 10)',
        'npx tsc --noEmit exited 2',
        '',
        'src/App.tsx(1,1): error TS2322',
        '',
        `log: ${path.join(run.dir, '.verify', 'types.log')}`,
        '',
      ].join('\n'),
    );
  });

  // #233: a TEST stage that failed with 75 passing tests in its log. `1` (the
  // tool judged the run bad) and `143` (it was killed mid-run and judged
  // nothing) are the same stage code and opposite diagnoses, so the failure
  // block names the tool's own status as well as the stage's.
  it('names the command and the status it exited with, beside the stage code', () => {
    const run = verify({ exits: { TEST: 143 } });

    expect(run.status).toBe(30);
    expect(run.stdout.split('\n').slice(0, 2)).toEqual([
      'FAIL TEST (exit 30)',
      'npm run test exited 143',
    ]);
  });

  it('still fails a suite that reports every test passing but exits non-zero', () => {
    const run = verify({ exits: { TEST: 1 } });

    expect(run.status).toBe(30);
    expect(run.stdout).toContain('Tests  54 passed (54)');
    expect(run.stdout).not.toContain('TEST 54/54 ok');
  });

  it('slices the last 20 lines of a long log', () => {
    const lines = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`);
    const run = verify({ exits: { TYPES: 1 }, out: { TYPES: lines.join('\n') } });

    const slice = run.stdout.split('\n').slice(3, -3);
    expect(slice).toEqual(lines.slice(-20));
    expect(slice).toHaveLength(20);
  });

  it('says so when the failing stage printed nothing', () => {
    const run = verify({ exits: { TYPES: 1 } });

    expect(run.stdout).toContain('(no output)');
  });

  it('leaves no trace of the stages after it — no calls, no logs', () => {
    const run = verify({ exits: { TYPES: 1 } });

    expect(run.calls).toEqual(['npx tsc --noEmit']);
    expect(run.logs).toEqual(['types']);
  });

  it('fails LINT on formatting alone, with eslint clean', () => {
    const run = verify({ exits: { PRETTIER: 1 }, out: { PRETTIER: '[warn] src/App.tsx' } });

    expect(run.status).toBe(20);
    expect(run.stdout).toContain('FAIL LINT (exit 20)');
    expect(run.stdout).toContain('[warn] src/App.tsx');
    expect(run.calls).toEqual(['npx tsc --noEmit', 'npx eslint .', 'npx prettier --check .']);
    expect(run.logs).toEqual(['types', 'lint']);
  });
});

describe('a stage whose tooling is absent', () => {
  it('says skip rather than passing silently', () => {
    const run = verify({ without: ['tsconfig', 'eslint', 'vite', 'content', 'strings'] });

    expect(run.status).toBe(0);
    expect(run.stdout).toBe(
      'TYPES skip | LINT skip | TEST skip | CONTENT skip | STRINGS skip | BUILD skip\n',
    );
    expect(run.calls).toEqual([]);
    expect(run.logs).toEqual([]);
  });

  it('skips only that stage and runs the rest', () => {
    const run = verify({ without: ['content'] });

    expect(run.status).toBe(0);
    expect(run.stdout).toBe(
      'TYPES ok | LINT ok | TEST 54/54 ok | CONTENT skip | STRINGS ok | BUILD ok\n',
    );
    expect(run.calls).not.toContain('node scripts/validate-content.mjs');
  });
});

describe('arguments', () => {
  it('rejects an unknown argument with usage on stderr', () => {
    const run = verify({ args: ['--turbo'] });

    expect(run.status).toBe(2);
    expect(run.stderr).toContain('verify: unknown argument: --turbo');
    expect(run.calls).toEqual([]);
  });

  it('--help prints usage and runs nothing', () => {
    const run = verify({ args: ['--help'] });

    expect(run.status).toBe(0);
    expect(run.stdout).toBe('usage: scripts/verify.sh\n');
    expect(run.calls).toEqual([]);
  });
});

/**
 * The summary line is documented in three places, and an exact passing total quoted in prose has
 * no way to stay true — it went stale two commits after it was written (#238). The docs carry the
 * shape `TEST n/n`; this guards that they never drift back to a snapshot of one run's numbers.
 */
describe('the documented summary line quotes no snapshot count', () => {
  const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const DOCUMENTED_IN = ['CLAUDE.md', 'README.md', path.join('scripts', 'verify.sh')];
  const SNAPSHOT_COUNT = /TEST \d+\/\d+/;

  it('matches a line that does quote one, so an empty result means something', () => {
    expect(
      SNAPSHOT_COUNT.test(
        'TYPES ok | LINT ok | TEST 83/83 ok | CONTENT ok | STRINGS ok | BUILD ok',
      ),
    ).toBe(true);
    expect(
      SNAPSHOT_COUNT.test('TYPES ok | LINT ok | TEST n/n ok | CONTENT ok | STRINGS ok | BUILD ok'),
    ).toBe(false);
  });

  it.each(DOCUMENTED_IN)('%s documents the shape, not a count', (doc) => {
    const lines = readFileSync(path.join(REPO_ROOT, doc), 'utf8').split('\n');

    expect(lines.filter((line) => SNAPSHOT_COUNT.test(line))).toEqual([]);
  });
});
