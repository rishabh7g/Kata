import { describeError } from './describeError';
import { KataMark } from './KataMark';
import { Notice } from './Notice';
import { interpolate, useStrings } from '../strings/strings';

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
  const s = useStrings();
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
          <Notice title={s['notice.progressUnavailable.title']}>
            <p>{interpolate(s['notice.progressUnavailable.body1'], { origin })}</p>
            <p>{interpolate(s['notice.progressUnavailable.body2'], { origin })}</p>
            {detail !== null && (
              <p className="text-muted app-notice-detail">{detail}</p>
            )}
          </Notice>
        </div>
      </main>
    </div>
  );
}
