// The Target Interface contract exists ONCE in code: the normative block from
// docs/engineering.md § 2 "The two Target Interfaces", copied verbatim (not
// retyped, diff-verified) into src/curriculum/contract.ts. This file is the
// progress module's view of that single copy — re-exports only, so the
// IProgress `interface` in code stays character-identical to the doc without
// a second copy that could drift. If the doc changes, re-copy there.
export type {
  ChecklistAnswers,
  ChecklistDraft,
  ChecklistQuestionId,
  Checkpoint,
  CheckpointReader,
  GateStatus,
  IProgress,
  IsoDateTime,
  ModuleId,
  PartialChecklistAnswers,
  ProgressState,
  SubmittedChecklist,
} from '../curriculum/contract';
