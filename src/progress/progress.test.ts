// IProgress specs — written FIRST, from docs/engineering.md § "IProgress —
// behaviour" and § 4 "Storage (IndexedDB)", before any implementation exists
// (Module 0 discipline, § 8). fake-indexeddb is the doc's prescribed test
// environment; a fresh IDBFactory per test is the "clear site data" reset.
//
// Critical path (§ 8): IProgress is the ONLY writer of Checkpoints, and
// submitChecklist + importState are the only two code paths that create one.
// Every rule those paths must obey is asserted here.
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgressState } from './contract';
import { createProgress } from './progress';

const answers = { q1: 'yes', q2: 'one', q3: 'did' } as const;

beforeEach(() => {
  // A brand-new browser profile per test: no database survives into the next
  // test, and reload persistence is modelled by re-opening the same name
  // against the SAME factory within one test.
  globalThis.indexedDB = new IDBFactory();
  // Fake only Date (not timers — fake-indexeddb needs real ones) so tests can
  // pin `now` and prove which instant a record kept.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-08-12T09:41:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('empty state', () => {
  it('starts with no gate passed, no Checkpoints, no drafts, no submissions', async () => {
    const progress = await createProgress('kata-test');

    expect(await progress.getGateStatus('m01')).toEqual({
      moduleId: 'm01',
      passed: false,
      checklistSubmittedAt: null,
      checkpointAt: null,
    });
    expect(await progress.listCheckpoints()).toEqual([]);
    expect(await progress.getCheckpoint('m01')).toBeNull();
    expect(await progress.getChecklistDraft('m01')).toBeNull();
    expect(await progress.getSubmittedChecklist('m01')).toBeNull();
    expect(await progress.exportState()).toEqual({
      schemaVersion: 1,
      checkpoints: [],
      submittedChecklists: [],
      checklistDrafts: [],
    });
  });

  it('returns a not-passed status for an unknown or pending Module rather than throwing', async () => {
    const progress = await createProgress('kata-test');
    const status = await progress.getGateStatus('m99');
    expect(status).toEqual({
      moduleId: 'm99',
      passed: false,
      checklistSubmittedAt: null,
      checkpointAt: null,
    });
  });
});

describe('submitChecklist — the gate and the Checkpoint write path', () => {
  it('passes the gate and writes exactly one Checkpoint with passedAt = now', async () => {
    const progress = await createProgress('kata-test');

    const status = await progress.submitChecklist('m01', answers);

    expect(status).toEqual({
      moduleId: 'm01',
      passed: true,
      checklistSubmittedAt: '2026-08-12T09:41:00.000Z',
      checkpointAt: '2026-08-12T09:41:00.000Z',
    });
    expect(await progress.listCheckpoints()).toEqual([
      { moduleId: 'm01', passedAt: '2026-08-12T09:41:00.000Z' },
    ]);
    expect(await progress.getCheckpoint('m01')).toEqual({
      moduleId: 'm01',
      passedAt: '2026-08-12T09:41:00.000Z',
    });
    expect(await progress.getSubmittedChecklist('m01')).toEqual({
      moduleId: 'm01',
      answers,
      submittedAt: '2026-08-12T09:41:00.000Z',
    });
  });

  it('deletes the Module draft at the moment the gate passes', async () => {
    const progress = await createProgress('kata-test');
    await progress.saveChecklistDraft('m01', { q1: 'yes' });

    await progress.submitChecklist('m01', answers);

    expect(await progress.getChecklistDraft('m01')).toBeNull();
  });

  it('is idempotent: resubmitting keeps one Checkpoint, the original date, and the original answers', async () => {
    const progress = await createProgress('kata-test');
    await progress.submitChecklist('m01', answers);

    vi.setSystemTime(new Date('2026-08-13T18:00:00.000Z'));
    const status = await progress.submitChecklist('m01', {
      q1: 'no',
      q2: 'two',
      q3: 'did-not',
    });

    // The no-op returns the EXISTING GateStatus; nothing was rewritten.
    expect(status).toEqual({
      moduleId: 'm01',
      passed: true,
      checklistSubmittedAt: '2026-08-12T09:41:00.000Z',
      checkpointAt: '2026-08-12T09:41:00.000Z',
    });
    expect(await progress.listCheckpoints()).toEqual([
      { moduleId: 'm01', passedAt: '2026-08-12T09:41:00.000Z' },
    ]);
    expect(await progress.getSubmittedChecklist('m01')).toEqual({
      moduleId: 'm01',
      answers,
      submittedAt: '2026-08-12T09:41:00.000Z',
    });
  });

  it('throws on empty answers and writes nothing', async () => {
    const progress = await createProgress('kata-test');

    await expect(progress.submitChecklist('m01', {})).rejects.toThrow();

    expect(await progress.getGateStatus('m01')).toMatchObject({
      passed: false,
    });
    expect(await progress.listCheckpoints()).toEqual([]);
  });
});

