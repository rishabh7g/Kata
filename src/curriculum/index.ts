// Public surface of the curriculum module.
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
export { createCurriculum, createHttpContentSource } from './curriculum';
