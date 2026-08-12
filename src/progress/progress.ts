// IProgress — docs/engineering.md § "IProgress — behaviour" and § 4 Storage.
//
// The integrity of the whole system: this module is the ONLY writer of
// Checkpoints. Exactly two code paths create one — submitChecklist and
// importState — and both are transactional. Pure TypeScript + IndexedDB:
// no DOM rendering, no React.
//
// Database `kata`, version 1, three object stores keyed by `moduleId`, so the
// "at most one per Module" invariant is the key itself.
import type {
  ChecklistAnswers,
  ChecklistDraft,
  Checkpoint,
  GateStatus,
  IProgress,
  ModuleId,
  PartialChecklistAnswers,
  ProgressState,
  SubmittedChecklist,
} from './contract';

const CHECKPOINTS = 'checkpoints';
const SUBMITTED = 'submittedChecklists';
const DRAFTS = 'checklistDrafts';
const ALL_STORES = [CHECKPOINTS, SUBMITTED, DRAFTS] as const;

// ── IndexedDB plumbing (requests → promises) ─────────────────────────────

function openDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      for (const store of ALL_STORES) {
        request.result.createObjectStore(store, { keyPath: 'moduleId' });
      }
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

function readAll<T>(request: IDBRequest): Promise<T[]> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB read failed'));
  });
}

/**
 * Resolves when the transaction commits. Every write in this module awaits
 * this, so a multi-store write (the gate pass, the import) is all-or-nothing.
 */
function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    tx.onerror = () =>
      reject(tx.error ?? new Error('IndexedDB transaction failed'));
  });
}

// ── Derivation (deriving beats storing — § 8) ────────────────────────────

function toGateStatus(
  moduleId: ModuleId,
  submitted: SubmittedChecklist | null,
  checkpoint: Checkpoint | null,
): GateStatus {
  // Passed iff the Behavioral Checklist is submitted — the sole condition.
  return {
    moduleId,
    passed: submitted !== null,
    checklistSubmittedAt: submitted?.submittedAt ?? null,
    checkpointAt: checkpoint?.passedAt ?? null,
  };
}

/** Ordered by the Module's ordinal, i.e. by moduleId ascending ('m01'…). */
function byModuleId<T extends { readonly moduleId: ModuleId }>(
  records: T[],
): T[] {
  return records.sort((a, b) => a.moduleId.localeCompare(b.moduleId));
}

// ── The Target Interface ─────────────────────────────────────────────────

