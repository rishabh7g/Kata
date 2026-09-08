// IProgress specs — written from docs/02-engineering.md § "IProgress — behaviour"
// and § 4 "Storage (IndexedDB)" (Module 0 discipline, § 8). fake-indexeddb is
// the doc's prescribed test environment; a fresh IDBFactory per test is the
// "clear site data" reset.
//
// Critical path (§ 8): IProgress is the app's ONLY write path, and
// saveSelfCheckAnswers is the only code path that stores anything. Every rule
// it must obey is asserted here.
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProgress } from './progress';

const answers = { q1: 'yes', q2: 'one', q3: 'did' } as const;

/** Every database this profile currently holds, newest API first. */
async function databaseNames(): Promise<string[]> {
  const databases = await indexedDB.databases();
  return databases
    .map((d) => d.name ?? '')
    .filter((name) => name !== '')
    .sort();
}

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
  it('starts with no answers stored at all', async () => {
    const progress = await createProgress();

    expect(await progress.getSelfCheckAnswers('m01')).toBeNull();
    expect(await progress.getSelfCheckAnswers('m01')).toBeNull();
  });

  it('returns null for an unknown or pending Module rather than throwing', async () => {
    const progress = await createProgress();

    expect(await progress.getSelfCheckAnswers('m99')).toBeNull();
  });
});

describe('saveSelfCheckAnswers — the write path', () => {
  it('stores the picks with savedAt = now', async () => {
    const progress = await createProgress();

    await progress.saveSelfCheckAnswers('m01', answers);

    expect(await progress.getSelfCheckAnswers('m01')).toEqual({
      moduleId: 'm01',
      answers,
      savedAt: '2026-08-12T09:41:00.000Z',
    });
  });

  it('accepts a partial answer set — one question answered, or none', async () => {
    const progress = await createProgress();

    await progress.saveSelfCheckAnswers('m01', { q2: 'one' });
    await progress.saveSelfCheckAnswers('m02', {});

    expect((await progress.getSelfCheckAnswers('m01'))?.answers).toEqual({
      q2: 'one',
    });
    expect((await progress.getSelfCheckAnswers('m02'))?.answers).toEqual({});
  });

  it('replaces the record on each autosave — last write wins', async () => {
    const progress = await createProgress();
    await progress.saveSelfCheckAnswers('m01', { q1: 'yes' });

    vi.setSystemTime(new Date('2026-08-12T09:42:00.000Z'));
    await progress.saveSelfCheckAnswers('m01', { q1: 'no', q2: 'two' });

    expect(await progress.getSelfCheckAnswers('m01')).toEqual({
      moduleId: 'm01',
      answers: { q1: 'no', q2: 'two' },
      savedAt: '2026-08-12T09:42:00.000Z',
    });
  });
});

describe('per-Module isolation', () => {
  it("Module 1's answers never touch Module 2's", async () => {
    const progress = await createProgress();

    await progress.saveSelfCheckAnswers('m01', answers);

    expect(await progress.getSelfCheckAnswers('m02')).toBeNull();
  });
});

describe('persistence — state survives a reload', () => {
  it('re-opening the same database sees the stored answers', async () => {
    const first = await createProgress();
    await first.saveSelfCheckAnswers('m02', { q1: 'yes' });

    // A reload is a new IProgress over the same IndexedDB database.
    const second = await createProgress();

    expect(await second.getSelfCheckAnswers('m02')).toEqual({
      moduleId: 'm02',
      answers: { q1: 'yes' },
      savedAt: '2026-08-12T09:41:00.000Z',
    });
  });
});

// § 4: the gated model's database is abandoned, not migrated (#159). Its
// records described a judgement the Library no longer makes.
describe('the abandoned `kata` database', () => {
  it('opens `kata-v2` by default', async () => {
    await createProgress();

    expect(await databaseNames()).toEqual(['kata-v2']);
  });

  it('deletes an existing `kata` database on open, keeping nothing from it', async () => {
    // A browser left over from the gated model: the old database, with the
    // old stores in it.
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('kata', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('checkpoints', {
          keyPath: 'moduleId',
        });
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
    expect(await databaseNames()).toEqual(['kata']);

    const progress = await createProgress();

    await vi.waitFor(async () => {
      expect(await databaseNames()).toEqual(['kata-v2']);
    });
    expect(await progress.getSelfCheckAnswers('m01')).toBeNull();
  });
});
