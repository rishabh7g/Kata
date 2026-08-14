import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LiveAnnouncement } from '../app/LiveAnnouncement';
import { useProgress } from '../app/ProgressContext';
import type { ProgressState } from '../progress';
import {
  PROGRESS_FILE_NAME,
  parseProgressState,
  serializeProgressState,
} from '../progress';
import { interpolate, useStrings } from '../strings/strings';

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
 *
 * The confirm is the one destructive step in Kata, and it says `alertdialog`,
 * so it behaves like one (#78): opening it moves focus into it, Escape and
 * Cancel both dismiss it without touching progress, and either way focus goes
 * back to `Import progress` — the control that opened it — rather than falling
 * to <body>, where the next Tab restarts at the nav. It is deliberately not
 * modal: nothing here is a trap, the page behind stays readable, and the two
 * ways out are one keystroke and one button.
 */
export function ProgressBackup() {
  const s = useStrings();
  const progress = useProgress();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  // The control that opens the confirm, and the element focus returns to.
  const importButton = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLDivElement>(null);
  const [pendingImport, setPendingImport] = useState<ProgressState | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  // Empty except right after a confirmed import: focus lands back on a button
  // that looks untouched, so the live region is what says the replace
  // happened (#73's announcer, reused — two regions on a page race).
  const [announcement, setAnnouncement] = useState('');

  // The confirm takes focus as it opens: an alertdialog nobody is inside is
  // just a paragraph, and the summary is the question being asked.
  useEffect(() => {
    if (pendingImport === null) return;
    confirm.current?.focus();
  }, [pendingImport]);

  // Escape closes it from anywhere, not only from inside — the confirm does
  // not trap focus, so a keydown handler on the element alone would miss the
  // learner who tabbed past it.
  useEffect(() => {
    if (pendingImport === null) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      cancelImport();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pendingImport]);

  /** Dismiss with nothing written — Escape and Cancel are the same exit. */
  function cancelImport() {
    setPendingImport(null);
    importButton.current?.focus();
  }

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

  async function readPickedFile(file: File | null) {
    setError(null);
    setPendingImport(null);
    // A live region announces what *arrives* in it: emptied here so a second
    // import of the same file is announced again rather than staying silent.
    setAnnouncement('');
    if (file === null) return;
    try {
      setPendingImport(parseProgressState(await file.text()));
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      setError(interpolate(s['backup.importParseError'], { reason }));
    }
  }

  async function confirmImport() {
    if (pendingImport === null) return;
    try {
      await progress.importState(pendingImport);
      setPendingImport(null);
      setAnnouncement(
        interpolate(s['backup.importReplacedAnnouncement'], {
          checkpoints: count(pendingImport.checkpoints.length, s['backup.checkpointNoun']),
          checklists: count(
            pendingImport.submittedChecklists.length,
            s['backup.checklistNoun'],
          ),
        }),
      );
      importButton.current?.focus();
      // Same route, new location key: the nav Checkpoint count and the rows
      // re-read the imported state without a reload.
      navigate('/', { replace: true });
    } catch (cause) {
      setPendingImport(null);
      const reason = cause instanceof Error ? cause.message : String(cause);
      setError(interpolate(s['backup.importFailedError'], { reason }));
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
          {s['backup.exportLabel']}
        </button>
        <button
          ref={importButton}
          type="button"
          className="btn btn-ghost curriculum-backup-import"
          onClick={() => fileInput.current?.click()}
        >
          {s['backup.importLabel']}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          aria-label={s['backup.fileInputLabel']}
          onChange={(event) => {
            // Grab the File itself, not the FileList: in Chrome input.files
            // is the SAME live object across the reset below, so a captured
            // list is empty by the time the async read runs. A File is
            // immutable. Then reset, so re-picking the same file re-fires.
            const file = event.target.files?.[0] ?? null;
            event.target.value = '';
            void readPickedFile(file);
          }}
        />
      </div>
      <p className="text-muted curriculum-backup-note">
        {interpolate(s['backup.note'], { fileName: PROGRESS_FILE_NAME })}
      </p>
      {pendingImport !== null && (
        <div
          ref={confirm}
          className="curriculum-backup-confirm"
          role="alertdialog"
          tabIndex={-1}
          aria-label={s['backup.confirmDialogLabel']}
          aria-describedby={SUMMARY_ID}
        >
          <p className="curriculum-backup-summary" id={SUMMARY_ID}>
            {interpolate(s['backup.confirmSummary'], {
              checkpoints: count(pendingImport.checkpoints.length, s['backup.checkpointNoun']),
              checklists: count(
                pendingImport.submittedChecklists.length,
                s['backup.checklistNoun'],
              ),
            })}
          </p>
          <div className="curriculum-backup-confirm-actions">
            <button
              type="button"
              className="btn btn-primary curriculum-backup-replace"
              onClick={() => void confirmImport()}
            >
              {s['backup.confirmReplace']}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={cancelImport}
            >
              {s['backup.confirmCancel']}
            </button>
          </div>
        </div>
      )}
      <LiveAnnouncement message={announcement} />
      {error !== null && (
        <p role="alert" className="curriculum-backup-error">
          {error}
        </p>
      )}
    </footer>
  );
}

/** What the confirm is asking about — read out with its `alertdialog` name. */
const SUMMARY_ID = 'curriculum-backup-summary';

function count(n: number, noun: string): string {
  return `${String(n)} ${noun}${n === 1 ? '' : 's'}`;
}
