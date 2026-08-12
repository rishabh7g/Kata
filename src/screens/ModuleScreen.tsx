import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { BackArrowIcon } from '../app/BackArrowIcon';
import { Markdown } from '../app/Markdown';
import { ModuleUnavailable } from '../app/ModuleUnavailable';
import { useCurriculum } from '../app/CurriculumContext';
import { useProgress } from '../app/ProgressContext';
import { useDocumentTitle } from '../app/useDocumentTitle';
import { useGateStatus } from '../app/useGateStatus';
import { useModuleDetail } from '../app/useModuleDetail';
import { useModuleSummaries } from '../app/useModuleSummaries';
import type {
  ExerciseBrief,
  ModelExample,
  ModuleDetail,
  ModuleSummary,
} from '../curriculum';
import type { GateStatus, IProgress } from '../progress';

/**
 * Module — the reading surface: header, Concept Page prose, Model Examples,
 * and the Exercise cards (design/README.md § Screens › 2,
 * design/screens/02-state.png, 03-state.png).
 *
 * A pending Module (content pack not authored yet) renders the placeholder
 * state instead (#28): the prototype's muted copy blocks for Concept Page /
 * Model Examples / Exercises, no navigable Exercise cards, and a pending note
 * in the Exit Gate aside. The aside column holds the Exit Gate panel (#13) so
 * the body grid (tokens.json layout.moduleGrid: 1fr 350px) carries both
 * columns.
 *
 * Everything rendered comes from `ICurriculum.getModule(id)` (#9). The cards
 * carry no suite status and no runs meta — the app knows nothing about the
 * learner's code (read-only decision, #3); the captures' status column is
 * historical and is not built.
 */
