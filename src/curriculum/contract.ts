// The two Target Interfaces and every shape they exchange — copied verbatim
// (not retyped) from docs/engineering.md § 2 "The two Target Interfaces".
// That code block is normative: if the doc changes, re-copy; never edit here.

// ── Ids and scalars ──────────────────────────────────────────────────────

/** Module id exactly as committed in the content files; opaque to the app. */
export type ModuleId = string;

/** Category id exactly as committed in the content files; opaque to the app. */
export type CategoryId = string;

/** Exercise id, unique app-wide, equal to its repo folder name: 'm01-e1'. */
export type ExerciseId = string;

/** Self-Check question id, unique within its Module: 'q1' … 'q3'. */
export type ChecklistQuestionId = string;

/** ISO-8601 instant in UTC, e.g. '2026-08-12T09:41:00.000Z'. */
export type IsoDateTime = string;

export type ExerciseType = 'refactor' | 'construct';

/** The one practice language every Module in a Category is written in. */
export type CategoryLanguage = 'csharp' | 'python';

// ── Authored content (committed JSON, read-only at runtime) ──────────────

export interface Category {
  readonly id: CategoryId;
  readonly ordinal: number; // 1-based, contiguous, the order Categories read in
  readonly title: string;
  readonly description: string; // one line, shown under the title
  readonly language: CategoryLanguage; // every Module in it practises this one
}

export interface ModuleIndexEntry {
  readonly id: ModuleId;
  readonly categoryId: CategoryId; // the one Category this Module belongs to
  readonly ordinal: number; // 1-based, contiguous within its Category
  readonly title: string;
  readonly description: string; // one line, shown under the title
  readonly pending: boolean; // true = content pack not authored yet
}

export interface ModuleIndex {
  readonly schemaVersion: 2;
  readonly categories: readonly Category[];
  readonly modules: readonly ModuleIndexEntry[];
}

export interface ModelExample {
  readonly before: string; // source in the Category's language, <= 40 lines
  readonly after: string; // source in the Category's language, <= 40 lines
  readonly caption: string; // what moved or got hidden
}

export interface ExerciseBrief {
  readonly id: ExerciseId;
  readonly type: ExerciseType;
  readonly title: string;
  readonly concept: string; // Exercise Spec row 1
  readonly smell: string; // Exercise Spec row 2 — the planted flaw
  readonly targetInterfaceCode: string; // Category's language, read-only
  readonly sizeBudgetLoc: number; // <= 300
  readonly folderUrl: string | null; // GitHub folder link; null until committed
}

export interface ChecklistOption {
  readonly value: string; // the stored answer value
  readonly label: string; // what the radio shows
}

export interface ChecklistQuestion {
  readonly id: ChecklistQuestionId;
  readonly prompt: string; // behaviorally answerable — countable or doable
  readonly options: readonly [ChecklistOption, ChecklistOption]; // a radio pair
}

export interface ModuleContent {
  readonly schemaVersion: 1;
  readonly id: ModuleId;
  readonly conceptPageMarkdown: string;
  readonly modelExamples: readonly ModelExample[]; // 2–3
  readonly exercises: readonly ExerciseBrief[]; // >= 2: one refactor, one construct
  readonly checklistQuestions: readonly [
    ChecklistQuestion,
    ChecklistQuestion,
    ChecklistQuestion,
  ]; // exactly 3
}

// ── Reader answers (the only data Kata ever persists) ────────────────────

/** A Module's Self-Check picks: one option value per question id. Always
 *  partial — none, some, or all three answered are equally normal. */
export type SelfCheckAnswers = Readonly<
  Partial<Record<ChecklistQuestionId, string>>
>;

/** One Module's stored Self-Check answers; at most one record per Module. */
export interface ModuleSelfCheck {
  readonly moduleId: ModuleId;
  readonly answers: SelfCheckAnswers;
  readonly savedAt: IsoDateTime; // when the last pick was autosaved
}

/** The whole persisted state, in one value: backup file and test fixture. */
export interface ProgressState {
  readonly schemaVersion: 2;
  readonly selfCheckAnswers: readonly ModuleSelfCheck[];
}

// ── What ICurriculum hands to the screens ────────────────────────────────

export interface ModuleSummary {
  readonly id: ModuleId;
  readonly categoryId: CategoryId; // denormalized from the index, for grouping
  readonly language: CategoryLanguage; // denormalized from its Category
  readonly ordinal: number; // within its Category
  readonly title: string;
  readonly description: string;
  readonly pending: boolean;
}

export interface ModuleDetail extends ModuleSummary {
  readonly conceptPageMarkdown: string; // '' when pending
  readonly modelExamples: readonly ModelExample[]; // [] when pending
  readonly exercises: readonly ExerciseBrief[]; // [] when pending
  readonly checklistQuestions: readonly ChecklistQuestion[]; // [] when pending, else 3
}

// ── Seams ────────────────────────────────────────────────────────────────

/** Where authored content comes from: HTTP in the app, in-memory in tests. */
export interface ContentSource {
  loadIndex(): Promise<ModuleIndex>;
  /** null = the Module has no content file yet (pending). */
  loadModuleContent(id: ModuleId): Promise<ModuleContent | null>;
}

// ── Target Interface 1 of 2: ICurriculum ─────────────────────────────────

export interface ICurriculum {
  /** Every Module, ordered by Category ordinal, then Module ordinal. */
  getModules(): Promise<readonly ModuleSummary[]>;
  /** Full detail for one Module; null when the id is unknown. */
  getModule(id: ModuleId): Promise<ModuleDetail | null>;
}

export declare function createCurriculum(content: ContentSource): ICurriculum;

// ── Target Interface 2 of 2: IProgress ───────────────────────────────────

export interface IProgress {
  /** Autosave of a Module's Self-Check picks; replaces what was stored. */
  saveSelfCheckAnswers(
    moduleId: ModuleId,
    answers: SelfCheckAnswers,
  ): Promise<void>;
  /** One Module's stored answers; null when that Module has none. */
  getSelfCheckAnswers(moduleId: ModuleId): Promise<ModuleSelfCheck | null>;
  /** Whole state out, for the backup file and for test fixtures. */
  exportState(): Promise<ProgressState>;
  /** Whole state in: replaces everything stored. All-or-nothing. */
  importState(state: ProgressState): Promise<void>;
}

export declare function createProgress(
  databaseName?: string,
): Promise<IProgress>;
