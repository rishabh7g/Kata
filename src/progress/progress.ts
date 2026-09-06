// IProgress — docs/engineering.md § "IProgress — behaviour" and § 4 Storage.
//
// The app's only write path, and what it writes is the reader's own Self-Check
// answers: one record per Module, replaced on each autosave. Pure TypeScript +
// IndexedDB: no DOM rendering, no React.
//
// Database `kata-v2`, version 1, one object store keyed by `moduleId`, so the
// "at most one per Module" invariant is the key itself. The gated model's
// database (`kata`) is abandoned, not migrated (#159).
import type {
  IProgress,
  ModuleId,
  ModuleSelfCheck,
  SelfCheckAnswers,
} from '../curriculum/contract';

const DATABASE = 'kata-v2';
const ANSWERS = 'selfCheckAnswers';

/** The gated model's database. Deleted on open; never read. */
const ABANDONED_DATABASE = 'kata';

// ── IndexedDB plumbing (requests → promises) ─────────────────────────────

function openDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(ANSWERS, { keyPath: 'moduleId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error(`Could not open IndexedDB '${name}'`));
  });
}

/** One IDB request as a promise. Absence is always null, never undefined. */
function read<T>(request: IDBRequest): Promise<T | null> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () =>
      resolve((request.result as T | undefined) ?? null);
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB read failed'));
  });
}

/** Resolves when the transaction commits; every write here awaits it. */
function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    tx.onerror = () =>
      reject(tx.error ?? new Error('IndexedDB transaction failed'));
  });
}

// ── The Target Interface ─────────────────────────────────────────────────

export async function createProgress(): Promise<IProgress> {
  const db = await openDatabase(DATABASE);

  // Fire-and-forget (§ 4): the gated model's records describe a judgement the
  // Library no longer makes, so there is nothing to carry forward and nothing
  // to wait for. A browser that never had one is the normal case, and a
  // refused delete (another tab holding it open) leaves the app working.
  indexedDB.deleteDatabase(ABANDONED_DATABASE);

  return {
    async saveSelfCheckAnswers(
      moduleId: ModuleId,
      answers: SelfCheckAnswers,
    ): Promise<void> {
      // Replace, last write wins. A partial map is the normal case: the panel
      // autosaves every pick, and a reader may answer one question or none.
      const record: ModuleSelfCheck = {
        moduleId,
        answers,
        savedAt: new Date().toISOString(),
      };
      const tx = db.transaction(ANSWERS, 'readwrite');
      tx.objectStore(ANSWERS).put(record);
      await committed(tx);
    },

    getSelfCheckAnswers(moduleId: ModuleId): Promise<ModuleSelfCheck | null> {
      const tx = db.transaction(ANSWERS, 'readonly');
      return read<ModuleSelfCheck>(tx.objectStore(ANSWERS).get(moduleId));
    },

  };
}
