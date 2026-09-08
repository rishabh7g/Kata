import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * The check is exercised against the repo's real `exercises/` tree — the discovery is the thing
 * under test (#234) — with `dotnet` and `python3` replaced by shims on PATH, so nothing here
 * compiles or collects anything. What these tests assert is what the script found and what it
 * said about it: the folder count, the explicit zero-folder pass, and that a discovery which
 * cannot run is a loud exit 2 rather than a green run that checked nothing.
 */
const SCRIPTS = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(SCRIPTS, 'build-exercises.sh');
const EXERCISES = path.join(path.dirname(SCRIPTS), 'exercises');

/** One shim for `dotnet` and `python3`: it records the call and exits with the code it is given. */
const SHIM = `#!/usr/bin/env bash
set -uo pipefail
tool="$(basename "$0")"
printf '%s %s\\n' "$tool" "$*" >> "$FAKE_CALLS"
exit_var="FAKE_$(printf '%s' "$tool" | tr '[:lower:]' '[:upper:]')_EXIT"
exit "\${!exit_var:-0}"
`;

/** A find that cannot run the expression it was handed — what BSD find does with GNU's -printf. */
const BROKEN_FIND = `#!/usr/bin/env bash
printf 'find: -printf: unknown primary or operator\\n' >&2
exit 1
`;

interface Scenario {
  /** The tree to check; defaults to the repo's committed `exercises/`. */
  exercises?: string;
  /** Exit code for every `dotnet build`. */
  dotnetExit?: number;
  /** Replace `find` with one that fails, to exercise a discovery that cannot run. */
  brokenFind?: boolean;
}

interface Run {
  status: number;
  stdout: string;
  stderr: string;
  /** Every command the check actually invoked, in order. */
  calls: string[];
}

const sandboxes: string[] = [];

afterAll(() => {
  for (const dir of sandboxes) rmSync(dir, { recursive: true, force: true });
});

function check(scenario: Scenario = {}): Run {
  const dir = mkdtempSync(path.join(tmpdir(), 'kata-exercises-'));
  sandboxes.push(dir);

  const bin = path.join(dir, 'bin');
  mkdirSync(bin);
  for (const name of ['dotnet', 'python3']) {
    writeFileSync(path.join(bin, name), SHIM, { mode: 0o755 });
  }
  if (scenario.brokenFind) writeFileSync(path.join(bin, 'find'), BROKEN_FIND, { mode: 0o755 });

  const calls = path.join(dir, 'calls.log');
  const result = spawnSync('bash', [SCRIPT], {
    cwd: tmpdir(),
    encoding: 'utf8',
    env: {
      ...(process.env as Record<string, string>),
      PATH: `${bin}:${process.env['PATH'] ?? ''}`,
      FAKE_CALLS: calls,
      FAKE_DOTNET_EXIT: String(scenario.dotnetExit ?? 0),
      KATA_CHECKS_DIR: path.join(dir, 'checks'),
      KATA_EXERCISES_DIR: scenario.exercises ?? EXERCISES,
    },
  });

  return {
    status: result.status ?? -1,
    stdout: result.stdout,
    stderr: result.stderr,
    calls: existsSync(calls) ? readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean) : [],
  };
}

/** The Exercise folders the check is expected to find: the two path segments above any material. */
function committedFolders(root: string): string[] {
  const folders: string[] = [];
  for (const module of readdirSync(root, { withFileTypes: true })) {
    if (!module.isDirectory()) continue;
    for (const exercise of readdirSync(path.join(root, module.name), { withFileTypes: true })) {
      if (!exercise.isDirectory()) continue;
      const folder = path.join(root, module.name, exercise.name);
      if (holdsMaterial(folder)) folders.push(`${module.name}/${exercise.name}`);
    }
  }
  return folders.sort();
}

function holdsMaterial(dir: string): boolean {
  return readdirSync(dir, { withFileTypes: true }).some((entry) => {
    if (entry.isDirectory()) return holdsMaterial(path.join(dir, entry.name));
    return entry.name.endsWith('.csproj') || entry.name.endsWith('.py');
  });
}

describe('discovery', () => {
  // #234: BSD find has no `-printf`, and with its stderr discarded the failure read as
  // `0 Test Suites (none committed yet)` — a green run over 11 unchecked folders.
  it('finds every committed Exercise folder, on this host', () => {
    const expected = committedFolders(EXERCISES);
    const run = check();

    expect(expected.length).toBeGreaterThan(0);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain(
      `EXERCISES ok | ${expected.length}/${expected.length} Test Suites ready`,
    );
    for (const folder of expected) expect(run.stdout).toContain(`ok exercises/${folder}`);
    expect(run.stdout).not.toContain('0 Test Suites');
  });

  it('still calls a genuinely empty exercises/ an explicit pass', () => {
    const empty = mkdtempSync(path.join(tmpdir(), 'kata-empty-'));
    sandboxes.push(empty);

    const run = check({ exercises: empty });

    expect(run.status).toBe(0);
    expect(run.stdout).toBe('EXERCISES ok | 0 Test Suites (none committed yet)\n');
    expect(run.calls).toEqual([]);
  });

  // #235: an EXERCISES_DIR that is not there is a typo in KATA_EXERCISES_DIR, or a path that is
  // right on one host and wrong on another — never an empty tree. It used to print the
  // zero-folder pass byte for byte and exit 0, so silence and success looked alike.
  it('fails when the exercises directory does not exist', () => {
    const parent = mkdtempSync(path.join(tmpdir(), 'kata-missing-'));
    sandboxes.push(parent);
    const missing = path.join(parent, 'not-here');

    const run = check({ exercises: missing });

    expect(run.status).toBe(2);
    expect(run.stdout).toContain('EXERCISES PRECONDITION FAIL');
    expect(run.stdout).toContain(missing);
    expect(run.stdout).not.toContain('0 Test Suites');
    expect(run.calls).toEqual([]);
  });

  it('fails when the exercises path exists but is a file', () => {
    const parent = mkdtempSync(path.join(tmpdir(), 'kata-notadir-'));
    sandboxes.push(parent);
    const file = path.join(parent, 'exercises');
    writeFileSync(file, '');

    const run = check({ exercises: file });

    expect(run.status).toBe(2);
    expect(run.stdout).toContain('EXERCISES PRECONDITION FAIL');
    expect(run.stdout).toContain(file);
    expect(run.stdout).not.toContain('0 Test Suites');
    expect(run.calls).toEqual([]);
  });

  it('fails loudly when discovery itself cannot run, instead of finding nothing', () => {
    const run = check({ brokenFind: true });

    expect(run.status).toBe(2);
    expect(run.stdout).toContain('EXERCISES PRECONDITION FAIL');
    expect(run.stdout).not.toContain('0 Test Suites');
    expect(run.calls).toEqual([]);
  });
});

describe('the report', () => {
  it('names the folders that failed and exits 3', () => {
    const expected = committedFolders(EXERCISES);
    const run = check({ dotnetExit: 1 });

    expect(run.status).toBe(3);
    expect(run.stdout).toMatch(new RegExp(`EXERCISES FAIL \\d+/${expected.length} \\| broken: `));
  });
});
