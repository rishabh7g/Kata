import { KataMark } from './KataMark';
import { Notice } from './Notice';

/**
 * What the learner sees when IndexedDB refuses to open (#68): site data
 * blocked for this origin, a hardened privacy profile, some embedded
 * webviews. IProgress is the app's only write path (docs/engineering.md § 4),
 * so there is no Kata to run without it — but a blank page tells the learner
 * nothing, and the browser is the only place that can fix it.
 *
 * It carries the shell's own chrome (nav lockup, container) minus the
 * Checkpoint count, which is exactly the number nobody can read right now.
 * No router and no contexts: this renders when the bootstrap never got far
 * enough to build them.
 */
export function ProgressUnavailable({ error }: { error: unknown }) {
  const detail = describeError(error);
  const origin = window.location.host;

  return (
    <div className="app-shell">
      <header className="nav app-nav">
        <span className="nav-brand app-nav-brand">
          <KataMark size={18} />
          Kata
        </span>
      </header>
      <main className="app-main">
        <div className="app-container">
          <Notice title="Kata cannot open its progress database">
            <p>
              Kata keeps your Checkpoints and Behavioral Checklist answers in
              this browser and nowhere else, and this browser will not let it
              open that storage. Site data is blocked for {origin}, or this
              window is a private or hardened mode that blocks it.
            </p>
            <p>
              Allow site data for {origin} and reload the page. Checkpoints
              already recorded are untouched — they are still in the browser
              that recorded them.
            </p>
            {detail !== null && (
              <p className="text-muted app-notice-detail">{detail}</p>
            )}
          </Notice>
        </div>
      </main>
    </div>
  );
}

/**
 * The browser's own words for the refusal, e.g. `SecurityError: blocked`.
 * Duck-typed rather than `instanceof Error`: what IndexedDB rejects with is a
 * DOMException, which does not inherit from Error everywhere.
 */
function describeError(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const { name, message } = error as { name?: unknown; message?: unknown };
  if (typeof name !== 'string' || name === '') return null;
  return typeof message === 'string' && message !== ''
    ? `${name}: ${message}`
    : name;
}
