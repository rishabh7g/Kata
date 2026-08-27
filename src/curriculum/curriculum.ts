// ICurriculum — docs/engineering.md § ICurriculum — behaviour.
//
// A pure function of content: reads the committed content JSON through the
// ContentSource seam and writes nothing, ever. It reads no progress data at
// all — the Library has no lock chain to derive (#158). Pure TypeScript — no
// DOM, no React.
import type {
  ContentSource,
  ICurriculum,
  ModuleContent,
  ModuleDetail,
  ModuleId,
  ModuleIndexEntry,
  ModuleSummary,
} from './contract';

export function createCurriculum(content: ContentSource): ICurriculum {
  // Content is committed and immutable per deploy, so both methods may cache
  // it in memory — the only state this function holds.
  let indexPromise: Promise<readonly ModuleIndexEntry[]> | null = null;
  const contentCache = new Map<ModuleId, ModuleContent>();

  function orderedEntries(): Promise<readonly ModuleIndexEntry[]> {
    indexPromise ??= content
      .loadIndex()
      .then((index) => [...index.modules].sort((a, b) => a.ordinal - b.ordinal))
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

  // A ModuleSummary is the index entry and nothing else: no state of the
  // reader is derived here, so every row reads the same on any browser.
  function summarize(entry: ModuleIndexEntry): ModuleSummary {
    return {
      id: entry.id,
      ordinal: entry.ordinal,
      title: entry.title,
      description: entry.description,
      pending: entry.pending,
    };
  }

  return {
    async getModules(): Promise<readonly ModuleSummary[]> {
      const entries = await orderedEntries();
      return entries.map(summarize);
    },

    async getModule(id: ModuleId): Promise<ModuleDetail | null> {
      const entries = await orderedEntries();
      const entry = entries.find((e) => e.id === id);
      // Unknown id: null — never throw, never invent a Module.
      if (entry === undefined) return null;

      const summary = summarize(entry);
      // A pending Module has no content file; a non-pending Module whose file
      // is missing is a content error CI should have caught — at runtime both
      // fall back to the pending shape so a screen never goes blank.
      const moduleContent = entry.pending ? null : await loadContent(id);
      if (moduleContent === null) {
        return {
          ...summary,
          pending: true,
          conceptPageMarkdown: '',
          modelExamples: [],
          exercises: [],
          checklistQuestions: [],
        };
      }
      return {
        ...summary,
        conceptPageMarkdown: moduleContent.conceptPageMarkdown,
        modelExamples: moduleContent.modelExamples,
        exercises: moduleContent.exercises,
        checklistQuestions: moduleContent.checklistQuestions,
      };
    },
  };
}
