// ICurriculum — docs/engineering.md § ICurriculum — behaviour.
//
// A pure function of content: reads the committed content JSON through the
// ContentSource seam and writes nothing, ever. It reads no progress data at
// all — the Library has no lock chain to derive (#158). Pure TypeScript — no
// DOM, no React.
import type {
  Category,
  CategoryId,
  ContentSource,
  ICurriculum,
  ModuleContent,
  ModuleDetail,
  ModuleId,
  ModuleIndexEntry,
  ModuleSummary,
} from './contract';

/** An index entry paired with the Category it was authored under, so both the
 *  sort and the summary read one flat value instead of joining twice. */
interface PlacedModule {
  readonly entry: ModuleIndexEntry;
  readonly category: Category;
}

/** One load of the committed index, in the order everything reads it: the
 *  Categories by their own ordinal, and every placed Module by Category
 *  ordinal then Module ordinal. */
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
        // rejects before a deploy (docs/engineering.md § 3); at runtime it is
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
          (a, b) =>
            a.category.ordinal - b.category.ordinal || a.entry.ordinal - b.entry.ordinal,
        );
        // The shelves themselves, in their own ordinal order — what the
        // Curriculum's Category headings read (#163). Sorted here, from a
        // copy, so no caller depends on the authored file order either.
        const shelves = [...index.categories].sort(
          (a, b) => a.ordinal - b.ordinal,
        );
        return { categories: shelves, modules: placed };
      })
      .catch((error: unknown) => {
        // A failed load is not an answer worth caching: drop it so the next
        // call fetches again instead of replaying the rejection forever —
        // otherwise a screen that offers `Try again` after an offline failure
        // could never succeed, even back online (#69).
        indexPromise = null;
        throw error;
      });
    return indexPromise;
  }

  async function loadContent(id: ModuleId): Promise<ModuleContent | null> {
    const cached = contentCache.get(id);
    if (cached !== undefined) return cached;
    const loaded = await content.loadModuleContent(id);
    if (loaded !== null) contentCache.set(id, loaded);
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
      pending: entry.pending,
    };
  }

  return {
    async getCategories(): Promise<readonly Category[]> {
      // Exactly as authored, in ordinal order — the Curriculum's headings
      // (#163). A Category is a label over its rows: nothing here is a route
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

      const summary = summarize(placed);
      // A pending Module has no content file; a non-pending Module whose file
      // is missing is a content error CI should have caught — at runtime both
      // fall back to the pending shape so a screen never goes blank.
      const moduleContent = placed.entry.pending ? null : await loadContent(id);
      if (moduleContent === null) {
        return {
          ...summary,
          pending: true,
          conceptPageMarkdown: '',
          modelExamples: [],
          exercises: [],
          selfCheckQuestions: [],
        };
      }
      return {
        ...summary,
        conceptPageMarkdown: moduleContent.conceptPageMarkdown,
        modelExamples: moduleContent.modelExamples,
        exercises: moduleContent.exercises,
        selfCheckQuestions: moduleContent.selfCheckQuestions,
      };
    },
  };
}
