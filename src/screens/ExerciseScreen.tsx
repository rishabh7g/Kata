import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { BackArrowIcon } from '../app/BackArrowIcon';
import { LiveAnnouncement } from '../app/LiveAnnouncement';
import { ModuleUnavailable } from '../app/ModuleUnavailable';
import { useCurriculum } from '../app/CurriculumContext';
import { useProgress } from '../app/ProgressContext';
import { useDocumentTitle } from '../app/useDocumentTitle';
import { useGateStatus } from '../app/useGateStatus';
import { useModuleDetail } from '../app/useModuleDetail';
import { useModuleSummaries } from '../app/useModuleSummaries';
import type { ExerciseBrief } from '../curriculum';
import { interpolate, useStrings } from '../strings/strings';
import { BehavioralChecklist } from './BehavioralChecklist';
import { nextModuleLine, ordinalLabel } from './ModuleScreen';

/**
 * Exercise — the read surface for one brief: header, Exercise Spec grid,
 * the immutable Target Interface, and the practice-material link
 * (design/README.md § Screens › 3; screens/05-state.png, whose right-hand
 * aside is historical per the read-only decision, #3).
 *
 * Everything comes from the brief inside `ICurriculum.getModule(id)` (#9) —
 * a brief is only reachable through its Module, so the route carries both
 * ids (docs/engineering.md § 4). Kata never runs code: nothing here reports
 * on the learner's work, and the Target Interface is strictly display-only.
 *
 * The aside column (tokens.json layout.exerciseGrid: 1fr 400px) carries the
 * Behavioral Checklist panel (#16) with the gate banner under it (#19) —
 * per Module, written only through IProgress.
 */
