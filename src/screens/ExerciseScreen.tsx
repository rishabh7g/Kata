import { Link, Navigate, useParams } from 'react-router-dom';
import { BackArrowIcon } from '../app/BackArrowIcon';
import { ModuleUnavailable } from '../app/ModuleUnavailable';
import { useCurriculum } from '../app/CurriculumContext';
import { useDocumentTitle } from '../app/useDocumentTitle';
import { useModuleDetail } from '../app/useModuleDetail';
import type { CategoryLanguage, ExerciseBrief } from '../curriculum';
import { LANGUAGE_LABEL_KEY, LANGUAGE_TEST_COMMAND } from '../strings/language';
import { interpolate, useStrings } from '../strings/strings';
import { ordinalLabel } from './ModuleScreen';

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
 * One column, and no state of any kind (#157): the Module's questions are its
 * Self-Check, answered on the Module screen beside the prose, and the aside
 * that used to hold them — with the gate banner under it — is gone. This
 * screen writes nothing and reads nothing from IProgress.
 */
export function ExerciseScreen() {
  const s = useStrings();
  const { id, exerciseId } = useParams();
  const curriculum = useCurriculum();
  const {
    detail: module,
    error: loadError,
    retry,
  } = useModuleDetail(curriculum, id ?? '');
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
  // Still loading: render nothing rather than a made-up placeholder.
  if (module === undefined) return null;
  // Unknown Module id: back to the Curriculum, never a dead end.
  if (module === null) return <Navigate to="/" replace />;

  // Unknown brief id (or a pending Module with no briefs): back to the
  // owning Module, mirroring the unknown-Module fallback above.
  if (exercise === undefined) {
    return <Navigate to={`/modules/${module.id}`} replace />;
  }

  const ordinal = ordinalLabel(module.ordinal);

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
        <TargetInterfaceDefinition />
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
      <PracticeMaterial exercise={exercise} language={module.language} />
    </>
  );
}

/**
 * What a Target Interface is (#136) — one clause, under the section heading
 * and above `exercise.targetInterface.note`.
 *
 * This is the first place the app defines a term three surfaces already use
 * as a label: this section heading, the Spec grid's "Target Interface" row
 * on the Module screen, and the accent `Immutable` tag right beside it. The
 * existing note only says what wanting to change it means — it presumes the
 * learner already knows what "it" is — so under clause (4) of the keeper
 * test (design/issue-guide.md § UI copy ban list, #133) the definition
 * belongs here, ahead of it. The note itself is unchanged, and stays.
 *
 * Above the `<pre>`, not inside it: the C# block is display-only and every
 * character in it is the authored Target Interface, never Kata's prose.
 */
function TargetInterfaceDefinition() {
  const s = useStrings();
  return (
    <p className="text-muted exercise-interface-definition">
      {s['exercise.targetInterface.definition']}
    </p>
  );
}

/**
 * The practice-material block (design/README.md § Screens › 3): a link out to
 * this Exercise's committed folder on GitHub, new tab. While the brief still
 * carries the `null` placeholder (until #23 commits the folders), it renders
 * a quiet disabled note instead of a dead link. No terminal, no command to
 * copy, no results area — Kata never runs anything.
 *
 * The note follows the Module's Category language (#164): a brief is
 * practised in the one language its Category is written in, so the toolchain
 * the learner installs and the command they run are the Category's, not a
 * hardcoded C# pair. Both come from `src/strings/language.ts` — the same
 * `Record<CategoryLanguage, …>` file the Curriculum's heading reads — so a
 * third language fails `tsc` there instead of silently printing the wrong
 * command here.
 */
function PracticeMaterial({
  exercise,
  language,
}: {
  exercise: ExerciseBrief;
  language: CategoryLanguage;
}) {
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
            {interpolate(s['exercise.practiceMaterial.noteBefore'], {
              language: s[LANGUAGE_LABEL_KEY[language]],
            })}{' '}
            <code>{LANGUAGE_TEST_COMMAND[language]}</code>{' '}
            {s['exercise.practiceMaterial.noteAfter']}
          </p>
        </>
      )}
    </section>
  );
}