export function ModuleScreen() {
  const { id } = useParams();
  const curriculum = useCurriculum();
  const progress = useProgress();
  const {
    detail: module,
    error: loadError,
    retry,
  } = useModuleDetail(curriculum, id ?? '');
  // The poster's next-Module line names the following Module by title (#17).
  const modules = useModuleSummaries(curriculum);
  // Live gate state from IProgress (#14): the poster and the header tag key
  // off this, not off ICurriculum's stubbed CheckpointReader (replaced in #18).
  const { gate } = useGateStatus(progress, id ?? '');
  // A saved checklist draft flips the header tag to the outline `In progress`
  // (#30) — the same rule the Curriculum rows apply (#18) and the prototype's
  // statusFor encodes (started → In progress, else Ready to start).
  const hasDraft = useHasChecklistDraft(progress, id ?? '');
  // The tab names the Module once its content is here — while it loads, and
  // for a Module that will not load at all, the tab stays plain `Kata` (#77).
  useDocumentTitle(
    module === undefined || module === null
      ? null
      : `Module ${ordinalLabel(module.ordinal)} — ${module.title}`,
  );

  // The content would not load (offline, before this Module was ever read).
  // Checked first: a failure leaves the detail `undefined`, which the loading
  // guard below would hold forever on a blank screen (#69).
  if (loadError !== null) {
    return (
      <ModuleUnavailable
        moduleId={id ?? ''}
        error={loadError}
        onRetry={retry}
      />
    );
  }
  // Still loading: render nothing rather than a made-up placeholder — the
  // gate state loads with the content so the aside never flashes unmet.
  if (module === undefined || modules === null || gate === undefined) {
    return null;
  }
  // Unknown id: back to the Curriculum, never a dead end (mirrors App.tsx).
  if (module === null) return <Navigate to="/" replace />;

  const nextModule =
    modules.find((summary) => summary.ordinal === module.ordinal + 1) ?? null;

  return (
    <>
      <Link to="/" className="btn btn-ghost module-back">
        <BackArrowIcon />
        Curriculum
      </Link>
      {/* Header: kicker + 44px title, status tag on the shared baseline,
          no rule underneath (design/README.md § Screens › 2 header). */}
      <header className="module-header">
        <div>
          <p className="module-kicker">
            Module {ordinalLabel(module.ordinal)}
          </p>
          <h1 className="module-title">{module.title}</h1>
        </div>
        <ModuleStatusTag
          module={module}
          gatePassed={gate.passed}
          inProgress={hasDraft}
        />
      </header>
      <div className="module-body">
        <div>
          <ConceptSection module={module} />
          <div className="hr module-rule" />
          <section>
            <h2 className="module-section-label">Model Examples</h2>
            {module.modelExamples.length === 0 ? (
              // Pending copy per the prototype; also the quiet fallback for
              // a pack with no examples — never a blank section.
              <p className="text-muted module-pending-copy">
                Model Examples arrive with the Concept Page.
              </p>
            ) : (
              module.modelExamples.map((example, index) => (
                <ModelExampleFigure key={index} example={example} />
              ))
            )}
          </section>
          <div className="hr module-rule" />
          <section>
            <h2 className="module-section-label">Exercises</h2>
            {module.exercises.length === 0 ? (
              // Zero briefs → the prototype's pending line: no cards, so a
              // pending Module exposes no navigable Exercise routes.
              <p className="text-muted module-pending-copy">
                No Exercises yet — the first is generated from an Exercise
                Spec.
              </p>
            ) : (
              <div className="module-exercises">
                {module.exercises.map((exercise) => (
                  <ExerciseCard
                    key={exercise.id}
                    moduleId={module.id}
                    exercise={exercise}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
        <ExitGateAside
          gate={gate}
          nextModule={nextModule}
          pending={module.pending}
        />
      </div>
    </>
  );
}

/**
 * The Concept Page section. The label row carries the pack's
 * draft/edited/frozen note beside the section label on one baseline — the prototype's
 * layout (DevGym.dc.html § Module) and screens/02–03 — rather than as the
 * first prose paragraph (#30). The note itself still travels in the markdown
 * (an emphasis-only first line); it is lifted out here, and a pack without
 * one simply renders no note.
 */
function ConceptSection({ module }: { module: ModuleDetail }) {
  if (module.pending) {
    return (
      <section>
        <h2 className="module-section-label">Concept Page</h2>
        {/* The prototype's pending copy, verbatim (DevGym.dc.html § Module,
            pending section). */}
        <p className="text-muted module-pending-copy">
          Concept Page pending — drafted by the Generator once this Module
          unlocks; one human edit, then frozen.
        </p>
      </section>
    );
  }

  const { note, body } = splitConceptNote(
    stripLeadingTitle(module.conceptPageMarkdown),
  );
  return (
    <section>
      <div className="module-concept-heading">
        <h2 className="module-section-label module-section-label-inline">
          Concept Page
        </h2>
        {note !== null && (
          <span className="text-muted module-concept-note">{note}</span>
        )}
      </div>
      <div className="module-concept">
        <Markdown source={body} />
      </div>
    </section>
  );
}

/**
 * The sticky Exit Gate aside (design/README.md § Screens › 2 › Exit Gate
 * aside), driven by live `IProgress.getGateStatus` (#17).
 *
 * Passed → the poster: accent field, bg-colored type (the one place red runs
 * as a field — tokens.json semantics.passed), "Passed." at 32px/800,
 * `Checkpoint · date` from the recorded Checkpoint, and the next-Module
 * line — or the closing line when nothing follows (Module 5).
 *
 * Not passed → the 2px-bordered panel with a SINGLE condition row —
 * "Behavioral Checklist submitted" — and the checkpoint-based-progression
 * note. The gate is the checklist alone: the captures' second row ("All
 * Exercise Test Suites green") is historical per the read-only decision (#3)
 * and is not built.
 *
 * Pending Module → the same panel carries only a pending note (#28): a
 * Behavioral Checklist that does not exist yet cannot render a condition
 * row, and there is nothing to submit.
 *
 * Exported so tests can reach every state directly — the Module 5 closing
 * line has no reachable pass path until all five packs ship (#24–#27).
 */
export function ExitGateAside({
  gate,
  nextModule,
  pending = false,
}: {
  gate: GateStatus;
  nextModule: ModuleSummary | null; // null = nothing follows (Module 5)
  pending?: boolean; // true = the Module's content pack is not authored yet
}) {
  if (gate.passed && gate.checkpointAt !== null) {
    return (
      <aside className="module-aside">
        <div className="module-gate-poster">
          <h2 className="module-gate-poster-label">Exit Gate</h2>
          <div className="module-gate-passed">Passed.</div>
          <div className="module-gate-checkpoint">
            Checkpoint · {formatCheckpointDate(gate.checkpointAt)}
          </div>
          <div className="module-gate-next">{nextModuleLine(nextModule)}</div>
        </div>
      </aside>
    );
  }

  // Pending: the note replaces the condition row — no checklist exists yet,
  // so nothing can be marked met or unmet and nothing invites a submission.
  if (pending) {
    return (
      <aside className="module-aside">
        <div className="module-gate-panel">
          <h2 className="module-section-label">Exit Gate</h2>
          <p className="text-muted module-gate-note module-gate-note-pending">
            The Behavioral Checklist arrives with the Concept Page — nothing
            to submit yet.
          </p>
        </div>
      </aside>
    );
  }

  const checklistSubmitted = gate.checklistSubmittedAt !== null;
  return (
    <aside className="module-aside">
      <div className="module-gate-panel">
        <h2 className="module-section-label">Exit Gate</h2>
        <div className="module-gate-condition">
          {checklistSubmitted ? (
            <GateCheckIcon />
          ) : (
            // The unmet marker: 14px empty ink-outline square, no icon.
            <span className="module-gate-box" />
          )}
          <div>
            <div className="module-gate-condition-title">
              Behavioral Checklist submitted
            </div>
            <div className="text-muted module-gate-condition-status">
              {checklistSubmitted ? 'Submitted' : 'Not yet submitted'}
            </div>
          </div>
        </div>
        <p className="text-muted module-gate-note">
          Checkpoint-based — advance when the gate is passed, whether that
          takes 2 days or 2 months.
        </p>
      </div>
    </aside>
  );
}

/**
 * A Module's ordinal as every surface writes it: two digits, zero-padded —
 * `Module 03`, never `Module 3`.
 */
export function ordinalLabel(ordinal: number): string {
  return String(ordinal).padStart(2, '0');
}

/**
 * The passed-state next-Module line — one text rule for the poster above and
 * the Exercise gate banner (#19): the following Module by ordinal and title,
 * or the closing line when nothing follows (Module 5).
 */
export function nextModuleLine(nextModule: ModuleSummary | null): string {
  // "… unlocked." with no "is" — the prototype's exact line (DevGym.dc.html
  // § Module nextNote) and screens/02-state.png (#30).
  return nextModule !== null
    ? `Module ${ordinalLabel(nextModule.ordinal)} — ${nextModule.title} unlocked.`
    : 'All five Modules passed — the Curriculum is complete.';
}

/**
 * The header's right-aligned tag, mirroring the Curriculum row tags exactly
 * (screens/03-state.png, prototype statusFor): passed → accent `Exit Gate
 * passed`; a saved checklist draft → outline `In progress` (#30); otherwise
 * the neutral `Ready to start`.
 */
function ModuleStatusTag({
  module,
  gatePassed,
  inProgress,
}: {
  module: ModuleDetail;
  gatePassed: boolean;
  inProgress: boolean;
}) {
  if (gatePassed || module.checkpointAt !== null) {
    return (
      <span className="tag tag-accent module-header-tag">Exit Gate passed</span>
    );
  }
  if (inProgress) {
    return (
      <span className="tag tag-outline module-header-tag">In progress</span>
    );
  }
  return (
    <span className="tag tag-neutral module-header-tag">Ready to start</span>
  );
}

/**
 * Whether the Module has a saved Behavioral Checklist draft — the same read
 * the Curriculum rows make for their `In progress` tag (#18). `false` while
 * loading: the tag falls back to `Ready to start` rather than flashing.
 */
function useHasChecklistDraft(progress: IProgress, moduleId: string): boolean {
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setHasDraft(false);
    progress
      .getChecklistDraft(moduleId)
      .then((draft) => {
        if (!cancelled) setHasDraft(draft !== null);
      })
      .catch((error: unknown) => {
        // No draft state, no tag flip — the header shows `Ready to start`.
        console.error(`Failed to read the checklist draft for ${moduleId}`, error);
      });
    return () => {
      cancelled = true;
    };
  }, [progress, moduleId]);

  return hasDraft;
}

/**
 * The authored packs open their Concept Page markdown with the Module's own
 * `# title`; the header h1 above already shows it, so that one leading
 * heading is dropped before rendering — otherwise the title would appear
 * twice. Every other heading shifts one level down inside Markdown.
 */
function stripLeadingTitle(markdown: string): string {
  return markdown.replace(/^\s*#[^\S\n]+[^\n]*\n?/, '');
}

/**
 * Lifts the packs' `*LLM first draft · human-edited once · frozen*` line out
 * of the prose so the label row can carry it (#30). Only an emphasis-only
 * first paragraph counts — anything else stays in the body untouched.
 */
export function splitConceptNote(markdown: string): {
  note: string | null;
  body: string;
} {
  const match = /^\s*\*([^*\n]+)\*[^\S\n]*(?:\n|$)/.exec(markdown);
  if (match === null) return { note: null, body: markdown };
  return {
    note: (match[1] ?? '').trim(),
    body: markdown.slice(match[0].length),
  };
}

/** '2026-06-12T…Z' → '12 Jun 2026' — as on the Curriculum rows (#10). */
function formatCheckpointDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * One Exercise card: type tag (outline), 16px/800 title + Smell line, arrow.
 * The whole card is the link — the route carries both ids because a brief is
 * only reachable through its Module (docs/engineering.md § 4). No status
 * column and no runs meta, per the read-only decision (#3).
 */
function ExerciseCard({
  moduleId,
  exercise,
}: {
  moduleId: string;
  exercise: ExerciseBrief;
}) {
  return (
    <Link
      to={`/modules/${moduleId}/exercises/${exercise.id}`}
      className="card module-exercise-card"
    >
      <span className="tag tag-outline">
        {exercise.type === 'refactor' ? 'Refactor' : 'Construct'}
      </span>
      <div className="module-exercise-text">
        <div className="module-exercise-title">{exercise.title}</div>
        <div className="text-muted module-exercise-smell">{exercise.smell}</div>
      </div>
      <ArrowRightIcon />
    </Link>
  );
}

// Icons copied from the design reference (design/DevGym.dc.html § Module).

/** The met-condition check: 16px, 2.5 stroke (prototype § Exit Gate). */
function GateCheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="module-gate-check"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="module-exercise-arrow"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

/**
 * One before/after pair in the 2px-bordered grid: the 2px divider between the
 * cells is the grid gap over the divider-colored background, cells stack when
 * narrow via `repeat(auto-fit, minmax(300px, 1fr))`, and long code lines
 * scroll inside their cell — never the page (all in app.css).
 */
function ModelExampleFigure({ example }: { example: ModelExample }) {
  return (
    <figure className="module-example">
      <div className="module-example-grid">
        <div className="module-example-cell">
          <div className="module-example-label">Before</div>
          <pre className="module-example-code">{example.before}</pre>
        </div>
        <div className="module-example-cell">
          <div className="module-example-label module-example-label-after">
            After
          </div>
          <pre className="module-example-code">{example.after}</pre>
        </div>
      </div>
      <figcaption>{example.caption}</figcaption>
    </figure>
  );
}
