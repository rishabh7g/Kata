// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * draft-exercise.mjs contract (#21, scripts/README.md): one summary line with
 * the generated source LOC (flagged when over the brief's size budget),
 * distinct exit codes, and NO overwrite path at all — regeneration is a new
 * Exercise id. The Target Interface file is written verbatim from the brief,
 * never from the model's output.
 *
 * Nothing here calls the real CLI: $KATA_CLAUDE_BIN points at fake binaries
 * and $KATA_EXERCISES_DIR at a temp directory, so the suite is offline and free.
 */

const REPO = fileURLToPath(new URL('..', import.meta.url));
const BRIEF = 'scripts/fixtures/exercise-briefs/refactor.json';
const TMP = mkdtempSync(join(tmpdir(), 'kata-exdraft-'));
const CHECKS = join(TMP, 'checks');
const EXERCISES = join(TMP, 'exercises');

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

beforeEach(() => {
  rmSync(EXERCISES, { recursive: true, force: true });
});

/** A fake `claude` that swallows stdin and prints a canned response. */
function fakeCli(name: string, body: string) {
  const path = join(TMP, name);
  writeFileSync(path, `#!/bin/sh\ncat > /dev/null\n${body}\n`);
  chmodSync(path, 0o755);
  return path;
}

/** A fake CLI whose successful envelope carries `inner` as the draft text. */
function fakeCliFor(name: string, inner: unknown) {
  const envelope = JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: typeof inner === 'string' ? inner : JSON.stringify(inner),
  });
  return fakeCli(name, `printf '%s' '${envelope.replace(/'/g, `'\\''`)}'`);
}

const GOOD_MATERIAL = {
  files: [
    {
      path: 'DocumentStore.cs',
      content:
        'namespace Kata.Exercise;\n\npublic sealed class DocumentStore : IDocumentStore\n{\n    public void Save(string documentName, string contents) { }\n    public string Load(string documentName) => "";\n    public bool Exists(string documentName) => false;\n}',
    },
  ],
  testFiles: [
    {
      path: 'DocumentStoreTests.cs',
      content:
        'using Xunit;\nusing Kata.Exercise;\n\nnamespace Kata.Exercise.Tests;\n\npublic class DocumentStoreTests\n{\n    [Fact]\n    public void SavedDocumentExists() { Assert.True(true); }\n}',
    },
  ],
  smellNotes: 'The Smell is the leaked folder layout; the Test Suite pins Save/Load round-trips.',
};

const goodCli = fakeCliFor('claude-ok', GOOD_MATERIAL);
const nonJsonCli = fakeCli('claude-text', `printf 'I am not JSON at all'`);
const errorCli = fakeCli('claude-err', `echo 'not authenticated' >&2; exit 1`);

function draft(args: string[], bin = goodCli) {
  const result = spawnSync('node', ['scripts/draft-exercise.mjs', ...args], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, KATA_CHECKS_DIR: CHECKS, KATA_EXERCISES_DIR: EXERCISES, KATA_CLAUDE_BIN: bin },
  });
  const stdout = result.stdout ?? '';
  return { status: result.status, stdout, lines: stdout.trim().split('\n') };
}

describe('draft-exercise.mjs', () => {
  it('writes the candidate folder and prints one summary line with LOC and budget', () => {
    const result = draft([BRIEF]);

    expect(result.status).toBe(0);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toContain('DRAFT m01-e1 ok');
    expect(result.lines[0]).toMatch(/\d+ src LOC/);
    expect(result.lines[0]).toContain('budget 250');

    const dir = join(EXERCISES, 'm01', 'm01-e1');
    expect(readFileSync(join(dir, 'README.md'), 'utf8')).toContain('immutable during the');
    expect(readFileSync(join(dir, 'smell-notes.md'), 'utf8')).toContain('pins Save/Load');
    expect(readFileSync(join(dir, 'src', 'Exercise.csproj'), 'utf8')).toContain('net10.0');
    expect(readFileSync(join(dir, 'src', 'DocumentStore.cs'), 'utf8')).toContain('sealed class DocumentStore');
    expect(readFileSync(join(dir, 'tests', 'Exercise.Tests.csproj'), 'utf8')).toContain('xunit');
    expect(readFileSync(join(dir, 'tests', 'DocumentStoreTests.cs'), 'utf8')).toContain('[Fact]');
  });

  it('writes the Target Interface verbatim from the brief, even if the draft emits its own copy', () => {
    const disobedient = fakeCliFor('claude-disobeys', {
      ...GOOD_MATERIAL,
      files: [
        ...GOOD_MATERIAL.files,
        { path: 'IDocumentStore.cs', content: 'namespace Kata.Exercise;\n\npublic interface IDocumentStore { }' },
      ],
    });
    const result = draft([BRIEF], disobedient);

    expect(result.status).toBe(0);
    const written = readFileSync(join(EXERCISES, 'm01', 'm01-e1', 'src', 'IDocumentStore.cs'), 'utf8');
    expect(written).toContain('void Save(string documentName, string contents);');
    expect(written).toContain('bool Exists(string documentName);');
  });

  it('accepts a Module pack plus an exercise id', () => {
    const result = draft(['public/content/modules/m01.json', 'm01-e2']);

    expect(result.status).toBe(0);
    expect(result.lines[0]).toContain('DRAFT m01-e2 ok');
    expect(existsSync(join(EXERCISES, 'm01', 'm01-e2', 'src', 'IRecentValues.cs'))).toBe(true);
  });

  it('--dry-run prints the never-from-flawed-code rule and the Target Interface verbatim, writes nothing', () => {
    const result = draft([BRIEF, '--dry-run']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('NEVER from the flawed code');
    expect(result.stdout).toContain('would bless the Smell');
    // The brief's Target Interface code, verbatim.
    expect(result.stdout).toContain('public interface IDocumentStore');
    expect(result.stdout).toContain('void Save(string documentName, string contents);');
    // Embedded docs.
    expect(result.stdout).toContain('Ubiquitous Language — Kata');
    expect(result.stdout).toContain('Exercise design rules');
    expect(existsSync(join(EXERCISES, 'm01'))).toBe(false);
  });

  it('exits 3 when the exercise folder exists — regeneration is a new Exercise id, no --force', () => {
    expect(draft([BRIEF]).status).toBe(0);

    const second = draft([BRIEF]);
    expect(second.status).toBe(3);
    expect(second.stdout).toContain('NEW Exercise id');

    const forced = draft([BRIEF, '--force']);
    expect(forced.status).toBe(2);
    expect(forced.stdout).toContain('no --force');
  });

  it('exits 2 on usage problems: no args, missing file, pack without an exercise id, bad brief', () => {
    expect(draft([]).status).toBe(2);
    expect(draft(['no/such/brief.json']).status).toBe(2);

    const pack = draft(['public/content/modules/m01.json']);
    expect(pack.status).toBe(2);
    expect(pack.stdout).toContain('m01-e1, m01-e2');

    const broken = join(TMP, 'broken-brief.json');
    writeFileSync(broken, JSON.stringify({ id: 'm01-e9', type: 'refactor', title: 'x' }));
    const bad = draft([broken]);
    expect(bad.status).toBe(2);
    expect(bad.stdout).toContain('brief.concept');
  });

  it('exits 4 with a clear message when the CLI is missing or fails', () => {
    const missing = draft([BRIEF], join(TMP, 'no-such-claude'));
    expect(missing.status).toBe(4);
    expect(missing.stdout).toContain('installed and on PATH');

    const failed = draft([BRIEF], errorCli);
    expect(failed.status).toBe(4);
    expect(failed.stdout).toContain('exited 1');
  });

  it('exits 5 when the CLI envelope or the draft JSON is bad', () => {
    expect(draft([BRIEF], nonJsonCli).status).toBe(5);

    const chatty = draft([BRIEF], fakeCliFor('claude-chatty', 'Here is your exercise! Enjoy.'));
    expect(chatty.status).toBe(5);
    expect(chatty.stdout).toContain('strict JSON');

    const empty = draft([BRIEF], fakeCliFor('claude-empty', { files: [], testFiles: [], smellNotes: 'x' }));
    expect(empty.status).toBe(5);
    expect(empty.stdout).toContain('"files"');
  });

  it('exits 5 on an unsafe file path instead of writing outside the folder', () => {
    const escape = fakeCliFor('claude-escape', {
      ...GOOD_MATERIAL,
      files: [{ path: '../../evil.cs', content: 'boom' }],
    });
    const result = draft([BRIEF], escape);

    expect(result.status).toBe(5);
    expect(result.stdout).toContain('unsafe');
    expect(existsSync(join(EXERCISES, 'm01'))).toBe(false);
  });

  it('flags the summary when the generated source exceeds the size budget', () => {
    const bloated = fakeCliFor('claude-bloated', {
      ...GOOD_MATERIAL,
      files: [
        {
          path: 'DocumentStore.cs',
          content: Array.from({ length: 300 }, (_, i) => `// line ${i}`).join('\n'),
        },
      ],
    });
    const result = draft([BRIEF], bloated);

    expect(result.status).toBe(0);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toContain('OVER the 250 LOC budget');
  });
});
