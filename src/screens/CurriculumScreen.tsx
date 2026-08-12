import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurriculum } from '../app/CurriculumContext';
import { useProgress } from '../app/ProgressContext';
import { useModuleSummaries } from '../app/useModuleSummaries';
import type { ModuleId, ModuleSummary } from '../curriculum';
import type { IProgress } from '../progress';
import { ProgressBackup } from './ProgressBackup';

/**
 * Curriculum — the fixed, ordered Module list with lock state
 * (design/README.md § Screens › 1, design/screens/01-state.png).
 *
 * Renders exactly what `ICurriculum.getModules()` returns: ordering, the lock
 * chain and `checkpointAt` are derived there (#9), never here. The status
 * column is a tag only — no suite-run counts anywhere (verification removed
 * per the read-only decision, #3). The one thing read from IProgress directly
 * is checklist-draft existence, which ModuleSummary deliberately does not
 * carry: it drives the outline `In progress` tag (#18).
 */
export function CurriculumScreen() {
  const modules = useModuleSummaries(useCurriculum());
  const draftModuleIds = useDraftModuleIds(useProgress(), modules);

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
            <ModuleRow
              key={module.id}
              module={module}
              inProgress={draftModuleIds.has(module.id)}
            />
          ))}
          {/* The closing 2px rule after the last row (tokens.json layout.rules). */}
          <div className="curriculum-closing-rule" />
          {/* The backup story (#29): quiet export/import under the rule. */}
          <ProgressBackup />
        </>
      )}
    </>
  );
}

/**
 * The unlocked-but-unpassed Modules that have a saved Behavioral Checklist
 * draft (IProgress autosave, docs/engineering.md § 2) — the rows that show
 * the outline `In progress` tag. Locked and passed rows never need the read:
 * locked rows carry no tag, and submitChecklist deletes the Module's draft.
 */
function useDraftModuleIds(
  progress: IProgress,
  modules: readonly ModuleSummary[] | null,
): ReadonlySet<ModuleId> {
  const [draftIds, setDraftIds] = useState<ReadonlySet<ModuleId>>(new Set());

  useEffect(() => {
    if (modules === null) return;
    let cancelled = false;
    const candidates = modules.filter(
      (module) => module.unlocked && module.checkpointAt === null,
    );
    Promise.all(
      candidates.map(async (module) => ({
        id: module.id,
        draft: await progress.getChecklistDraft(module.id),
      })),
    )
      .then((results) => {
        if (cancelled) return;
        setDraftIds(
          new Set(results.filter((r) => r.draft !== null).map((r) => r.id)),
        );
      })
      .catch((error: unknown) => {
        // No draft state, no tag — the row falls back to `Ready to start`.
        console.error('Failed to read checklist drafts', error);
      });
    return () => {
      cancelled = true;
    };
  }, [progress, modules]);

  return draftIds;
}

function ModuleRow({
  module,
  inProgress,
}: {
  module: ModuleSummary;
  inProgress: boolean;
}) {
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
        <StatusTag module={module} inProgress={inProgress} />
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

function StatusTag({
  module,
  inProgress,
}: {
  module: ModuleSummary;
  inProgress: boolean;
}) {
  // Locked rows carry no visible tag (design/README.md § Screens › 1 row
  // states) — the design says "locked" with 0.5 opacity, the lock icon and the
  // `not-allowed` cursor, none of which a screen reader can see, so the row
  // read as plain text identical in shape to an unlocked one (#74). The status
  // column says it in words instead: clipped out of sight (`.visually-hidden`,
  // #73), so the capture is untouched, and placed here so it is read where
  // every other row's state is read. It also answers the question the visual
  // cues answer — why activating the row does nothing.
  if (!module.unlocked) {
    return (
      <span className="visually-hidden">
        Locked — pass the previous Module's Exit Gate to unlock it.
      </span>
    );
  }
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
  if (inProgress) {
    return <span className="tag tag-outline">In progress</span>;
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
