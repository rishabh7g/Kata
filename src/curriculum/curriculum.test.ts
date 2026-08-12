// Written from docs/engineering.md § ICurriculum — behaviour, BEFORE the
// implementation exists (Module 0 discipline: tests come from the doc, the
// code comes from the tests). The seam is exactly the one the doc names:
// an in-memory ContentSource and a two-line CheckpointReader stub.
import { describe, expect, it } from 'vitest';
import type {
  Checkpoint,
  ChecklistQuestion,
  ContentSource,
  ModuleContent,
  ModuleId,
  ModuleIndex,
} from './contract';
import { createCurriculum } from './curriculum';

// ── Fixtures: the real committed shapes, in miniature ─────────────────────

// Deliberately NOT in ordinal order — order must come from the data,
// never from the file order.
const index: ModuleIndex = {
  schemaVersion: 1,
  modules: [
    { id: 'm03', ordinal: 3, title: 'Testing at Boundaries', description: 'Test the Target Interface.', pending: true },
    { id: 'm01', ordinal: 1, title: 'Deep Modules', description: 'Hide complexity.', pending: false },
    { id: 'm05', ordinal: 5, title: 'Error Design', description: 'Define errors out of existence.', pending: true },
    { id: 'm02', ordinal: 2, title: 'Dependency Direction', description: 'Point at abstractions.', pending: false },
    { id: 'm04', ordinal: 4, title: 'Naming', description: 'Ubiquitous Language.', pending: true },
  ],
};

const questions: readonly [ChecklistQuestion, ChecklistQuestion, ChecklistQuestion] = [
  { id: 'q1', prompt: 'Count the pass-throughs?', options: [{ value: '0', label: '0' }, { value: '1+', label: '1 or more' }] },
  { id: 'q2', prompt: 'Any required call order?', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }] },
  { id: 'q3', prompt: 'Grep found duplicates?', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }] },
];

function contentFor(id: ModuleId): ModuleContent {
  return {
    schemaVersion: 1,
    id,
    conceptPageMarkdown: `# Module ${id}`,
    modelExamples: [
      { before: 'class A {}', after: 'class B {}', caption: 'what moved' },
      { before: 'class C {}', after: 'class D {}', caption: 'what hid' },
    ],
    exercises: [
      { id: `${id}-e1`, type: 'refactor', title: 'Refactor', concept: 'depth', smell: 'leak', targetInterfaceCode: 'interface I {}', sizeBudgetLoc: 120, folderUrl: null },
      { id: `${id}-e2`, type: 'construct', title: 'Construct', concept: 'depth', smell: 'none', targetInterfaceCode: 'interface J {}', sizeBudgetLoc: 200, folderUrl: null },
    ],
    checklistQuestions: questions,
  };
}

/** In-memory ContentSource: non-pending Modules have content, pending have none. */
function memorySource(overrides?: Partial<ContentSource>): ContentSource {
  return {
    loadIndex: async () => index,
    loadModuleContent: async (id) => {
      const entry = index.modules.find((m) => m.id === id);
      return entry === undefined || entry.pending ? null : contentFor(id);
    },
    ...overrides,
  };
}

function checkpoints(...moduleIds: readonly ModuleId[]) {
  const list: readonly Checkpoint[] = moduleIds.map((moduleId, i) => ({
    moduleId,
    passedAt: `2026-08-0${i + 1}T09:00:00.000Z`,
  }));
  return { listCheckpoints: async () => list };
}

// ── getModules: ordering ───────────────────────────────────────────────────

describe('getModules ordering', () => {
  it('returns every Module sorted by ordinal ascending, not file order', async () => {
    const curriculum = createCurriculum(memorySource(), checkpoints());

    const modules = await curriculum.getModules();

    expect(modules.map((m) => m.id)).toEqual(['m01', 'm02', 'm03', 'm04', 'm05']);
    expect(modules.map((m) => m.ordinal)).toEqual([1, 2, 3, 4, 5]);
  });
});

// ── The lock chain — the only unlock rule in the system ───────────────────