export async function createProgress(
  databaseName = 'kata',
): Promise<IProgress> {
  const db = await openDatabase(databaseName);

  async function readSubmitted(
    moduleId: ModuleId,
  ): Promise<SubmittedChecklist | null> {
    const tx = db.transaction(SUBMITTED, 'readonly');
    return read<SubmittedChecklist>(tx.objectStore(SUBMITTED).get(moduleId));
  }

  return {
    async submitChecklist(
      moduleId: ModuleId,
      answers: ChecklistAnswers,
    ): Promise<GateStatus> {
      // The form owns "all three answered"; IProgress only refuses nothing.
      if (Object.keys(answers).length === 0) {
        throw new Error(
          `submitChecklist('${moduleId}'): answers is empty — nothing to submit`,
        );
      }

      // One readwrite transaction across all three stores: the submitted
      // checklist and the Checkpoint both land, or neither does.
      const tx = db.transaction([...ALL_STORES], 'readwrite');
      const existing = await read<SubmittedChecklist>(
        tx.objectStore(SUBMITTED).get(moduleId),
      );

      if (existing !== null) {
        // Already submitted: a no-op that returns the existing GateStatus.
        // Original submittedAt, answers, and Checkpoint passedAt all kept.
        const checkpoint = await read<Checkpoint>(
          tx.objectStore(CHECKPOINTS).get(moduleId),
        );
        await committed(tx);
        return toGateStatus(moduleId, existing, checkpoint);
      }

      const now = new Date().toISOString();
      const submitted: SubmittedChecklist = {
        moduleId,
        answers,
        submittedAt: now,
      };
      // The Checkpoint: written exactly once, at the moment the gate passes.
      const checkpoint: Checkpoint = { moduleId, passedAt: now };
      tx.objectStore(SUBMITTED).put(submitted);
      tx.objectStore(CHECKPOINTS).put(checkpoint);
      tx.objectStore(DRAFTS).delete(moduleId);
      await committed(tx);
      return toGateStatus(moduleId, submitted, checkpoint);
    },

    async saveChecklistDraft(
      moduleId: ModuleId,
      partialAnswers: PartialChecklistAnswers,
    ): Promise<void> {
      const tx = db.transaction([SUBMITTED, DRAFTS], 'readwrite');
      const submitted = await read<SubmittedChecklist>(
        tx.objectStore(SUBMITTED).get(moduleId),
      );
      if (submitted === null) {
        // Replace, last write wins. Never a gate input.
        const draft: ChecklistDraft = {
          moduleId,
          answers: partialAnswers,
          savedAt: new Date().toISOString(),
        };
        tx.objectStore(DRAFTS).put(draft);
      }
      // On an already-submitted Module autosave is a no-op.
      await committed(tx);
    },

    async getChecklistDraft(moduleId: ModuleId): Promise<ChecklistDraft | null> {
      const tx = db.transaction(DRAFTS, 'readonly');
      return read<ChecklistDraft>(tx.objectStore(DRAFTS).get(moduleId));
    },

    getSubmittedChecklist(
      moduleId: ModuleId,
    ): Promise<SubmittedChecklist | null> {
      return readSubmitted(moduleId);
    },

    async getGateStatus(moduleId: ModuleId): Promise<GateStatus> {
      // A pure read, derived from the stored records on every call. Unknown
      // or pending Modules simply have no records: not passed, never a throw.
      const tx = db.transaction([SUBMITTED, CHECKPOINTS], 'readonly');
      const [submitted, checkpoint] = await Promise.all([
        read<SubmittedChecklist>(tx.objectStore(SUBMITTED).get(moduleId)),
        read<Checkpoint>(tx.objectStore(CHECKPOINTS).get(moduleId)),
      ]);
      return toGateStatus(moduleId, submitted, checkpoint);
    },

    async listCheckpoints(): Promise<readonly Checkpoint[]> {
      const tx = db.transaction(CHECKPOINTS, 'readonly');
      const all = await readAll<Checkpoint>(tx.objectStore(CHECKPOINTS).getAll());
      return byModuleId(all);
    },

    async getCheckpoint(moduleId: ModuleId): Promise<Checkpoint | null> {
      const tx = db.transaction(CHECKPOINTS, 'readonly');
      return read<Checkpoint>(tx.objectStore(CHECKPOINTS).get(moduleId));
    },

    async exportState(): Promise<ProgressState> {
      const tx = db.transaction([...ALL_STORES], 'readonly');
      const [checkpoints, submittedChecklists, checklistDrafts] =
        await Promise.all([
          readAll<Checkpoint>(tx.objectStore(CHECKPOINTS).getAll()),
          readAll<SubmittedChecklist>(tx.objectStore(SUBMITTED).getAll()),
          readAll<ChecklistDraft>(tx.objectStore(DRAFTS).getAll()),
        ]);
      return {
        schemaVersion: 1,
        checkpoints: byModuleId(checkpoints),
        submittedChecklists: byModuleId(submittedChecklists),
        checklistDrafts: byModuleId(checklistDrafts),
      };
    },

    async importState(state: ProgressState): Promise<void> {
      // Both rejections happen BEFORE the transaction opens, so a rejected
      // import changes nothing.
      if (state.schemaVersion !== 1) {
        throw new Error(
          `importState: unknown schemaVersion ${String(state.schemaVersion)}`,
        );
      }
      const seen = new Set<ModuleId>();
      for (const checkpoint of state.checkpoints) {
        if (seen.has(checkpoint.moduleId)) {
          throw new Error(
            `importState: more than one Checkpoint for '${checkpoint.moduleId}'`,
          );
        }
        seen.add(checkpoint.moduleId);
      }

      // Replace all three stores wholesale in one transaction.
      const tx = db.transaction([...ALL_STORES], 'readwrite');
      for (const store of ALL_STORES) tx.objectStore(store).clear();
      for (const record of state.checkpoints) {
        tx.objectStore(CHECKPOINTS).put(record);
      }
      for (const record of state.submittedChecklists) {
        tx.objectStore(SUBMITTED).put(record);
      }
      for (const record of state.checklistDrafts) {
        tx.objectStore(DRAFTS).put(record);
      }
      await committed(tx);
    },
  };
}