describe('drafts — never a gate input', () => {
  it('a draft does not pass the gate and writes no Checkpoint', async () => {
    const progress = await createProgress('kata-test');

    await progress.saveChecklistDraft('m01', { q1: 'yes', q2: 'one' });

    expect(await progress.getGateStatus('m01')).toEqual({
      moduleId: 'm01',
      passed: false,
      checklistSubmittedAt: null,
      checkpointAt: null,
    });
    expect(await progress.listCheckpoints()).toEqual([]);
    expect(await progress.getChecklistDraft('m01')).toEqual({
      moduleId: 'm01',
      answers: { q1: 'yes', q2: 'one' },
      savedAt: '2026-08-12T09:41:00.000Z',
    });
  });

  it('replaces the draft on each autosave — last write wins', async () => {
    const progress = await createProgress('kata-test');
    await progress.saveChecklistDraft('m01', { q1: 'yes' });

    vi.setSystemTime(new Date('2026-08-12T09:42:00.000Z'));
    await progress.saveChecklistDraft('m01', { q1: 'no', q2: 'two' });

    expect(await progress.getChecklistDraft('m01')).toEqual({
      moduleId: 'm01',
      answers: { q1: 'no', q2: 'two' },
      savedAt: '2026-08-12T09:42:00.000Z',
    });
  });

  it('is a no-op on an already-submitted Module', async () => {
    const progress = await createProgress('kata-test');
    await progress.submitChecklist('m01', answers);

    await progress.saveChecklistDraft('m01', { q1: 'changed-my-mind' });

    expect(await progress.getChecklistDraft('m01')).toBeNull();
  });
});

describe('per-Module isolation', () => {
  it("Module 1 data never affects Module 2's gate, draft, or Checkpoint", async () => {
    const progress = await createProgress('kata-test');

    await progress.submitChecklist('m01', answers);
    await progress.saveChecklistDraft('m02', { q1: 'yes' });

    expect(await progress.getGateStatus('m02')).toMatchObject({
      moduleId: 'm02',
      passed: false,
      checkpointAt: null,
    });
    expect(await progress.getCheckpoint('m02')).toBeNull();
    expect(await progress.getSubmittedChecklist('m02')).toBeNull();
    expect(await progress.getChecklistDraft('m01')).toBeNull();
    expect((await progress.listCheckpoints()).map((c) => c.moduleId)).toEqual([
      'm01',
    ]);
  });

  it('orders listCheckpoints by moduleId ascending regardless of write order', async () => {
    const progress = await createProgress('kata-test');

    await progress.submitChecklist('m03', answers);
    await progress.submitChecklist('m01', answers);

    expect((await progress.listCheckpoints()).map((c) => c.moduleId)).toEqual([
      'm01',
      'm03',
    ]);
  });
});

describe('persistence — state survives a reload', () => {
  it('re-opening the same database sees the submitted checklist, Checkpoint, and draft', async () => {
    const first = await createProgress('kata-test');
    await first.submitChecklist('m01', answers);
    await first.saveChecklistDraft('m02', { q1: 'yes' });

    // A reload is a new IProgress over the same IndexedDB database.
    const second = await createProgress('kata-test');

    expect(await second.getGateStatus('m01')).toMatchObject({ passed: true });
    expect(await second.listCheckpoints()).toEqual([
      { moduleId: 'm01', passedAt: '2026-08-12T09:41:00.000Z' },
    ]);
    expect(await second.getChecklistDraft('m02')).toEqual({
      moduleId: 'm02',
      answers: { q1: 'yes' },
      savedAt: '2026-08-12T09:41:00.000Z',
    });
  });
});

describe('exportState / importState — the backup story', () => {
  const backup: ProgressState = {
    schemaVersion: 1,
    checkpoints: [{ moduleId: 'm01', passedAt: '2026-08-01T10:00:00.000Z' }],
    submittedChecklists: [
      {
        moduleId: 'm01',
        answers,
        submittedAt: '2026-08-01T10:00:00.000Z',
      },
    ],
    checklistDrafts: [
      {
        moduleId: 'm02',
        answers: { q1: 'yes' },
        savedAt: '2026-08-02T11:00:00.000Z',
      },
    ],
  };

  it('round-trips: exportState of an imported state returns it unchanged', async () => {
    const progress = await createProgress('kata-test');

    await progress.importState(backup);

    expect(await progress.exportState()).toEqual(backup);
    expect(await progress.getGateStatus('m01')).toMatchObject({
      passed: true,
      checkpointAt: '2026-08-01T10:00:00.000Z',
    });
  });

  it('replaces everything stored — nothing from before the import survives', async () => {
    const progress = await createProgress('kata-test');
    await progress.submitChecklist('m03', answers);
    await progress.saveChecklistDraft('m04', { q1: 'yes' });

    await progress.importState(backup);

    expect(await progress.getCheckpoint('m03')).toBeNull();
    expect(await progress.getChecklistDraft('m04')).toBeNull();
    expect(await progress.exportState()).toEqual(backup);
  });

  it('rejects an unknown schemaVersion and changes nothing', async () => {
    const progress = await createProgress('kata-test');
    await progress.submitChecklist('m01', answers);
    const before = await progress.exportState();

    const bad = { ...backup, schemaVersion: 2 } as unknown as ProgressState;
    await expect(progress.importState(bad)).rejects.toThrow();

    expect(await progress.exportState()).toEqual(before);
  });

  it('rejects more than one Checkpoint for the same Module and changes nothing', async () => {
    const progress = await createProgress('kata-test');
    await progress.submitChecklist('m01', answers);
    const before = await progress.exportState();

    const bad: ProgressState = {
      ...backup,
      checkpoints: [
        { moduleId: 'm01', passedAt: '2026-08-01T10:00:00.000Z' },
        { moduleId: 'm01', passedAt: '2026-08-02T10:00:00.000Z' },
      ],
    };
    await expect(progress.importState(bad)).rejects.toThrow();

    expect(await progress.exportState()).toEqual(before);
  });
});
