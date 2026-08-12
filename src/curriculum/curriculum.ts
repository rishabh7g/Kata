// ICurriculum — docs/engineering.md § ICurriculum — behaviour.
//
// A pure function of (content, Checkpoints): reads the committed content JSON
// through the ContentSource seam, derives the lock chain from CheckpointReader,
// and writes nothing, ever. Pure TypeScript — no DOM, no React.
import type {
  Checkpoint,
  CheckpointReader,
  ContentSource,
  ICurriculum,
  ModuleContent,
  ModuleDetail,
  ModuleId,
  ModuleIndexEntry,
  ModuleSummary,
} from './contract';

export function createCurriculum(
  content: ContentSource,
  checkpoints: CheckpointReader,
): ICurriculum {
  // Content is committed and immutable per deploy, so both methods may cache
  // it in memory. Checkpoints are read on EVERY call — a freshly written
  // Checkpoint must show up without a reload.
  let indexPromise: Promise<readonly ModuleIndexEntry[]> | null = null;
  const contentCache = new Map<ModuleId, ModuleContent>();

  function orderedEntries(): Promise<readonly ModuleIndexEntry[]> {
    indexPromise ??= content
      .loadIndex()
      .then((index) =>
        [...index.modules].sort((a, b) => a.ordinal - b.ordinal),
      );
    return indexPromise;
  }

  async function loadContent(id: ModuleId): Promise<ModuleContent | null> {
    const cached = contentCache.get(id);
    if (cached !== undefined) return cached;
    const loaded = await content.loadModuleContent(id);
    if (loaded !== null) contentCache.set(id, loaded);
    return loaded;
  }

  // The lock chain — the only unlock rule in the system. Rule 2 is normative
  // as written (also for gapped states arriving through importState):
  //   1. ordinal === 1 is always unlocked;
  //   2. ordinal === n (n > 1) is unlocked iff a Checkpoint exists for the
  //      Module with ordinal === n − 1;
  //   3. nothing else affects lock state; 4. derived at read time, never stored.
  function summarize(
    entry: ModuleIndexEntry,
    entries: readonly ModuleIndexEntry[],
    checkpointList: readonly Checkpoint[],
  ): ModuleSummary {
    const byModuleId = new Map(checkpointList.map((c) => [c.moduleId, c]));
    const previous = entries.find((e) => e.ordinal === entry.ordinal - 1);
    const unlocked =
      entry.ordinal === 1 ||
      (previous !== undefined && byModuleId.has(previous.id));
    return {
      id: entry.id,
      ordinal: entry.ordinal,
      title: entry.title,
      description: entry.description,
      pending: entry.pending,
      unlocked,
      checkpointAt: byModuleId.get(entry.id)?.passedAt ?? null,
    };
  }

  return {
    async getModules(): Promise<readonly ModuleSummary[]> {
      const [entries, checkpointList] = await Promise.all([
        orderedEntries(),
        checkpoints.listCheckpoints(),
      ]);
      return entries.map((entry) => summarize(entry, entries, checkpointList));
    },

    async getModule(id: ModuleId): Promise<ModuleDetail | null> {
      const [entries, checkpointList] = await Promise.all([
        orderedEntries(),
        checkpoints.listCheckpoints(),
      ]);
      const entry = entries.find((e) => e.id === id);
      // Unknown id: null — never throw, never invent a Module.
      if (entry === undefined) return null;

      const summary = summarize(entry, entries, checkpointList);
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
