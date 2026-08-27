// Written from docs/engineering.md § ICurriculum — behaviour, BEFORE the
// implementation exists (Module 0 discipline: tests come from the doc, the
// code comes from the tests). The seam is exactly the one the doc names, and
// since #158 the only one: an in-memory ContentSource.
import { describe, expect, it } from 'vitest';
import type {
  ChecklistQuestion,
  ContentSource,
  ModuleContent,
  ModuleId,
  ModuleIndex,
} from './contract';
import { createCurriculum } from './curriculum';

// ── Fixtures: the real committed shapes, in miniature ─────────────────────

// One Category, its Modules deliberately NOT in ordinal order — order must
// come from the data, never from the file order.
const index: ModuleIndex = {
  schemaVersion: 2,
  categories: [
    { id: 'software-design', ordinal: 1, title: 'Software Design', description: 'Design fundamentals in C#.', language: 'csharp' },
  ],
  modules: [
    { id: 'm03', categoryId: 'software-design', ordinal: 3, title: 'Testing at Boundaries', description: 'Test the Target Interface.', pending: true },
    { id: 'm01', categoryId: 'software-design', ordinal: 1, title: 'Deep Modules', description: 'Hide complexity.', pending: false },
    { id: 'm05', categoryId: 'software-design', ordinal: 5, title: 'Error Design', description: 'Define errors out of existence.', pending: true },
    { id: 'm02', categoryId: 'software-design', ordinal: 2, title: 'Dependency Direction', description: 'Point at abstractions.', pending: false },
    { id: 'm04', categoryId: 'software-design', ordinal: 4, title: 'Naming', description: 'Ubiquitous Language.', pending: true },
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

// ── getModules: ordering and the shape of a summary ───────────────────────

describe('getModules ordering', () => {
  it('returns every Module sorted by ordinal ascending, not file order', async () => {
    const curriculum = createCurriculum(memorySource());

    const modules = await curriculum.getModules();

    expect(modules.map((m) => m.id)).toEqual(['m01', 'm02', 'm03', 'm04', 'm05']);
    expect(modules.map((m) => m.ordinal)).toEqual([1, 2, 3, 4, 5]);
  });

  it('summarises the index entry plus its Category — no state of the reader', async () => {
    // The lock chain is gone (#158): ICurriculum takes content alone, so a
    // summary has no field derived from progress left to carry, and every
    // reader sees the same five rows. What it does carry is its Category's id
    // and language (#160), denormalized so a screen never joins the arrays.
    const curriculum = createCurriculum(memorySource());

    const modules = await curriculum.getModules();

    expect(modules[0]).toEqual({
      id: 'm01',
      categoryId: 'software-design',
      language: 'csharp',
      ordinal: 1,
      title: 'Deep Modules',
      description: 'Hide complexity.',
      pending: false,
    });
    expect(createCurriculum).toHaveLength(1);
  });

  it('gives every Module a non-empty categoryId and its Category language', async () => {
    const curriculum = createCurriculum(memorySource());

    const modules = await curriculum.getModules();

    expect(modules).toHaveLength(5);
    expect(modules.every((m) => m.categoryId.length > 0)).toBe(true);
    expect(modules.map((m) => m.language)).toEqual(Array(5).fill('csharp'));
  });

  it('orders by Category ordinal first, then Module ordinal within it (#160)', async () => {
    // Two Categories, each with its own 1-based contiguous ordinals — so a
    // sort on the Module ordinal alone would interleave the two shelves.
    const twoCategories: ModuleIndex = {
      schemaVersion: 2,
      categories: [
        { id: 'agentic-ai', ordinal: 2, title: 'Agentic AI', description: 'Agents in Python.', language: 'python' },
        { id: 'software-design', ordinal: 1, title: 'Software Design', description: 'Design fundamentals in C#.', language: 'csharp' },
      ],
      modules: [
        { id: 'm07', categoryId: 'agentic-ai', ordinal: 2, title: 'Tools', description: 'Give the agent hands.', pending: true },
        { id: 'm02', categoryId: 'software-design', ordinal: 2, title: 'Dependency Direction', description: 'Point at abstractions.', pending: true },
        { id: 'm06', categoryId: 'agentic-ai', ordinal: 1, title: 'Prompts', description: 'Say what you want.', pending: true },
        { id: 'm01', categoryId: 'software-design', ordinal: 1, title: 'Deep Modules', description: 'Hide complexity.', pending: true },
      ],
    };
    const curriculum = createCurriculum({
      loadIndex: async () => twoCategories,
      loadModuleContent: async () => null,
    });

    const modules = await curriculum.getModules();

    expect(modules.map((m) => m.id)).toEqual(['m01', 'm02', 'm06', 'm07']);
    expect(modules.map((m) => m.language)).toEqual(['csharp', 'csharp', 'python', 'python']);
  });

  it('leaves out a Module whose categoryId names no declared Category', async () => {
    // The schema rejects such an index before it can deploy, so the runtime
    // rule is only that a screen never goes blank over it: unplaceable, so
    // not placed.
    const dangling: ModuleIndex = {
      ...index,
      modules: [
        ...index.modules,
        { id: 'm09', categoryId: 'nowhere', ordinal: 1, title: 'Orphan', description: 'No shelf.', pending: true },
      ],
    };
    const curriculum = createCurriculum({
      loadIndex: async () => dangling,
      loadModuleContent: async () => null,
    });

    expect((await curriculum.getModules()).map((m) => m.id)).not.toContain('m09');
    await expect(curriculum.getModule('m09')).resolves.toBeNull();
  });
});

// ── getModule: detail, pending, unknown id ─────────────────────────────────

describe('getModule', () => {
  it('returns full detail for an authored Module', async () => {
    const curriculum = createCurriculum(memorySource());

    const detail = await curriculum.getModule('m01');

    expect(detail).not.toBeNull();
    expect(detail?.conceptPageMarkdown).toBe('# Module m01');
    expect(detail?.modelExamples).toHaveLength(2);
    expect(detail?.exercises.map((e) => e.type)).toEqual(['refactor', 'construct']);
    expect(detail?.checklistQuestions).toHaveLength(3);
    expect(detail?.pending).toBe(false);
  });

  it('returns null for an unknown id — never throws, never invents a Module', async () => {
    const curriculum = createCurriculum(memorySource());

    await expect(curriculum.getModule('m99')).resolves.toBeNull();
  });

  it('surfaces the pending flag with empty content for a pending Module', async () => {
    const curriculum = createCurriculum(memorySource());

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
    );

    await expect(curriculum.getModule('m01')).rejects.toThrow('Failed to fetch');

    expect((await curriculum.getModule('m01'))?.title).toBe('Deep Modules');
    expect(attempts).toBe(2);
  });

  it('answers for every Module, whatever its position — nothing waits on another', async () => {
    const curriculum = createCurriculum(memorySource());

    const detail = await curriculum.getModule('m02');

    expect(detail).not.toBeNull();
    expect(detail?.title).toBe('Dependency Direction');
  });
});
