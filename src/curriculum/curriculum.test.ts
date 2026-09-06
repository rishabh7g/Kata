// Written from docs/engineering.md § ICurriculum — behaviour, BEFORE the
// implementation exists (Module 0 discipline: tests come from the doc, the
// code comes from the tests). The seam is exactly the one the doc names, and
// since #158 the only one: an in-memory ContentSource.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  SelfCheckQuestion,
  ContentSource,
  ModuleContent,
  ModuleId,
  ModuleIndex,
} from './contract';
import { createCurriculum, createHttpContentSource } from './curriculum';

// ── Fixtures: the real committed shapes, in miniature ─────────────────────

// One Category, its Modules deliberately NOT in ordinal order — order must
// come from the data, never from the file order.
const index: ModuleIndex = {
  schemaVersion: 3,
  categories: [
    { id: 'software-design', ordinal: 1, title: 'Software Design', description: 'Design fundamentals in C#.', language: 'csharp' },
  ],
  modules: [
    { id: 'm03', categoryId: 'software-design', ordinal: 3, title: 'Testing at Boundaries', description: 'Test the Target Interface.' },
    { id: 'm01', categoryId: 'software-design', ordinal: 1, title: 'Deep Modules', description: 'Hide complexity.' },
    { id: 'm05', categoryId: 'software-design', ordinal: 5, title: 'Error Design', description: 'Define errors out of existence.' },
    { id: 'm02', categoryId: 'software-design', ordinal: 2, title: 'Dependency Direction', description: 'Point at abstractions.' },
    { id: 'm04', categoryId: 'software-design', ordinal: 4, title: 'Naming', description: 'Ubiquitous Language.' },
  ],
};

const questions: readonly [SelfCheckQuestion, SelfCheckQuestion, SelfCheckQuestion] = [
  { id: 'q1', prompt: 'Count the pass-throughs?', options: [{ value: '0', label: '0' }, { value: '1+', label: '1 or more' }] },
  { id: 'q2', prompt: 'Any required call order?', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }] },
  { id: 'q3', prompt: 'Grep found duplicates?', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }] },
];

function contentFor(id: ModuleId): ModuleContent {
  return {
    schemaVersion: 2,
    id,
    provenance: 'LLM first draft · unedited',
    conceptPageMarkdown: `## Module ${id}`,
    modelExamples: [
      { before: 'class A {}', after: 'class B {}', caption: 'what moved' },
      { before: 'class C {}', after: 'class D {}', caption: 'what hid' },
    ],
    exercises: [
      { id: `${id}-e1`, type: 'refactor', title: 'Refactor', concept: 'depth', smell: 'leak', targetInterfaceCode: 'interface I {}', sizeBudgetLoc: 120, folderUrl: null },
      { id: `${id}-e2`, type: 'construct', title: 'Construct', concept: 'depth', smell: 'none', targetInterfaceCode: 'interface J {}', sizeBudgetLoc: 200, folderUrl: null },
    ],
    selfCheckQuestions: questions,
  };
}

/** In-memory ContentSource: every indexed Module has a content file. */
function memorySource(overrides?: Partial<ContentSource>): ContentSource {
  return {
    loadIndex: async () => index,
    loadModuleContent: async (id) => {
      const entry = index.modules.find((m) => m.id === id);
      if (entry === undefined) throw new Error(`no content file for ${id}`);
      return contentFor(id);
    },
    ...overrides,
  };
}

// ── getCategories: the shelves the Curriculum groups its rows under ───────