export function ExerciseScreen() {
  const s = useStrings();
  // The gate banner's display line — and the first half of what #73
  // announces.
  const GATE_PASSED_LINE = s['gate.exercisePassedLine'];
  const { id, exerciseId } = useParams();
  const curriculum = useCurriculum();
  const {
    detail: module,
    error: loadError,
    retry,
  } = useModuleDetail(curriculum, id ?? '');
  // The banner's next-Module line names the following Module by title —
  // the poster's text rule (#17), shared via nextModuleLine.
  const modules = useModuleSummaries(curriculum);
  // Live gate state from IProgress (#14); `refresh` re-reads it when the
  // checklist submits on this screen, so the banner needs no reload (#19).
  const { gate, refresh } = useGateStatus(useProgress(), id ?? '');
  const navigate = useNavigate();
  // Empty on every load, including a load of an already-submitted Module:
  // a live region announces what arrives in it, and the gate banner that is
  // simply *there* on load is not news (#73).
  const [announcement, setAnnouncement] = useState('');
  // Looked up before the early returns because the title hook below has to be
  // called on every render — the guards that use it are unchanged.
  const exercise =
    module === undefined || module === null
      ? undefined
      : module.exercises.find((brief) => brief.id === exerciseId);
  // The tab names the brief once it is here; while the Module loads, or when
  // the id names no brief, it stays plain `Kata` (#77).
  useDocumentTitle(
    exercise === undefined ? null : `${exercise.id} ${exercise.title}`,
  );

  // The Module's content would not load: the brief lives inside it, so this
  // screen is as blank as the Module's — same surface, same way out (#69).
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
  // gate state loads with the content so the aside never flashes stale.
  if (module === undefined || modules === null || gate === undefined) {
    return null;
  }
  // Unknown Module id: back to the Curriculum, never a dead end.
  if (module === null) return <Navigate to="/" replace />;

  // Unknown brief id (or a pending Module with no briefs): back to the
  // owning Module, mirroring the unknown-Module fallback above.
  if (exercise === undefined) {
    return <Navigate to={`/modules/${module.id}`} replace />;
  }

  const ordinal = ordinalLabel(module.ordinal);
  const nextModule =
    modules.find((summary) => summary.ordinal === module.ordinal + 1) ?? null;

  return (
    <>
      <Link to={`/modules/${module.id}`} className="btn btn-ghost exercise-back">
        <BackArrowIcon />
        {interpolate(s['module.ordinalLabel'], { ordinal })}
      </Link>
      {/* Header: kicker + 40px title + the one {type}-type outline tag. The
          captures' "Test Suite · n tests" tag is dropped — a brief carries no
          test count, and a count would imply the app tracks results (#3). */}
      <header className="exercise-header">
        <p className="exercise-kicker">
          {interpolate(s['exercise.kicker'], { id: exercise.id, ordinal })}
        </p>
        <h1 className="exercise-title">{exercise.title}</h1>
        <span className="tag tag-outline">
          {exercise.type === 'refactor'
            ? s['exercise.tagRefactorType']
            : s['exercise.tagConstructType']}
        </span>
      </header>
      <div className="exercise-body">
        <div>
          <section>
            <h2 className="exercise-section-label">{s['exercise.sectionLabel.spec']}</h2>
            {/* Exactly three rows (tokens.json layout.specGrid: 130px 1fr,
                1px row rules). The captures' Workbench row is historical —
                no folder is materialized for the learner (#3). */}
            <div className="exercise-spec-grid">
              <div className="exercise-spec-label">{s['exercise.spec.concept']}</div>
              <div className="exercise-spec-value">{exercise.concept}</div>
              <div className="exercise-spec-label">{s['exercise.spec.smell']}</div>
              <div className="exercise-spec-value">{exercise.smell}</div>
              <div className="exercise-spec-label">{s['exercise.spec.sizeBudget']}</div>
              <div className="exercise-spec-value exercise-spec-value-mono">
                {interpolate(s['exercise.spec.sizeBudgetValue'], {
                  loc: exercise.sizeBudgetLoc,
                })}
              </div>
            </div>
          </section>
          <div className="hr exercise-rule" />
          <section>
            <div className="exercise-interface-heading">
              <h2 className="exercise-section-label exercise-section-label-inline">
                {s['exercise.sectionLabel.targetInterface']}
              </h2>
              <span className="tag tag-accent">{s['exercise.targetInterface.immutableTag']}</span>
            </div>
            <p className="text-muted exercise-interface-note">
              {s['exercise.targetInterface.note']}
            </p>
            {/* Display-only C# (tokens.json typeScale.app.codeTargetInterface:
                12.5 / 1.6 mono) — never a textarea, never editable. */}
            <pre className="exercise-interface-code">
              {exercise.targetInterfaceCode}
            </pre>
          </section>
          <div className="hr exercise-rule" />
          <PracticeMaterial exercise={exercise} />
        </div>
        {/* The 400px column: the Behavioral Checklist panel — the Module's
            Exit Gate (#16) — with the gate banner under it once the gate
            passes (#19). A submit on this screen re-reads the gate so the
            banner appears in the same render, no reload. */}
        <aside className="exercise-aside">
          <BehavioralChecklist
            moduleId={module.id}
            moduleOrdinal={module.ordinal}
            questions={module.checklistQuestions}
            onSubmitted={() => {
              refresh();
              // What the banner below is about to say, said once, politely:
              // focus lands on the submitted panel, so the banner appearing
              // underneath it would otherwise pass in silence (#73).
              setAnnouncement(
                `${GATE_PASSED_LINE} ${nextModuleLine(s, nextModule)}`,
              );
              // Same route, new location key: the always-mounted nav re-reads
              // its Checkpoint count in this render (useModuleSummaries keys
              // off location.key, #18) — screens/06-state.png shows the count
              // already moved while still on this screen (#30). The #29
              // import confirm uses the same trick.
              navigate('.', { replace: true });
            }}
          />
          {gate.passed && gate.checkpointAt !== null && (
            <div className="exercise-gate-banner">
              <div className="exercise-gate-banner-title">
                {GATE_PASSED_LINE}
              </div>
              <div className="exercise-gate-banner-next">
                {nextModuleLine(s, nextModule)}
              </div>
            </div>
          )}
          <LiveAnnouncement message={announcement} />
        </aside>
      </div>
    </>
  );
}

/**
 * The practice-material block (design/README.md § Screens › 3): a link out to
 * this Exercise's committed folder on GitHub, new tab. While the brief still
 * carries the `null` placeholder (until #23 commits the folders), it renders
 * a quiet disabled note instead of a dead link. No terminal, no command to
 * copy, no results area — Kata never runs anything.
 */
function PracticeMaterial({ exercise }: { exercise: ExerciseBrief }) {
  const s = useStrings();
  return (
    <section>
      <h2 className="exercise-section-label">{s['exercise.sectionLabel.practiceMaterial']}</h2>
      {exercise.folderUrl === null ? (
        <p className="text-muted exercise-folder-pending">
          {s['exercise.practiceMaterial.pending']}
        </p>
      ) : (
        <>
          <a
            href={exercise.folderUrl}
            target="_blank"
            rel="noreferrer"
            className="exercise-folder-link"
          >
            {s['exercise.practiceMaterial.linkLabel']}
          </a>
          <p className="text-muted exercise-folder-note">
            {s['exercise.practiceMaterial.noteBefore']} <code>dotnet test</code>{' '}
            {s['exercise.practiceMaterial.noteAfter']}
          </p>
        </>
      )}
    </section>
  );
}
