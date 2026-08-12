import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProgress } from '../app/ProgressContext';
import type { ProgressState } from '../progress';
import {
  PROGRESS_FILE_NAME,
  parseProgressState,
  serializeProgressState,
} from '../progress';

/**
 * Progress export/import (#29) — the backup story for a no-accounts,
 * IndexedDB-only app: a quiet footer under the Curriculum's closing rule with
 * two ghost controls. Export downloads `kata-progress.json` (exportState,
 * verbatim); import parses + validates the picked file (progress/backup.ts),
 * always shows a confirm summary before overwriting, and only then calls
 * importState — invalid or foreign JSON shows an error line and changes
 * nothing. After a confirmed import the screen re-navigates to `/` so the
 * always-mounted nav count and the rows' lock chain re-read the new state
 * (useModuleSummaries refetches per location.key, #18).
 */
export function ProgressBackup() {
  const progress = useProgress();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<ProgressState | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function exportProgress() {
    const state = await progress.exportState();
    const blob = new Blob([serializeProgressState(state)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = PROGRESS_FILE_NAME;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function readPickedFile(files: FileList | null) {
    setError(null);
    setPendingImport(null);
    const file = files?.[0];
    if (file === undefined) return;
    try {
      setPendingImport(parseProgressState(await file.text()));
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      setError(
        `Not a Kata progress file — ${reason}. Current progress is unchanged.`,
      );
    }
  }

  async function confirmImport() {
    if (pendingImport === null) return;
    try {
      await progress.importState(pendingImport);
      setPendingImport(null);
      // Same route, new location key: the nav Checkpoint count and the rows
      // re-read the imported state without a reload.
      navigate('/', { replace: true });
    } catch (cause) {
      setPendingImport(null);
      const reason = cause instanceof Error ? cause.message : String(cause);
      setError(
        `Import failed — ${reason}. Current progress is unchanged.`,
      );
    }
  }

  return (
    <footer className="curriculum-backup">
      <div className="curriculum-backup-actions">
        <button
          type="button"
          className="btn btn-ghost curriculum-backup-export"
          onClick={() => void exportProgress()}
        >
          Export progress
        </button>
        <button
          type="button"
          className="btn btn-ghost curriculum-backup-import"
          onClick={() => fileInput.current?.click()}
        >
          Import progress
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          aria-label="Progress file"
          onChange={(event) => {
            const files = event.target.files;
            // Reset first so picking the same file again re-fires change.
            event.target.value = '';
            void readPickedFile(files);
          }}
        />
      </div>
      <p className="text-muted curriculum-backup-note">
        Backup as a file: export downloads {PROGRESS_FILE_NAME} — Checkpoints
        and checklist answers. Import replaces current progress with a file's
        contents.
      </p>
      {pendingImport !== null && (
        <div className="curriculum-backup-confirm" role="alertdialog" aria-label="Confirm import">
          <p className="curriculum-backup-summary">
            {count(pendingImport.checkpoints.length, 'Checkpoint')},{' '}
            {count(pendingImport.submittedChecklists.length, 'checklist')} —
            replace current progress?
          </p>
          <div className="curriculum-backup-confirm-actions">
            <button
              type="button"
              className="btn btn-primary curriculum-backup-replace"
              onClick={() => void confirmImport()}
            >
              Replace progress
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setPendingImport(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error !== null && (
        <p role="alert" className="curriculum-backup-error">
          {error}
        </p>
      )}
    </footer>
  );
}

function count(n: number, noun: string): string {
  return `${String(n)} ${noun}${n === 1 ? '' : 's'}`;
}
