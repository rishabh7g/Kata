import { Link } from 'react-router-dom';
import { BackArrowIcon } from './BackArrowIcon';
import { describeError } from './describeError';
import { Notice } from './Notice';

/**
 * What the Module and Exercise screens show when `ICurriculum.getModule(id)`
 * rejects (#69) — in practice a `content/modules/<id>.json` fetch that failed
 * offline. Content JSON is deliberately not precached: it is cached as it is
 * read, so a Module never opened online has nothing to fall back to
 * (docs/engineering.md § 1 Offline). That is a fine trade; a blank screen is
 * not, so the state it creates gets said out loud.
 *
 * A missing content file is NOT this: a 404 means the Module is pending, and
 * `http-content-source.ts` turns it into the pending shape the Module screen
 * already renders. Reaching here means the request itself failed.
 *
 * Curriculum, never the owning Module, is the way out: the Module is exactly
 * what could not be loaded, and on the Exercise screen its own back link
 * would land on this same surface.
 */
export function ModuleUnavailable({
  moduleId,
  error,
  onRetry,
}: {
  moduleId: string;
  error: unknown;
  onRetry: () => void;
}) {
  const detail = describeError(error);

  return (
    <>
      <Link to="/" className="btn btn-ghost module-back">
        <BackArrowIcon />
        Curriculum
      </Link>
      <Notice title="This Module's content is not available">
        <p>
          Kata reads this Module from{' '}
          <code>content/modules/{moduleId}.json</code>, fetched the moment you
          open it, and that request failed. A Module is stored for offline use
          as it is read — so one you have not opened online yet is not
          available offline.
        </p>
        <p>
          Reconnect and try again. Nothing is lost: your Checkpoints and
          Behavioral Checklist answers live in this browser, not in the file
          that failed to load.
        </p>
        {detail !== null && (
          <p className="text-muted app-notice-detail">{detail}</p>
        )}
        <div className="app-notice-actions">
          <button type="button" className="btn btn-ghost" onClick={onRetry}>
            Try again
          </button>
        </div>
      </Notice>
    </>
  );
}
