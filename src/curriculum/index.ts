// Public surface of the curriculum module. Screens (#10–#13) import from
// here; contract.ts stays the verbatim copy of the docs/engineering.md block.
export type {
  Category,
  CategoryId,
  CategoryLanguage,
  ContentSource,
  ExerciseBrief,
  ExerciseId,
  ExerciseType,
  ICurriculum,
  IsoDateTime,
  ModelExample,
  ModuleContent,
  ModuleDetail,
  ModuleId,
  ModuleIndex,
  ModuleIndexEntry,
  ModuleSummary,
  SelfCheckOption,
  SelfCheckQuestion,
  SelfCheckQuestionId,
} from './contract';
export { createCurriculum } from './curriculum';
export { createHttpContentSource } from './http-content-source';
