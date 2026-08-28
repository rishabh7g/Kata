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
 *
 * Nothing here spawns a full suite either (#64): these tests run INSIDE the
 * suite, so a child that runs everything would re-enter this file forever.
 * run() strips FULL from the child environment for that reason, and the
 * nesting cases below assert the script's own guard with the depth marker set
 * by hand — one bounded child process, never a real full run.
 */

const REPO = fileURLToPath(new URL('..', import.meta.url));
const CHECKS = mkdtempSync(join(tmpdir(), 'kata-checks-'));

afterAll(() => {
  rmSync(CHECKS, { recursive: true, force: true });
});

function run(command: string, args: string[], env: Record<string, string> = {}) {
  const childEnv: Record<string, string | undefined> = {
    ...process.env,
    KATA_CHECKS_DIR: CHECKS,
    ...env,
  };
  // FULL=1 in the parent must never reach a child (#64): it would turn a
  // spawned test-scoped.sh into another full suite, and this file into a fork
  // bomb. Pass FULL explicitly in `env` if a test ever needs it.
  if (!('FULL' in env)) delete childEnv.FULL;

  const result = spawnSync(command, args, {
    cwd: REPO,
    encoding: 'utf8',
    env: childEnv,
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
  const CONTENT_SCHEMA = 'schemas/module-content.schema.json';

  it('rejects a module entry missing ordinal, title, or description', () => {
    const result = validate(INDEX_SCHEMA, `${FIXTURES}/invalid-index/missing-fields.json`);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('missing-fields.json');
    for (const field of ['ordinal', 'title', 'description']) {
      expect(result.stdout).toContain(`must have required property '${field}'`);
    }
  });

  it('rejects a Module whose categoryId names no declared Category (#160)', () => {
    // Reference integrity inside one document is invisible to draft 2020-12,
    // so validate-content.mjs checks it beside the schema — same gate, same
    // exit code, and it runs against the DEPLOYED index in smoke.sh too.
    const result = validate(INDEX_SCHEMA, `${FIXTURES}/invalid-index/unknown-category.json`);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('unknown-category.json');
    expect(result.stdout).toContain('must name a Category this index declares');
  });

  it('accepts a Module content pack with no Exercises at all (#161)', () => {
    // Exercises are 0..n: an explain-only Module authors `"exercises": []`
    // and is a complete Module. How many a Module carries is an authoring
    // convention (docs/design.md § Module anatomy — a Software Design Module
    // ships one refactor and one construct), not a schema rule.
    const result = validate(CONTENT_SCHEMA, `${FIXTURES}/explain-only`);

    expect(result.status).toBe(0);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toContain('CONTENT ok (1 file)');
  });

  it('accepts a question with 4 options and an explanation (#162)', () => {
    // Options are 2–4 now, and `explanation` is optional and additive: the
    // explain-only fixture carries one question of each shape, so a pack
    // exercising both new rules still validates.
    const result = validate(CONTENT_SCHEMA, `${FIXTURES}/explain-only`);

    expect(result.status).toBe(0);
    expect(result.lines[0]).toContain('CONTENT ok (1 file)');
  });

  it('rejects a question with more than 4 options (#162)', () => {
    const result = validate(
      CONTENT_SCHEMA,
      `${FIXTURES}/invalid-content/too-many-options.json`,
    );

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('too-many-options.json');
    expect(result.stdout).toContain('must NOT have more than 4 items');
  });

  it('rejects two options of one question sharing a value (#162)', () => {
    // A pick is stored BY VALUE, so a duplicate would make one radio
    // unreachable — and `uniqueItems` cannot see it, because the two options
    // differ in their labels. validate-content.mjs checks it beside the
    // schema, same gate and same exit code as the dangling categoryId.
    const result = validate(
      CONTENT_SCHEMA,
      `${FIXTURES}/invalid-content/duplicate-option-value.json`,
    );

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('duplicate-option-value.json');
    expect(result.stdout).toContain('must be unique within the question');
  });

  /** The shipping index, read fresh — the Modules of one Category at a time. */
  function readIndex() {
    return JSON.parse(readFileSync(join(REPO, 'public/content/index.json'), 'utf8')) as {
      schemaVersion: number;
      categories: { id: string; ordinal: number; title: string; language: string }[];
      modules: {
        id: string;
        categoryId: string;
        ordinal: number;
        title: string;
        pending: boolean;
      }[];
    };
  }

  it('lists all five Software Design Modules, in Curriculum order, titles verbatim, all five authored', () => {
    const modules = readIndex().modules.filter((m) => m.categoryId === 'software-design');

    // docs/design.md § Categories and Modules — fixed order, foundations-down.
    expect(modules.map((m) => m.title)).toEqual([
      'Deep Modules & Information Hiding',
      'Dependency Direction',
      'Testing at Boundaries + TDD loop',
      'Naming & Ubiquitous Language',
      'Error Design',
    ]);
    expect(modules.map((m) => m.ordinal)).toEqual([1, 2, 3, 4, 5]);
    expect(modules.map((m) => m.id)).toEqual(['m01', 'm02', 'm03', 'm04', 'm05']);
    // A Module is pending until its content pack is authored: #8 shipped m01,
    // #24 shipped m02, #25 shipped m03, #26 shipped m04, #27 shipped m05 —
    // the Software Design Category is complete, no pending Module remains.
    expect(modules.map((m) => m.pending)).toEqual([false, false, false, false, false]);
  });

  it('declares the two Categories with their practice languages (#160, #165)', () => {
    const index = readIndex();

    // docs/design.md § Categories and Modules — the language belongs to the
    // shelf: Software Design practises in C#, Agentic AI in Python.
    expect(index.schemaVersion).toBe(2);
    expect(index.categories.map((c) => [c.id, c.ordinal, c.title, c.language])).toEqual([
      ['software-design', 1, 'Software Design', 'csharp'],
      ['agentic-ai', 2, 'Agentic AI', 'python'],
    ]);
    // Every Module is filed under a Category the same index declares, and a
    // Module's ordinal is 1-based and contiguous WITHIN its Category.
    const declared = new Set(index.categories.map((c) => c.id));
    expect(index.modules.every((m) => declared.has(m.categoryId))).toBe(true);
    for (const category of declared) {
      const ordinals = index.modules
        .filter((m) => m.categoryId === category)
        .map((m) => m.ordinal);
      expect(ordinals).toEqual(ordinals.map((_, position) => position + 1));
    }
  });

  it('lists the six Agentic AI Modules, in Curriculum order, all six authored (#165, #166, #167, #168, #169, #170, #171)', () => {
    const modules = readIndex().modules.filter((m) => m.categoryId === 'agentic-ai');

    // docs/design.md § Categories and Modules — the Category shipped as six
    // pending rows (#165); #166–#171 authored one content pack each, and #171
    // closed the Category with ai06. No Module in the Library is pending now,
    // which is why every pending-Module assertion in the suite is
    // fixture-driven (src/App.test.tsx, src/curriculum/curriculum.test.ts).
    expect(modules.map((m) => m.id)).toEqual(['ai01', 'ai02', 'ai03', 'ai04', 'ai05', 'ai06']);
    expect(modules.map((m) => m.title)).toEqual([
      'Embeddings',
      'Ingestion',
      'Retrieval-Augmented Generation',
      'Agents & Tool Use',
      'LangGraph',
      'LangSmith',
    ]);
    expect(modules.map((m) => m.ordinal)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(modules.map((m) => m.pending)).toEqual([false, false, false, false, false, false]);
    expect(readIndex().modules.some((m) => m.pending)).toBe(false);
  });

  const readPack = (id: string) =>
    JSON.parse(readFileSync(join(REPO, `public/content/modules/${id}.json`), 'utf8')) as {
      id: string;
      modelExamples: { before: string; after: string; caption: string }[];
      exercises: { id: string; type: string; folderUrl: string | null; targetInterfaceCode: string }[];
      selfCheckQuestions: { explanation?: string }[];
    };

  it.each([
    ['ai01', '#166'],
    ['ai02', '#167'],
    ['ai03', '#168'],
    ['ai04', '#169'],
    ['ai05', '#170'],
    ['ai06', '#171'],
  ])('ships %s with two Model Examples and three explained Self-Check questions (%s)', (id) => {
    const pack = readPack(id);

    expect(pack.id).toBe(id);
    // Each Model Example side stays inside the ≤ 40-line authoring rule
    // (docs/design.md § Module anatomy), which no schema can state.
    for (const example of pack.modelExamples) {
      expect(example.before.split('\n').length).toBeLessThanOrEqual(40);
      expect(example.after.split('\n').length).toBeLessThanOrEqual(40);
    }
    // Every question teaches after a pick (#162): the explanation is the same
    // text whichever option was chosen, so a pack that omits one reveals
    // nothing at all.
    expect(pack.selfCheckQuestions).toHaveLength(3);
    expect(pack.selfCheckQuestions.every((q) => (q.explanation ?? '').length > 0)).toBe(true);
  });

  // Five of the six Agentic AI Modules only explain, which is a complete
  // Module (#161). ai03 is the exception and the pilot (#172): one Python
  // Exercise, the only practice material in the Category.
  it.each([['ai01'], ['ai02'], ['ai04'], ['ai05'], ['ai06']])(
    'ships %s as an explain-only pack (#161)',
    (id) => {
      expect(readPack(id).exercises).toEqual([]);
    },
  );

  it('ships ai03 with the one Python Exercise, folder committed (#172)', () => {
    const [exercise, ...rest] = readPack('ai03').exercises;

    expect(rest).toEqual([]);
    expect(exercise?.id).toBe('ai03-e1');
    expect(exercise?.type).toBe('construct');
    // The folder is committed, so the brief links it rather than holding the
    // null placeholder — the Exercise screen's practice-material link.
    expect(exercise?.folderUrl).toBe(
      'https://github.com/rishabh7g/Kata/tree/main/exercises/ai03/ai03-e1',
    );
    // The Target Interface is rendered read-only, so it is the signatures the
    // learner implements — Python, because the Category is (#163).
    expect(exercise?.targetInterfaceCode).toContain('def chunk(text: str, size: int, overlap: int)');
    expect(exercise?.targetInterfaceCode).toContain('def retrieve(query: str, chunks: list[str], k: int)');
  });
});

/**
 * The pilot Python Exercise folder (#172). The Test Suite the learner clones
 * is committed material, so the facts that make it usable — it exists, it is
 * offline, and its skeleton is the thing they implement — are pinned here
 * rather than left to a reviewer's eye. Nothing in this block RUNS pytest:
 * `scripts/build-exercises.sh` collects the folder in CI, and Kata never gates
 * on test execution (docs/engineering.md § 6).
 */
describe('exercises/ai03/ai03-e1 (#172)', () => {
  const FOLDER = join(REPO, 'exercises/ai03/ai03-e1');
  const read = (path: string) => readFileSync(join(FOLDER, path), 'utf8');

  it('ships the folder convention: README, smell notes, src/ and tests/', () => {
    for (const path of [
      'README.md',
      'smell-notes.md',
      'src/retrieval.py',
      'tests/conftest.py',
      'tests/test_chunk.py',
      'tests/test_retrieve.py',
    ]) {
      expect(readFileSync(join(FOLDER, path), 'utf8').length).toBeGreaterThan(0);
    }
  });

  it('names pytest as the one thing to install, and no other toolchain', () => {
    expect(read('README.md')).toContain('pip install pytest');
    expect(read('README.md')).toContain('pytest');
  });

  // The Exercise is offline by construction: no vendor client, no key, no
  // network. A folder that reached for either would need an API account to
  // practise with, which is the whole thing this pilot avoids.
  it('imports no network client and reads no API key', () => {
    const sources = ['src/retrieval.py', 'tests/conftest.py', 'tests/test_chunk.py', 'tests/test_retrieve.py'];
    const forbidden = [
      'requests',
      'httpx',
      'urllib',
      'http.client',
      'socket',
      'openai',
      'langchain',
      'os.environ',
      'getenv',
      'API_KEY',
    ];

    for (const source of sources) {
      const text = read(source);
      for (const needle of forbidden) {
        expect(`${source}: ${text}`).not.toContain(needle);
      }
    }
  });

  // A construct Exercise ships a stub, not an answer: the two functions the
  // brief names raise until the learner writes them.
  it('ships both functions as stubs and the embedding as provided code', () => {
    const source = read('src/retrieval.py');

    expect(source).toContain('def chunk(text: str, size: int, overlap: int) -> list[str]:');
    expect(source).toContain('def retrieve(query: str, chunks: list[str], k: int) -> list[str]:');
    expect(source.match(/raise NotImplementedError/g)).toHaveLength(2);
    expect(source).toContain('def embed(text: str)');
    expect(source).toContain('def cosine_similarity(');
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

/**
 * The fork-bomb guard (#64). This file is part of the full suite and spawns
 * test-scoped.sh, so `FULL=1 scripts/test-scoped.sh` used to hand FULL=1 to
 * every child and re-enter the suite until the host fell over. Every case here
 * is bounded: the depth marker is set by hand and no child ever runs Vitest.
 */
describe('test-scoped.sh recursion guard (#64)', () => {
  it('hands no FULL down to a spawned process, whatever the parent holds', () => {
    const result = run('bash', ['-c', 'echo "FULL=${FULL:-unset}"']);

    expect(result.status).toBe(0);
    expect(result.lines[0]).toBe('FULL=unset');
  });

  it('exits 3 on a full-suite run nested inside a run', () => {
    const result = run('scripts/test-scoped.sh', [], {
      FULL: '1',
      KATA_TEST_SCOPED_DEPTH: '1',
    });

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('TEST RECURSION GUARD');
    expect(result.stdout).toContain('depth 1');
    // Refused before Vitest: no summary line, no run.
    expect(result.stdout).not.toContain('TEST ok');
  });

  it('exits 3 on any run nested more than one level deep', () => {
    const result = run('scripts/test-scoped.sh', ['scripts/harness.test.ts'], {
      KATA_TEST_SCOPED_DEPTH: '2',
    });

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('nested 2 deep');
  });

  it('still runs a scoped file one level down (the harness spawns are legal)', () => {
    const result = run('scripts/test-scoped.sh', ['src/nope.test.ts'], {
      KATA_TEST_SCOPED_DEPTH: '1',
    });

    expect(result.status).toBe(2); // precondition, not the guard
    expect(result.stdout).toContain('no such test file');
  });

  it('documents the guard and its exit code in --help', () => {
    const help = run('scripts/test-scoped.sh', ['--help']);

    expect(help.status).toBe(0);
    expect(help.stdout).toContain('3 recursion guard');
    expect(help.stdout).toContain('KATA_TEST_SCOPED_DEPTH');
  });
});

describe('smoke.sh', () => {
  it('fails on the first step with a short block and the log path', () => {
    // Port 9 (discard) is closed here: every request is refused, the way an
    // unreachable deploy behaves.
    const result = run('scripts/smoke.sh', [], { KATA_URL: 'http://127.0.0.1:9/' });

    expect(result.status).toBe(10); // 10 = app shell, per scripts/README.md
    expect(result.lines[0]).toMatch(/^SMOKE FAIL 0\/14 \| step shell \(exit 10\)/);
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
      '23 ai03 exercise folder',
    ]) {
      expect(help.stdout).toContain(code);
    }
  });
});

describe('build-exercises.sh (#22, #172)', () => {
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

  // The Python folders' check is `python -m pytest --collect-only`, so a fake
  // python answers both the precondition (`--version`) and the collect run —
  // pytest is not installed on every host that runs this suite, and the point
  // under test is the SCRIPT's branching, not pytest itself.
  function fakePython(exitCode: number) {
    const bin = mkdtempSync(join(tmpdir(), 'kata-python-'));
    writeFileSync(
      join(bin, 'python3'),
      // `--version` is the precondition probe and always answers yes; the
      // collect run is what the exit code under test belongs to.
      `#!/usr/bin/env bash\nfor arg in "$@"; do [[ "$arg" == "--version" ]] && exit 0; done\necho "fake python $*"\nexit ${exitCode}\n`,
      { mode: 0o755 },
    );
    return join(bin, 'python3');
  }

  function exerciseTree(...folders: string[]) {
    const dir = mkdtempSync(join(tmpdir(), 'kata-exercises-'));
    for (const folder of folders) {
      mkdirSync(join(dir, folder, 'src'), { recursive: true });
      writeFileSync(join(dir, folder, 'src', 'Exercise.csproj'), '<Project />\n');
    }
    return dir;
  }

  // A Python Exercise folder is the same layout with .py files and no csproj
  // (#172): exercises/<module>/<exercise>/{src,tests}.
  function pythonExerciseTree(...folders: string[]) {
    const dir = mkdtempSync(join(tmpdir(), 'kata-exercises-py-'));
    for (const folder of folders) {
      mkdirSync(join(dir, folder, 'src'), { recursive: true });
      mkdirSync(join(dir, folder, 'tests'), { recursive: true });
      writeFileSync(join(dir, folder, 'src', 'retrieval.py'), 'def chunk():\n    ...\n');
      writeFileSync(join(dir, folder, 'tests', 'test_chunk.py'), 'def test_it():\n    ...\n');
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
      'EXERCISES ok | 2/2 Test Suites ready',
    ]);
  });

  // The silent-skip guard (#172): discovery used to key on .csproj alone, so
  // a Python folder was passed over — new material with no CI coverage at
  // all. It is found by its .py files and checked with pytest instead.
  it('finds a Python Exercise folder and collects it instead of building (#172)', () => {
    const exercises = pythonExerciseTree('ai03/ai03-e1');
    const result = build({
      KATA_EXERCISES_DIR: exercises,
      KATA_PYTHON: fakePython(0),
    });
    rmSync(exercises, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(result.lines).toEqual([
      'ok exercises/ai03/ai03-e1',
      'EXERCISES ok | 1/1 Test Suites ready',
    ]);
  });

  it('checks C# and Python folders in one run (#172)', () => {
    const exercises = exerciseTree('m01/m01-e1');
    mkdirSync(join(exercises, 'ai03/ai03-e1/tests'), { recursive: true });
    writeFileSync(join(exercises, 'ai03/ai03-e1/tests/test_chunk.py'), 'def test_it():\n    ...\n');
    const result = build({
      KATA_EXERCISES_DIR: exercises,
      KATA_PYTHON: fakePython(0),
      PATH: `${fakeDotnet(0)}:${process.env.PATH}`,
    });
    rmSync(exercises, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(result.lines).toEqual([
      'ok exercises/ai03/ai03-e1',
      'ok exercises/m01/m01-e1',
      'EXERCISES ok | 2/2 Test Suites ready',
    ]);
  });

  it('exits 3 when a Python folder fails to collect (#172)', () => {
    const exercises = pythonExerciseTree('ai03/ai03-e1');
    const result = build({
      KATA_EXERCISES_DIR: exercises,
      KATA_PYTHON: fakePython(1),
    });
    rmSync(exercises, { recursive: true, force: true });

    expect(result.status).toBe(3);
    expect(result.lines[0]).toBe('FAIL exercises/ai03/ai03-e1');
    expect(result.stdout).toContain('EXERCISES FAIL 0/1 | broken: ai03/ai03-e1');
  });

  it('exits 2 when a Python folder is committed and pytest is missing (#172)', () => {
    const exercises = pythonExerciseTree('ai03/ai03-e1');
    const result = build({
      KATA_EXERCISES_DIR: exercises,
      KATA_PYTHON: join(tmpdir(), 'kata-no-python'),
    });
    rmSync(exercises, { recursive: true, force: true });

    expect(result.status).toBe(2);
    expect(result.stdout).toContain('EXERCISES PRECONDITION FAIL');
  });

  // The precondition follows the material: a repo with only C# folders must
  // not demand a Python toolchain, and the other way round (#172).
  it('demands no Python toolchain when only C# folders are committed (#172)', () => {
    const exercises = exerciseTree('m01/m01-e1');
    const result = build({
      KATA_EXERCISES_DIR: exercises,
      KATA_PYTHON: join(tmpdir(), 'kata-no-python'),
      PATH: `${fakeDotnet(0)}:${process.env.PATH}`,
    });
    rmSync(exercises, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(result.lines).toEqual([
      'ok exercises/m01/m01-e1',
      'EXERCISES ok | 1/1 Test Suites ready',
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
    for (const code of [
      '0 ok (including zero folders)',
      '2 usage/precondition',
      '3 one or more folders failed to build or collect',
    ]) {
      expect(help.stdout).toContain(code);
    }
  });
});
