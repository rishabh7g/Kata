// The backup file shape (#29): parseProgressState is the gate a picked file
// must pass before importState ever runs — strict on garbage, lossless on a
// real export, and it drops keys the contract does not document.
import { describe, expect, it } from 'vitest';
import type { ProgressState } from './contract';
import { parseProgressState, serializeProgressState } from './backup';

const state: ProgressState = {
  schemaVersion: 1,
  checkpoints: [{ moduleId: 'm01', passedAt: '2026-06-12T09:41:00.000Z' }],
  submittedChecklists: [
    {
      moduleId: 'm01',
      answers: { q1: 'yes', q2: 'no', q3: 'yes' },
      submittedAt: '2026-06-12T09:41:00.000Z',
    },
  ],
  checklistDrafts: [
    { moduleId: 'm02', answers: { q1: 'yes' }, savedAt: '2026-06-13T10:00:00.000Z' },
  ],
};

describe('parseProgressState', () => {
  it('round-trips a serialized export losslessly', () => {
    expect(parseProgressState(serializeProgressState(state))).toEqual(state);
  });

  it('accepts the empty (fresh-profile) state', () => {
    const empty: ProgressState = {
      schemaVersion: 1,
      checkpoints: [],
      submittedChecklists: [],
      checklistDrafts: [],
    };
    expect(parseProgressState(serializeProgressState(empty))).toEqual(empty);
  });

  it('drops keys the export shape does not document', () => {
    const edited = {
      ...state,
      telemetry: { visits: 9 },
      checkpoints: [{ moduleId: 'm01', passedAt: '2026-06-12T09:41:00.000Z', device: 'pi' }],
    };
    const parsed = parseProgressState(JSON.stringify(edited));
    expect(parsed).toEqual({ ...state, checkpoints: state.checkpoints });
    expect(Object.keys(parsed)).toEqual([
      'schemaVersion',
      'checkpoints',
      'submittedChecklists',
      'checklistDrafts',
    ]);
    expect(Object.keys(parsed.checkpoints[0] ?? {})).toEqual([
      'moduleId',
      'passedAt',
    ]);
  });

  it.each([
    ['not JSON at all', 'this is not json', /not JSON/],
    ['a JSON array', '[]', /not a JSON object/],
    ['foreign JSON', '{"name":"Kata"}', /schemaVersion/],
    ['a wrong schemaVersion', '{"schemaVersion":2}', /schemaVersion/],
    [
      'a missing store array',
      '{"schemaVersion":1,"checkpoints":[]}',
      /'submittedChecklists' is missing/,
    ],
    [
      'a Checkpoint without a date',
      '{"schemaVersion":1,"checkpoints":[{"moduleId":"m01"}],"submittedChecklists":[],"checklistDrafts":[]}',
      /'passedAt' is missing/,
    ],
    [
      'a non-string answer',
      '{"schemaVersion":1,"checkpoints":[],"submittedChecklists":[{"moduleId":"m01","answers":{"q1":7},"submittedAt":"2026-06-12T09:41:00.000Z"}],"checklistDrafts":[]}',
      /answer 'q1' is not a string/,
    ],
    [
      'a submitted checklist with no answers',
      '{"schemaVersion":1,"checkpoints":[],"submittedChecklists":[{"moduleId":"m01","answers":{},"submittedAt":"2026-06-12T09:41:00.000Z"}],"checklistDrafts":[]}',
      /has no answers/,
    ],
  ])('rejects %s with a clear reason', (_what, text, reason) => {
    expect(() => parseProgressState(text)).toThrow(reason);
  });

  it('accepts an empty draft — autosaves may hold nothing yet', () => {
    const withEmptyDraft: ProgressState = {
      ...state,
      checklistDrafts: [
        { moduleId: 'm02', answers: {}, savedAt: '2026-06-13T10:00:00.000Z' },
      ],
    };
    expect(
      parseProgressState(serializeProgressState(withEmptyDraft)),
    ).toEqual(withEmptyDraft);
  });
});
