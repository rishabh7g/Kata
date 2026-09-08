// ICurriculum — a pure function of content: reads the committed JSON, writes
// nothing, and reads no progress data at all. No DOM, no React.
//
// The HTTP ContentSource lives here too, being the only one the app builds.
// The type stays a seam because the tests' in-memory fake is a second
// implementation of it.
import type {
  Category,
  CategoryId,
  ContentSource,
  ICurriculum,
  ModuleContent,
  ModuleDetail,
  ModuleId,
  ModuleIndex,
  ModuleIndexEntry,
  ModuleSummary,
} from './contract';

/** An index entry with its Category, so the sort and the summary read one
 *  flat value instead of joining twice. */
interface PlacedModule {
  readonly entry: ModuleIndexEntry;
  readonly category: Category;
}

/** One load of the index, sorted the way everything reads it: Categories by
 *  ordinal, Modules by Category ordinal then their own. */
interface LoadedIndex {
  readonly categories: readonly Category[];
  readonly modules: readonly PlacedModule[];
}

export function createCurriculum(content: ContentSource): ICurriculum {
  // Content is committed and immutable per deploy, so every method may cache
  // it in memory — the only state this function holds.
  let indexPromise: Promise<LoadedIndex> | null = null;
  const contentCache = new Map<ModuleId, ModuleContent>();

  function loadedIndex(): Promise<LoadedIndex> {
    indexPromise ??= content
      .loadIndex()
      .then((index): LoadedIndex => {
        const categories = new Map<CategoryId, Category>(
          index.categories.map((category) => [category.id, category]),
        );
        // A Module naming an undeclared Category is a content error the schema
        // rejects before a deploy (docs/02-engineering.md § 3); at runtime it is
        // simply not placed, so the shelf shows what it can rather than
        // throwing a screen away.
        const placed: PlacedModule[] = [];
        for (const entry of index.modules) {
          const category = categories.get(entry.categoryId);
          if (category !== undefined) placed.push({ entry, category });
        }
        // Category ordinal first, then the Module's ordinal within it: the
        // Curriculum reads shelf by shelf, in the order the data gives.
        placed.sort(
          (a, b) => a.category.ordinal - b.category.ordinal || a.entry.ordinal - b.entry.ordinal,
        );
        // The shelves themselves, in their own ordinal order — what the
        // Curriculum's Category headings read. Sorted here, from a
        // copy, so no caller depends on the authored file order either.
        const shelves = [...index.categories].sort((a, b) => a.ordinal - b.ordinal);
        return { categories: shelves, modules: placed };
      })
      .catch((error: unknown) => {
        // A failed load is not an answer worth caching: drop it so the next
        // call fetches again instead of replaying the rejection forever —
        // otherwise a screen that offers `Try again` after an offline failure
        // could never succeed, even back online.
        indexPromise = null;
        throw error;
      });
    return indexPromise;
  }

  async function loadContent(id: ModuleId): Promise<ModuleContent> {
    const cached = contentCache.get(id);
    if (cached !== undefined) return cached;
    const loaded = await content.loadModuleContent(id);
    contentCache.set(id, loaded);
    return loaded;
  }

  // A ModuleSummary is the index entry plus its Category's id and language,
  // denormalized so a screen never joins the two arrays itself. No state of
  // the reader is derived here, so every row reads the same on any browser.
  function summarize({ entry, category }: PlacedModule): ModuleSummary {
    return {
      id: entry.id,
      categoryId: category.id,
      language: category.language,
      ordinal: entry.ordinal,
      title: entry.title,
      description: entry.description,
    };
  }

  return {
    async getCategories(): Promise<readonly Category[]> {
      // Exactly as authored, in ordinal order — the Curriculum's headings
      //. A Category is a label over its rows: nothing here is a route
      // and nothing here reads the reader.
      const { categories } = await loadedIndex();
      return categories;
    },

    async getModules(): Promise<readonly ModuleSummary[]> {
      const { modules } = await loadedIndex();
      return modules.map(summarize);
    },

    async getModule(id: ModuleId): Promise<ModuleDetail | null> {
      const { modules } = await loadedIndex();
      const placed = modules.find((p) => p.entry.id === id);
      // Unknown id: null — never throw, never invent a Module.
      if (placed === undefined) return null;

      // A rejection here reaches the screen as an unavailable Module with a
      // retry, which is what a missing or unreadable content file is.
      const moduleContent = await loadContent(id);
      return {
        ...summarize(placed),
        conceptPageMarkdown: moduleContent.conceptPageMarkdown,
        modelExamples: moduleContent.modelExamples,
        exercises: moduleContent.exercises,
        selfCheckQuestions: moduleContent.selfCheckQuestions,
      };
    },
  };
}

// ── The one ContentSource the app builds ─────────────────────────────────

export function createHttpContentSource(baseUrl: string): ContentSource {
  return {
    async loadIndex(): Promise<ModuleIndex> {
      const response = await fetch(`${baseUrl}content/index.json`);
      if (!response.ok) {
        throw new Error(`Failed to load module index: HTTP ${response.status}`);
      }
      return (await response.json()) as ModuleIndex;
    },

    async loadModuleContent(id: ModuleId): Promise<ModuleContent> {
      const response = await fetch(`${baseUrl}content/modules/${id}.json`);
      // Every indexed Module has a file, so a 404 is a content error like any
      // other status: the screen says the Module is unavailable and offers a
      // retry, rather than rendering an empty Module as if it were finished.
      if (!response.ok) {
        throw new Error(`Failed to load content for ${id}: HTTP ${response.status}`);
      }
      return (await response.json()) as ModuleContent;
    },
  };
}
