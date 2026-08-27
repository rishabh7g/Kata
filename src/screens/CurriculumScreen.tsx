import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurriculum } from '../app/CurriculumContext';
import { useProgress } from '../app/ProgressContext';
import { useDocumentTitle } from '../app/useDocumentTitle';
import { useModuleSummaries } from '../app/useModuleSummaries';
import type { ModuleId, ModuleSummary } from '../curriculum';
import type { IProgress } from '../progress';
import { useStrings } from '../strings/strings';
import { ProgressBackup } from './ProgressBackup';

/**
 * Curriculum — the Library's index: every Module in order, every row open to
 * read (design/README.md § Screens › 1, design/screens/01-state.png).
 *
 * Renders exactly what `ICurriculum.getModules()` returns, in its order —
 * which is a suggested reading order and nothing else
 * (docs/ubiquitous-language.md § Curriculum), so every row is a link to its
 * Module screen from the very first visit (#156). The status column is a tag
 * only — no suite-run counts anywhere (verification removed per the
 * read-only decision, #3). The one thing read from IProgress directly is
 * Self-Check draft existence, which ModuleSummary deliberately does not
 * carry: it drives the outline `In progress` tag (#18).
 */
export function CurriculumScreen() {
  const modules = useModuleSummaries(useCurriculum());
  const draftModuleIds = useDraftModuleIds(useProgress(), modules);
  // The home screen is the app itself: the tab reads plain `Kata` (#77).
  useDocumentTitle(null);
  const s = useStrings();

  return (
    <>
      {/* The kicker ("Curriculum — fixed order, foundations down") and the
          intro were read-once explainer copy — deleted on the copy pass
          (#113). What came back in their place (#134) is the orientation
          block: three first-use definitions, which the keeper test's fourth
          clause keeps (design/issue-guide.md § UI copy ban list). It sits in
          the header's 340px muted column — the one the intro used to fill
          (design/README.md § Screens › 1) — so it reads under the title at
          phone widths through the header's existing reflow, and nothing
          about the rows changes. Static text: no link, no disclosure, no
          second route into a Module. */}
      <header className="curriculum-header">
        <h1 className="curriculum-title">{s['curriculum.title']}</h1>
        <div className="curriculum-orientation text-muted">
          <p className="curriculum-orientation-line">
            {s['curriculum.orientation.module']}
          </p>
          <p className="curriculum-orientation-line">
            {s['curriculum.orientation.ownIde']}
          </p>
          <p className="curriculum-orientation-line">
            {s['curriculum.orientation.browserOnly']}
          </p>
        </div>
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
 * The Modules carrying a saved Self-Check draft (IProgress autosave,
 * docs/engineering.md § 2) — the rows that show the outline `In progress`
 * tag.
 *
 * Asked of every Module in the index, without exception (#156): the Library
 * reads the reader's own answers and nothing else, so a browser still
 * holding data from the old model renders exactly what an empty one does.
 */
function useDraftModuleIds(
  progress: IProgress,
  modules: readonly ModuleSummary[] | null,
): ReadonlySet<ModuleId> {
  const [draftIds, setDraftIds] = useState<ReadonlySet<ModuleId>>(new Set());

  useEffect(() => {
    if (modules === null) return;
    let cancelled = false;
    Promise.all(
      modules.map(async (module) => ({
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
        console.error('Failed to read Self-Check drafts', error);
      });
    return () => {
      cancelled = true;
    };
  }, [progress, modules]);

  return draftIds;
}

/**
 * One row, always a link (#156). There is no inert row state left: nothing in
 * the Library blocks the reader, so the row has no opacity of its own, no
 * `not-allowed` cursor and no icon but the arrow into the Module.
 */
function ModuleRow({
  module,
  inProgress,
}: {
  module: ModuleSummary;
  inProgress: boolean;
}) {
  return (
    <Link to={`/modules/${module.id}`} className="curriculum-row">
      <div className="curriculum-row-ordinal">
        {String(module.ordinal).padStart(2, '0')}
      </div>
      <div>
        <h2 className="curriculum-row-title">{module.title}</h2>
        <p className="text-muted curriculum-row-desc">{module.description}</p>
      </div>
      <div className="curriculum-row-status">
        <StatusTag inProgress={inProgress} />
      </div>
      <div className="curriculum-row-icon">
        <ArrowRightIcon />
      </div>
    </Link>
  );
}

/**
 * The row's one tag. Two states, both about the reader's own Self-Check
 * answers and neither a judgement: answers saved, or none yet.
 */
function StatusTag({ inProgress }: { inProgress: boolean }) {
  const s = useStrings();
  if (inProgress) {
    return <span className="tag tag-outline">{s['status.inProgress']}</span>;
  }
  return <span className="tag tag-neutral">{s['status.readyToStart']}</span>;
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
