import { Link } from 'react-router-dom';
import { useCurriculum } from '../app/CurriculumContext';
import { useModuleSummaries } from '../app/useModuleSummaries';
import type { ModuleSummary } from '../curriculum';

/**
 * Curriculum — the fixed, ordered Module list with lock state
 * (design/README.md § Screens › 1, design/screens/01-state.png).
 *
 * Renders exactly what `ICurriculum.getModules()` returns: ordering, the lock
 * chain and `checkpointAt` are derived there (#9), never here. The status
 * column is a tag only — no suite-run counts anywhere (verification removed
 * per the read-only decision, #3). The `In progress` outline tag needs
 * IProgress draft state and lands with #18.
 */
export function CurriculumScreen() {
  const modules = useModuleSummaries(useCurriculum());

  return (
    <>
      <header className="curriculum-header">
        <div>
          <p className="curriculum-kicker">
            Curriculum — fixed order, foundations down
          </p>
          <h1 className="curriculum-title">Learn design by producing code.</h1>
        </div>
        <p className="text-muted curriculum-intro">
          Five Modules. Advance by passing each Exit Gate — the Behavioral
          Checklist, self-assessed. No timelines, no streaks.
        </p>
      </header>
      {modules !== null && (
        <>
          {modules.map((module) => (
            <ModuleRow key={module.id} module={module} />
          ))}
          {/* The closing 2px rule after the last row (tokens.json layout.rules). */}
          <div className="curriculum-closing-rule" />
        </>
      )}
    </>
  );
}

function ModuleRow({ module }: { module: ModuleSummary }) {
  const cells = (
    <>
      <div className="curriculum-row-ordinal">
        {String(module.ordinal).padStart(2, '0')}
      </div>
      <div>
        <h3 className="curriculum-row-title">{module.title}</h3>
        <p className="text-muted curriculum-row-desc">{module.description}</p>
      </div>
      <div className="curriculum-row-status">
        <StatusTag module={module} />
      </div>
      <div className="curriculum-row-icon">
        {module.unlocked ? <ArrowRightIcon /> : <LockIcon />}
      </div>
    </>
  );

  // Locked: 0.5 opacity, not-allowed cursor, click inert — a plain div, not a
  // disabled link, so there is nothing to focus or activate.
  if (!module.unlocked) {
    return (
      <div className="curriculum-row curriculum-row-locked" aria-disabled="true">
        {cells}
      </div>
    );
  }
  return (
    <Link to={`/modules/${module.id}`} className="curriculum-row">
      {cells}
    </Link>
  );
}

function StatusTag({ module }: { module: ModuleSummary }) {
  // Locked rows carry no tag (design/README.md § Screens › 1 row states).
  if (!module.unlocked) return null;
  if (module.checkpointAt !== null) {
    return (
      <>
        <span className="tag tag-accent">Exit Gate passed</span>
        <span className="text-muted curriculum-checkpoint-date">
          Checkpoint · {formatCheckpointDate(module.checkpointAt)}
        </span>
      </>
    );
  }
  return <span className="tag tag-neutral">Ready to start</span>;
}

/** '2026-06-12T…Z' → '12 Jun 2026', the format the mock shows. */
function formatCheckpointDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Icons copied from the design reference (design/DevGym.dc.html § Curriculum).

function ArrowRightIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.5 }}
      aria-hidden="true"
    >
      <rect width="18" height="11" x="3" y="11" rx="0" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
