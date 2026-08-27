// Public surface of the progress module. The Self-Check form (#16) and
// export/import (#29) import from here; contract.ts stays a re-export of the
// single verbatim doc copy.
export type {
  ChecklistAnswers,
  ChecklistDraft,
  Checkpoint,
  GateStatus,
  IProgress,
  PartialChecklistAnswers,
  ProgressState,
  SubmittedChecklist,
} from './contract';
export { createProgress } from './progress';
export {
  PROGRESS_FILE_NAME,
  parseProgressState,
  serializeProgressState,
} from './backup';