describe('getCategories', () => {
  it('returns every Category exactly as authored', async () => {
    const curriculum = createCurriculum(memorySource());

    const categories = await curriculum.getCategories();

    expect(categories).toEqual([
      {
        id: 'software-design',
        ordinal: 1,
        title: 'Software Design',
        description: 'Design fundamentals in C#.',
        language: 'csharp',
      },
    ]);
  });

  it('sorts by ordinal ascending, not file order (#163)', async () => {
    // Authored second-shelf-first, so file order and ordinal order disagree.
    const curriculum = createCurriculum({
      loadIndex: async () => ({
        schemaVersion: 3,
        categories: [
          { id: 'agentic-ai', ordinal: 2, title: 'Agentic AI', description: 'Agents in Python.', language: 'python' },
          { id: 'software-design', ordinal: 1, title: 'Software Design', description: 'Design fundamentals in C#.', language: 'csharp' },
        ],
        modules: [],
      }),
      loadModuleContent: async (id) => contentFor(id),
    });

    const categories = await curriculum.getCategories();

    expect(categories.map((c) => c.id)).toEqual(['software-design', 'agentic-ai']);
    expect(categories.map((c) => c.language)).toEqual(['csharp', 'python']);
  });

  it('returns every Category, whatever its Modules hold', async () => {
    // The Library never hides a shelf that has not been written yet (#165):
    const curriculum = createCurriculum({
      loadIndex: async () => ({
        schemaVersion: 3,
        categories: [
          { id: 'agentic-ai', ordinal: 1, title: 'Agentic AI', description: 'Agents in Python.', language: 'python' },
        ],
        modules: [
          { id: 'm06', categoryId: 'agentic-ai', ordinal: 1, title: 'Prompts', description: 'Say what you want.' },
        ],
      }),
      loadModuleContent: async (id) => contentFor(id),
    });

    expect((await curriculum.getCategories()).map((c) => c.title)).toEqual([
      'Agentic AI',
    ]);
  });

  it('reads the same cached index the Modules come from', async () => {
    let loads = 0;
    const curriculum = createCurriculum({
      loadIndex: async () => {
        loads += 1;
        return index;
      },
      loadModuleContent: async (id) => contentFor(id),
    });

    await curriculum.getCategories();
    await curriculum.getModules();
    await curriculum.getCategories();

    expect(loads).toBe(1);
  });
});

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
      schemaVersion: 3,
      categories: [
        { id: 'agentic-ai', ordinal: 2, title: 'Agentic AI', description: 'Agents in Python.', language: 'python' },
        { id: 'software-design', ordinal: 1, title: 'Software Design', description: 'Design fundamentals in C#.', language: 'csharp' },
      ],
      modules: [
        { id: 'm07', categoryId: 'agentic-ai', ordinal: 2, title: 'Tools', description: 'Give the agent hands.' },
        { id: 'm02', categoryId: 'software-design', ordinal: 2, title: 'Dependency Direction', description: 'Point at abstractions.' },
        { id: 'm06', categoryId: 'agentic-ai', ordinal: 1, title: 'Prompts', description: 'Say what you want.' },
        { id: 'm01', categoryId: 'software-design', ordinal: 1, title: 'Deep Modules', description: 'Hide complexity.' },
      ],
    };
    const curriculum = createCurriculum({
      loadIndex: async () => twoCategories,
      loadModuleContent: async (id) => contentFor(id),
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
        { id: 'm09', categoryId: 'nowhere', ordinal: 1, title: 'Orphan', description: 'No shelf.' },
      ],
    };
    const curriculum = createCurriculum({
      loadIndex: async () => dangling,
      loadModuleContent: async (id) => contentFor(id),
    });

    expect((await curriculum.getModules()).map((m) => m.id)).not.toContain('m09');
    await expect(curriculum.getModule('m09')).resolves.toBeNull();
  });
});

// ── getModule: detail, unknown id, a content file that will not load ──────

describe('getModule', () => {
  it('returns full detail for an authored Module', async () => {
    const curriculum = createCurriculum(memorySource());

    const detail = await curriculum.getModule('m01');

    expect(detail).not.toBeNull();
    expect(detail?.conceptPageMarkdown).toBe('## Module m01');
    expect(detail?.modelExamples).toHaveLength(2);
    expect(detail?.exercises.map((e) => e.type)).toEqual(['refactor', 'construct']);
    expect(detail?.selfCheckQuestions).toHaveLength(3);
  });

  it('returns null for an unknown id — never throws, never invents a Module', async () => {
    const curriculum = createCurriculum(memorySource());

    await expect(curriculum.getModule('m99')).resolves.toBeNull();
  });

  it('rejects when the content load fails, so the screen can say so', async () => {
    // The screen tells a failure apart from a still-loading Module by this
    // rejection; without it an offline Module blanks forever.
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

// ── createHttpContentSource: the URLs it builds, the failures it passes on ─

function stubFetch(responder: (url: string) => Response) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
    responder(String(input)),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createHttpContentSource', () => {
  it('loads the index from <base>content/index.json', async () => {
    const fetchMock = stubFetch(() => Response.json(index));

    const loaded = await createHttpContentSource('/Kata/').loadIndex();

    expect(fetchMock).toHaveBeenCalledWith('/Kata/content/index.json');
    expect(loaded).toEqual(index);
  });

  it('passes the Categories and each Module\'s categoryId through untouched', async () => {
    stubFetch(() => Response.json(index));

    const loaded = await createHttpContentSource('/Kata/').loadIndex();

    expect(loaded.categories).toEqual(index.categories);
    expect(loaded.modules.map((m) => m.categoryId)).toEqual(
      index.modules.map((m) => m.categoryId),
    );
  });

  it('loads a Module content file from <base>content/modules/<id>.json', async () => {
    const content = { schemaVersion: 2, id: 'm01' };
    const fetchMock = stubFetch(() => Response.json(content));

    const loaded = await createHttpContentSource('/Kata/').loadModuleContent('m01');

    expect(fetchMock).toHaveBeenCalledWith('/Kata/content/modules/m01.json');
    expect(loaded).toEqual(content);
  });

  it('rejects on a 404 — every indexed Module has a content file', async () => {
    stubFetch(() => new Response('not found', { status: 404 }));

    await expect(
      createHttpContentSource('/Kata/').loadModuleContent('m02'),
    ).rejects.toThrow(/404/);
  });

  it('propagates a failed Module fetch — offline is not a missing file', async () => {
    // The rejection has to reach the screen so it can say "not available"
    // and offer a retry, rather than blanking on a Module that loads fine
    // once the reader is back online.
    const failure = new TypeError('Failed to fetch');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw failure;
      }),
    );

    await expect(
      createHttpContentSource('/Kata/').loadModuleContent('m03'),
    ).rejects.toThrow(failure);
  });

  it('throws on a non-404 failure loading the index', async () => {
    stubFetch(() => new Response('boom', { status: 500 }));

    await expect(createHttpContentSource('/Kata/').loadIndex()).rejects.toThrow();
  });
});