describe('lock chain', () => {
  it('with 0 Checkpoints only the ordinal-1 Module is unlocked', async () => {
    const curriculum = createCurriculum(memorySource(), checkpoints());

    const modules = await curriculum.getModules();

    expect(modules.map((m) => m.unlocked)).toEqual([true, false, false, false, false]);
    expect(modules.every((m) => m.checkpointAt === null)).toBe(true);
  });

  it('with the m01 Checkpoint, Modules 1–2 are unlocked and 3–5 locked', async () => {
    const curriculum = createCurriculum(memorySource(), checkpoints('m01'));

    const modules = await curriculum.getModules();

    expect(modules.map((m) => m.unlocked)).toEqual([true, true, false, false, false]);
    expect(modules[0]?.checkpointAt).toBe('2026-08-01T09:00:00.000Z');
    expect(modules[1]?.checkpointAt).toBeNull();
  });

  it('with all Checkpoints every Module is unlocked, each with its own checkpointAt', async () => {
    const curriculum = createCurriculum(
      memorySource(),
      checkpoints('m01', 'm02', 'm03', 'm04', 'm05'),
    );

    const modules = await curriculum.getModules();

    expect(modules.every((m) => m.unlocked)).toBe(true);
    expect(modules.every((m) => m.checkpointAt !== null)).toBe(true);
  });

  it('applies rule 2 as written to a gapped state (importState can produce one)', async () => {
    // A Checkpoint for m02 only: m01 by rule 1, m03 iff m02 has one. m02 stays
    // locked — nothing else affects lock state.
    const curriculum = createCurriculum(memorySource(), checkpoints('m02'));

    const modules = await curriculum.getModules();

    expect(modules.map((m) => m.unlocked)).toEqual([true, false, true, false, false]);
  });

  it('reads Checkpoints on every call, so a fresh Checkpoint shows without a reload', async () => {
    let list: readonly Checkpoint[] = [];
    const curriculum = createCurriculum(memorySource(), {
      listCheckpoints: async () => list,
    });

    const before = await curriculum.getModules();
    list = [{ moduleId: 'm01', passedAt: '2026-08-12T09:41:00.000Z' }];
    const after = await curriculum.getModules();

    expect(before[1]?.unlocked).toBe(false);
    expect(after[1]?.unlocked).toBe(true);
  });
});

// ── getModule: detail, pending, unknown id ─────────────────────────────────

describe('getModule', () => {
  it('returns full detail for an authored Module', async () => {
    const curriculum = createCurriculum(memorySource(), checkpoints());

    const detail = await curriculum.getModule('m01');

    expect(detail).not.toBeNull();
    expect(detail?.conceptPageMarkdown).toBe('# Module m01');
    expect(detail?.modelExamples).toHaveLength(2);
    expect(detail?.exercises.map((e) => e.type)).toEqual(['refactor', 'construct']);
    expect(detail?.checklistQuestions).toHaveLength(3);
    expect(detail?.pending).toBe(false);
  });

  it('returns null for an unknown id — never throws, never invents a Module', async () => {
    const curriculum = createCurriculum(memorySource(), checkpoints());

    await expect(curriculum.getModule('m99')).resolves.toBeNull();
  });

  it('surfaces the pending flag with empty content for a pending Module', async () => {
    const curriculum = createCurriculum(memorySource(), checkpoints());

    const detail = await curriculum.getModule('m03');

    expect(detail?.pending).toBe(true);
    expect(detail?.conceptPageMarkdown).toBe('');
    expect(detail?.modelExamples).toEqual([]);
    expect(detail?.exercises).toEqual([]);
    expect(detail?.checklistQuestions).toEqual([]);
  });

  it('falls back to the pending shape when a non-pending Module has no content file', async () => {
    // A content error CI should have caught; the screen must never go blank.
    const curriculum = createCurriculum(
      memorySource({ loadModuleContent: async () => null }),
      checkpoints(),
    );

    const detail = await curriculum.getModule('m01');

    expect(detail?.pending).toBe(true);
    expect(detail?.conceptPageMarkdown).toBe('');
    expect(detail?.exercises).toEqual([]);
  });

  it('rejects when the content load fails — not the pending shape (#69)', async () => {
    // A missing file is pending (above); a failed request is a failure. They
    // must stay apart, or an offline Module renders as "content pending".
    const curriculum = createCurriculum(
      memorySource({
        loadModuleContent: async () => {
          throw new TypeError('Failed to fetch');
        },
      }),
      checkpoints(),
    );

    await expect(curriculum.getModule('m01')).rejects.toThrow('Failed to fetch');
  });

  it('re-reads the index after a failed load rather than replaying it (#69)', async () => {
    // The index is cached because content is immutable per deploy — but a
    // rejection is not content. Caching one would make `Try again` useless:
    // every later call would fail with the offline error, back online or not.
    let attempts = 0;
    const curriculum = createCurriculum(
      memorySource({
        loadIndex: async () => {
          attempts += 1;
          if (attempts === 1) throw new TypeError('Failed to fetch');
          return index;
        },
      }),
      checkpoints(),
    );

    await expect(curriculum.getModule('m01')).rejects.toThrow('Failed to fetch');

    expect((await curriculum.getModule('m01'))?.title).toBe('Deep Modules');
    expect(attempts).toBe(2);
  });

  it('does not gate on lock state: a locked Module still returns its detail', async () => {
    const curriculum = createCurriculum(memorySource(), checkpoints());

    const detail = await curriculum.getModule('m02');

    expect(detail).not.toBeNull();
    expect(detail?.unlocked).toBe(false);
  });
});
