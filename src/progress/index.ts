// Public surface of the progress module. The checklist form (#16), the
// unlock cascade (#18), and export/import (#29) import from here;
// contract.ts stays a re-export of the single verbatim doc copy.
export type {
  ChecklistAnswers,
  ChecklistDraft,
  Checkpoint,
  CheckpointReader,
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
