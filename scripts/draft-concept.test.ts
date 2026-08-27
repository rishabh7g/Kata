// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * draft-concept.mjs contract (#20, scripts/README.md): one summary line on
 * success, distinct exit codes, refuses to overwrite without --force, and a
 * clear message when the claude CLI is missing or returns garbage.
 *
 * Nothing here calls the real CLI: $KATA_CLAUDE_BIN points at fake binaries
 * and $KATA_DRAFTS_DIR at a temp directory, so the suite is offline and free.
 */

const REPO = fileURLToPath(new URL('..', import.meta.url));
const TMP = mkdtempSync(join(tmpdir(), 'kata-draft-'));
const CHECKS = join(TMP, 'checks');
const DRAFTS = join(TMP, 'drafts');

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

beforeEach(() => {
  rmSync(DRAFTS, { recursive: true, force: true });
});

/** A fake `claude` that swallows stdin and prints a canned response. */
function fakeCli(name: string, body: string) {
  const path = join(TMP, name);
  writeFileSync(path, `#!/bin/sh\ncat > /dev/null\n${body}\n`);
  chmodSync(path, 0o755);
  return path;
}

const GOOD_JSON = JSON.stringify({
  type: 'result',
  subtype: 'success',
  is_error: false,
  result: '# Dependency Direction\n\nDrafted prose about pointing dependencies at stable abstractions.',
});

const goodCli = fakeCli('claude-ok', `printf '%s' '${GOOD_JSON.replace(/'/g, `'\\''`)}'`);
const nonJsonCli = fakeCli('claude-text', `printf 'I am not JSON at all'`);
const errorCli = fakeCli('claude-err', `echo 'not authenticated' >&2; exit 1`);

function draft(args: string[], bin = goodCli) {
  const result = spawnSync('node', ['scripts/draft-concept.mjs', ...args], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, KATA_CHECKS_DIR: CHECKS, KATA_DRAFTS_DIR: DRAFTS, KATA_CLAUDE_BIN: bin },
  });
  const stdout = result.stdout ?? '';
  return { status: result.status, stdout, lines: stdout.trim().split('\n') };
}

describe('draft-concept.mjs', () => {
  it('writes drafts/<id>-concept.md and prints one summary line', () => {
    const result = draft(['m02']);

    expect(result.status).toBe(0);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toContain('DRAFT m02 ok');
    expect(result.lines[0]).toContain('m02-concept.md');

    const written = readFileSync(join(DRAFTS, 'm02-concept.md'), 'utf8');
    expect(written).toContain('# Dependency Direction');
    expect(written).toContain('stable abstractions');
  });

  it('--dry-run prints the ubiquitous language and pedagogy rules, writes nothing', () => {
    const result = draft(['m02', '--dry-run']);

    expect(result.status).toBe(0);
    // docs/ubiquitous-language.md embedded verbatim (docs/engineering.md § 8).
    expect(result.stdout).toContain('Ubiquitous Language — Kata');
    expect(result.stdout).toContain('**Target Interface**');
    // docs/design.md § Pedagogy rules. The marker is one of the section's own
    // sentences; it moved to this one when the reframe (#155) retired the
    // gated-course pedagogy the old marker named.
    expect(result.stdout).toContain('The Self-Check is a mirror');
    // The Module being drafted.
    expect(result.stdout).toContain('Dependency Direction');
    expect(existsSync(join(DRAFTS, 'm02-concept.md'))).toBe(false);
  });

  it('exits 2 on a module id that is not in the index, naming the valid ids', () => {
    const result = draft(['m99']);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain('DRAFT USAGE ERROR');
    expect(result.stdout).toContain('m01, m02, m03, m04, m05');
  });

  it('exits 2 with usage when called with no module id', () => {
    expect(draft([]).status).toBe(2);
  });

  it('refuses to overwrite an existing draft (exit 3) unless --force is passed', () => {
    expect(draft(['m02']).status).toBe(0);

    const second = draft(['m02']);
    expect(second.status).toBe(3);
    expect(second.stdout).toContain('--force');
    const forced = draft(['m02', '--force']);
    expect(forced.status).toBe(0);
    expect(forced.lines[0]).toContain('DRAFT m02 ok');
  });

  it('exits 4 with a clear message when the CLI is missing', () => {
    const result = draft(['m02'], join(TMP, 'no-such-claude'));

    expect(result.status).toBe(4);
    expect(result.stdout).toContain('DRAFT FAIL');
    expect(result.stdout).toContain('installed and on PATH');
  });

  it('exits 4 when the CLI itself fails (e.g. unauthenticated)', () => {
    const result = draft(['m02'], errorCli);

    expect(result.status).toBe(4);
    expect(result.stdout).toContain('exited 1');
    expect(result.stdout).toContain('authenticated');
  });

  it('exits 5 when the CLI returns non-JSON output', () => {
    const result = draft(['m02'], nonJsonCli);

    expect(result.status).toBe(5);
    expect(result.stdout).toContain('non-JSON');
  });
});
