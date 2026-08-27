// The two Target Interfaces and every shape they exchange — copied verbatim
// (not retyped) from docs/engineering.md § 2 "The two Target Interfaces".
// That code block is normative: if the doc changes, re-copy; never edit here.

// ── Ids and scalars ──────────────────────────────────────────────────────

/** Module id exactly as committed in the content files: 'm01' … 'm05'. */
export type ModuleId = string;

/** Exercise id, unique app-wide, equal to its repo folder name: 'm01-e1'. */
export type ExerciseId = string;

/** Behavioral Checklist question id, unique within its Module: 'q1' … 'q3'. */
export type ChecklistQuestionId = string;

/** ISO-8601 instant in UTC, e.g. '2026-08-12T09:41:00.000Z'. */
export type IsoDateTime = string;

export type ExerciseType = 'refactor' | 'construct';

// ── Authored content (committed JSON, read-only at runtime) ──────────────

export interface ModuleIndexEntry {
  readonly id: ModuleId;
  readonly ordinal: number; // 1-based, contiguous, the fixed Curriculum order
  readonly title: string;
  readonly description: string; // one line, shown under the title
  readonly pending: boolean; // true = content pack not authored yet
}

export interface ModuleIndex {
  readonly schemaVersion: 1;
  readonly modules: readonly ModuleIndexEntry[];
}

export interface ModelExample {
  readonly before: string; // C# source, <= 40 lines
  readonly after: string; // C# source, <= 40 lines
  readonly caption: string; // what moved or got hidden
}

export interface ExerciseBrief {
  readonly id: ExerciseId;
  readonly type: ExerciseType;
  readonly title: string;
  readonly concept: string; // Exercise Spec row 1
  readonly smell: string; // Exercise Spec row 2 — the planted flaw
  readonly targetInterfaceCode: string; // C# source, rendered read-only
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

// ── Learner progress (the only data Kata ever persists) ──────────────────

export interface Checkpoint {
  readonly moduleId: ModuleId;
  readonly passedAt: IsoDateTime; // written once at the pass; never updated
}

/** Complete answers: one chosen option value per checklist question id. */
export type ChecklistAnswers = Readonly<Record<ChecklistQuestionId, string>>;

/** Autosaved answers, possibly incomplete. Never part of the Exit Gate. */
export type PartialChecklistAnswers = Readonly<
  Partial<Record<ChecklistQuestionId, string>>
>;

export interface SubmittedChecklist {
  readonly moduleId: ModuleId;
  readonly answers: ChecklistAnswers;
  readonly submittedAt: IsoDateTime;
}

export interface ChecklistDraft {
  readonly moduleId: ModuleId;
  readonly answers: PartialChecklistAnswers;
  readonly savedAt: IsoDateTime;
}

export interface GateStatus {
  readonly moduleId: ModuleId;
  readonly passed: boolean; // true iff the Behavioral Checklist is submitted
  readonly checklistSubmittedAt: IsoDateTime | null;
  readonly checkpointAt: IsoDateTime | null; // null while the gate is not passed
}

/** The whole persisted state, in one value: backup file and test fixture. */
export interface ProgressState {
  readonly schemaVersion: 1;
  readonly checkpoints: readonly Checkpoint[];
  readonly submittedChecklists: readonly SubmittedChecklist[];
  readonly checklistDrafts: readonly ChecklistDraft[];
}

// ── What ICurriculum hands to the screens ────────────────────────────────

export interface ModuleSummary {
  readonly id: ModuleId;
  readonly ordinal: number;
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
  /** Every Module, ordered by ordinal ascending. */
  getModules(): Promise<readonly ModuleSummary[]>;
  /** Full detail for one Module; null when the id is unknown. */
  getModule(id: ModuleId): Promise<ModuleDetail | null>;
}

export declare function createCurriculum(content: ContentSource): ICurriculum;

// ── Target Interface 2 of 2: IProgress ───────────────────────────────────

export interface IProgress {
  /** Passes the Exit Gate and writes this Module's one Checkpoint. */
  submitChecklist(
    moduleId: ModuleId,
    answers: ChecklistAnswers,
  ): Promise<GateStatus>;
  /** Autosave of unsubmitted answers. Never affects the Exit Gate. */
  saveChecklistDraft(
    moduleId: ModuleId,
    partialAnswers: PartialChecklistAnswers,
  ): Promise<void>;
  getChecklistDraft(moduleId: ModuleId): Promise<ChecklistDraft | null>;
  getSubmittedChecklist(moduleId: ModuleId): Promise<SubmittedChecklist | null>;
  getGateStatus(moduleId: ModuleId): Promise<GateStatus>;
  listCheckpoints(): Promise<readonly Checkpoint[]>;
  getCheckpoint(moduleId: ModuleId): Promise<Checkpoint | null>;
  /** Whole state out, for the backup file and for test fixtures. */
  exportState(): Promise<ProgressState>;
  /** Whole state in: replaces everything stored. All-or-nothing. */
  importState(state: ProgressState): Promise<void>;
}

export declare function createProgress(
  databaseName?: string,
): Promise<IProgress>;
