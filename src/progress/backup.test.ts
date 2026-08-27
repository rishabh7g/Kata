// The backup file shape (#29): parseProgressState is the check a picked file
// must pass before importState ever runs — strict on garbage, lossless on a
// real export, and it drops keys the contract does not document. v2 only: the
// gated model's v1 file is foreign JSON now (#159).
import { describe, expect, it } from 'vitest';
import type { ProgressState } from './contract';
import { parseProgressState, serializeProgressState } from './backup';

const state: ProgressState = {
  schemaVersion: 2,
  selfCheckAnswers: [
    {
      moduleId: 'm01',
      answers: { q1: 'yes', q2: 'no', q3: 'yes' },
      savedAt: '2026-06-12T09:41:00.000Z',
    },
    { moduleId: 'm02', answers: { q1: 'yes' }, savedAt: '2026-06-13T10:00:00.000Z' },
  ],
};

describe('parseProgressState', () => {
  it('round-trips a serialized export losslessly', () => {
    expect(parseProgressState(serializeProgressState(state))).toEqual(state);
  });

  it('accepts the empty (fresh-profile) state', () => {
    const empty: ProgressState = { schemaVersion: 2, selfCheckAnswers: [] };
    expect(parseProgressState(serializeProgressState(empty))).toEqual(empty);
  });

  it('drops keys the export shape does not document', () => {
    const edited = {
      ...state,
      telemetry: { visits: 9 },
      selfCheckAnswers: [
        {
          moduleId: 'm01',
          answers: { q1: 'yes' },
          savedAt: '2026-06-12T09:41:00.000Z',
          device: 'pi',
        },
      ],
    };
    const parsed = parseProgressState(JSON.stringify(edited));
    expect(Object.keys(parsed)).toEqual(['schemaVersion', 'selfCheckAnswers']);
    expect(Object.keys(parsed.selfCheckAnswers[0] ?? {})).toEqual([
      'moduleId',
      'answers',
      'savedAt',
    ]);
  });

  it.each([
    ['not JSON at all', 'this is not json', /not JSON/],
    ['a JSON array', '[]', /not a JSON object/],
    ['foreign JSON', '{"name":"Kata"}', /schemaVersion/],
    // The gated model's export: right file name, wrong model (#159).
    [
      'a v1 file',
      '{"schemaVersion":1,"checkpoints":[],"submittedChecklists":[],"checklistDrafts":[]}',
      /^unknown schemaVersion 1 \(expected 2\)$/,
    ],
    ['a wrong schemaVersion', '{"schemaVersion":3}', /schemaVersion/],
    [
      'a missing store array',
      '{"schemaVersion":2}',
      /'selfCheckAnswers' is missing/,
    ],
    [
      'a record without a date',
      '{"schemaVersion":2,"selfCheckAnswers":[{"moduleId":"m01","answers":{}}]}',
      /'savedAt' is missing/,
    ],
    [
      'a record without answers',
      '{"schemaVersion":2,"selfCheckAnswers":[{"moduleId":"m01","savedAt":"2026-06-12T09:41:00.000Z"}]}',
      /'answers' is missing or not an object/,
    ],
    [
      'a non-string answer',
      '{"schemaVersion":2,"selfCheckAnswers":[{"moduleId":"m01","answers":{"q1":7},"savedAt":"2026-06-12T09:41:00.000Z"}]}',
      /answer 'q1' is not a string/,
    ],
  ])('rejects %s with a clear reason', (_what, text, reason) => {
    expect(() => parseProgressState(text)).toThrow(reason);
  });

  // #76: a non-ISO timestamp used to pass the parse and reach a screen, which
  // rendered it as an `Invalid Date`. It is rejected at the door now — with
  // the field and the record named, like every other reason.
  it.each([
    [
      'a word',
      '{"schemaVersion":2,"selfCheckAnswers":[{"moduleId":"m01","answers":{},"savedAt":"banana"}]}',
    ],
    [
      'a US date',
      '{"schemaVersion":2,"selfCheckAnswers":[{"moduleId":"m01","answers":{},"savedAt":"12/25/2026"}]}',
    ],
    [
      'a bare year',
      '{"schemaVersion":2,"selfCheckAnswers":[{"moduleId":"m01","answers":{},"savedAt":"2026"}]}',
    ],
    [
      'an hour that does not exist',
      '{"schemaVersion":2,"selfCheckAnswers":[{"moduleId":"m01","answers":{},"savedAt":"2026-06-12T33:41:00.000Z"}]}',
    ],
  ])('rejects %s as a timestamp', (_where, text) => {
    expect(() => parseProgressState(text)).toThrow(
      /^selfCheckAnswers\[0\]: 'savedAt' is not an ISO date$/,
    );
  });

  it.each([
    '2026-06-12T09:41:00.000Z',
    '2026-06-12T09:41:00Z',
    '2026-06-12T09:41:00+10:00',
  ])('accepts the ISO instant %s', (savedAt) => {
    const file = JSON.stringify({
      schemaVersion: 2,
      selfCheckAnswers: [{ moduleId: 'm01', answers: { q1: 'yes' }, savedAt }],
    });
    expect(parseProgressState(file).selfCheckAnswers).toEqual([
      { moduleId: 'm01', answers: { q1: 'yes' }, savedAt },
    ]);
  });

  it('accepts an empty answer map — a reader may have answered nothing yet', () => {
    const none: ProgressState = {
      schemaVersion: 2,
      selfCheckAnswers: [
        { moduleId: 'm02', answers: {}, savedAt: '2026-06-13T10:00:00.000Z' },
      ],
    };
    expect(parseProgressState(serializeProgressState(none))).toEqual(none);
  });
});
