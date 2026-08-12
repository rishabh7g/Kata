// The backup file (#29): `kata-progress.json` is ProgressState serialized as
// JSON — Checkpoints + checklist answers + schemaVersion, nothing else. This
// module owns the file shape at both ends: serialize for the download, and a
// strict parse that rejects garbage/foreign JSON with a clear reason BEFORE
// importState is ever called, so an invalid file changes nothing. The parse
// also rebuilds every record from the documented fields only, so a
// hand-edited file cannot smuggle extra keys into IndexedDB.
import type {
  ChecklistDraft,
  Checkpoint,
  PartialChecklistAnswers,
  ProgressState,
  SubmittedChecklist,
} from './contract';

export const PROGRESS_FILE_NAME = 'kata-progress.json';

export function serializeProgressState(state: ProgressState): string {
  return `${JSON.stringify(state, null, 2)}\n`;
}

/**
 * Strictly parses a backup file's text into a ProgressState, or throws an
 * Error whose message names what is wrong (shown verbatim in the import
 * error line). Unknown keys are dropped, never stored.
 */
export function parseProgressState(text: string): ProgressState {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('the file is not JSON');
  }
  if (!isRecord(data)) {
    throw new Error('the file is not a JSON object');
  }
  if (data.schemaVersion !== 1) {
    throw new Error(
      `unknown schemaVersion ${JSON.stringify(data.schemaVersion ?? null)} (expected 1)`,
    );
  }
  return {
    schemaVersion: 1,
    checkpoints: parseArray(data, 'checkpoints', parseCheckpoint),
    submittedChecklists: parseArray(
      data,
      'submittedChecklists',
      parseSubmittedChecklist,
    ),
    checklistDrafts: parseArray(data, 'checklistDrafts', parseChecklistDraft),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseArray<T>(
  data: Record<string, unknown>,
  key: string,
  parseRecord: (value: unknown, where: string) => T,
): readonly T[] {
  const value = data[key];
  if (!Array.isArray(value)) {
    throw new Error(`'${key}' is missing or not an array`);
  }
  return value.map((entry, i) => parseRecord(entry, `${key}[${String(i)}]`));
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  where: string,
): string {
  const value = record[key];
  if (typeof value !== 'string' || value === '') {
    throw new Error(`${where}: '${key}' is missing or not a string`);
  }
  return value;
}

function parseAnswers(
  value: unknown,
  where: string,
): PartialChecklistAnswers {
  if (!isRecord(value)) {
    throw new Error(`${where}: 'answers' is missing or not an object`);
  }
  const answers: Record<string, string> = {};
  for (const [questionId, answer] of Object.entries(value)) {
    if (typeof answer !== 'string') {
      throw new Error(`${where}: answer '${questionId}' is not a string`);
    }
    answers[questionId] = answer;
  }
  return answers;
}

function parseCheckpoint(value: unknown, where: string): Checkpoint {
  if (!isRecord(value)) throw new Error(`${where} is not an object`);
  return {
    moduleId: requireString(value, 'moduleId', where),
    passedAt: requireString(value, 'passedAt', where),
  };
}

function parseSubmittedChecklist(
  value: unknown,
  where: string,
): SubmittedChecklist {
  if (!isRecord(value)) throw new Error(`${where} is not an object`);
  const answers = parseAnswers(value.answers, where);
  // An export can never hold a submitted checklist without answers:
  // submitChecklist refuses an empty submission.
  if (Object.keys(answers).length === 0) {
    throw new Error(`${where}: a submitted checklist has no answers`);
  }
  return {
    moduleId: requireString(value, 'moduleId', where),
    answers: answers as SubmittedChecklist['answers'],
    submittedAt: requireString(value, 'submittedAt', where),
  };
}

function parseChecklistDraft(value: unknown, where: string): ChecklistDraft {
  if (!isRecord(value)) throw new Error(`${where} is not an object`);
  return {
    moduleId: requireString(value, 'moduleId', where),
    // Drafts are autosaves and may be partial — even empty.
    answers: parseAnswers(value.answers, where),
    savedAt: requireString(value, 'savedAt', where),
  };
}
