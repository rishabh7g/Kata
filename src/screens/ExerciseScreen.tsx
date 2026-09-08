import { Link, Navigate, useParams } from 'react-router-dom';
import { BackArrowIcon } from '../app/BackArrowIcon';
import { ModuleGate } from '../app/ModuleGate';
import { ordinalLabel } from '../app/ordinalLabel';
import { useDocumentTitle } from '../app/useDocumentTitle';
import type { CategoryLanguage, ExerciseBrief, ModuleDetail } from '../curriculum';
import { LANGUAGE_TEST_COMMAND } from '../strings/language';
import { copy, interpolate } from '../strings/copy';

/**
 * Exercise — the read surface for one brief: header, the Exercise Spec grid,
 * the immutable Target Interface, and the practice-material link.
 *
 * A brief is only reachable through its Module, so the route carries both ids
 * and the Module is what loads. Kata never runs code: nothing here reports on
 * the reader's work, and the Target Interface is display-only.
 */
export function ExerciseScreen() {
  const { id, exerciseId } = useParams();
  return (
    <ModuleGate id={id ?? ''}>
      {(module) => <ExerciseView module={module} exerciseId={exerciseId ?? ''} />}
    </ModuleGate>
  );
}

function ExerciseView({ module, exerciseId }: { module: ModuleDetail; exerciseId: string }) {
  const exercise = module.exercises.find((brief) => brief.id === exerciseId);
  useDocumentTitle(exercise === undefined ? null : `${exercise.id} ${exercise.title}`);

  // Unknown brief id, or a Module that ships none: back to the owning Module,
  // mirroring the gate's unknown-Module fallback.
  if (exercise === undefined) {
    return <Navigate to={`/modules/${module.id}`} replace />;
  }

  const ordinal = ordinalLabel(module.ordinal);

  return (
    <>
      <Link to={`/modules/${module.id}`} className="btn btn-ghost exercise-back">
        <BackArrowIcon />
        {interpolate(copy.module.ordinalLabel, { ordinal })}
      </Link>
      {/* Kicker, title, and the one type tag. No test count: a count would
          imply the app tracks results, and it never sees them. */}
      <header className="exercise-header">
        <p className="exercise-kicker">
          {interpolate(copy.exercise.kicker, { id: exercise.id, ordinal })}
        </p>
        <h1 className="exercise-title">{exercise.title}</h1>
        <span className="tag tag-outline">
          {exercise.type === 'refactor' ? copy.exercise.tagRefactor : copy.exercise.tagConstruct}
        </span>
      </header>
      <section>
        <h2 className="exercise-section-label">{copy.exercise.sectionLabel.spec}</h2>
        {/* Exactly three rows. No folder is materialised for the reader — they
            clone one themselves. */}
        <div className="exercise-spec-grid">
          <div className="exercise-spec-label">{copy.exercise.spec.concept}</div>
          <div className="exercise-spec-value">{exercise.concept}</div>
          <div className="exercise-spec-label">{copy.exercise.spec.smell}</div>
          <div className="exercise-spec-value">{exercise.smell}</div>
          <div className="exercise-spec-label">{copy.exercise.spec.sizeBudget}</div>
          <div className="exercise-spec-value exercise-spec-value-mono">
            {interpolate(copy.exercise.spec.sizeBudgetValue, {
              loc: exercise.sizeBudgetLoc,
            })}
          </div>
        </div>
      </section>
      <div className="hr exercise-rule" />
      <section>
        <div className="exercise-interface-heading">
          <h2 className="exercise-section-label exercise-section-label-inline">
            {copy.exercise.sectionLabel.targetInterface}
          </h2>
          <span className="tag tag-accent">{copy.exercise.targetInterface.immutableTag}</span>
        </div>
        <TargetInterfaceDefinition />
        {/* Display-only — never a textarea, never editable. */}
        <pre className="exercise-interface-code">{exercise.targetInterfaceCode}</pre>
      </section>
      <div className="hr exercise-rule" />
      <PracticeMaterial exercise={exercise} language={module.language} />
    </>
  );
}

/**
 * What a Target Interface is — one clause, under the section heading.
 *
 * The first place the app defines a term three surfaces already use as a
 * label: this heading, the Spec grid's row on the Module screen, and the
 * accent `Immutable` tag beside it. It ends with the rule the tag states in
 * one word, so nothing else on the screen has to repeat it.
 *
 * Above the `<pre>`, not inside it: the code block is display-only and every
 * character in it is the authored Target Interface, never Kata's prose.
 */
function TargetInterfaceDefinition() {
  return (
    <p className="text-muted exercise-interface-definition">
      {copy.exercise.targetInterface.definition}
    </p>
  );
}

/**
 * A link out to this Exercise's committed folder on GitHub. A brief whose
 * folder is not committed yet renders a quiet note instead of a dead link.
 * No terminal, no command to copy, no results area — Kata runs nothing.
 *
 * The toolchain and the command follow the Module's Category language, from
 * the one `Record<CategoryLanguage, …>` table, so a third language fails
 * `tsc` there rather than printing the wrong command here.
 */
function PracticeMaterial({
  exercise,
  language,
}: {
  exercise: ExerciseBrief;
  language: CategoryLanguage;
}) {
  return (
    <section>
      <h2 className="exercise-section-label">{copy.exercise.sectionLabel.practiceMaterial}</h2>
      {exercise.folderUrl === null ? (
        <p className="text-muted exercise-folder-pending">
          {copy.exercise.practiceMaterial.pending}
        </p>
      ) : (
        <>
          <a
            href={exercise.folderUrl}
            target="_blank"
            rel="noreferrer"
            className="exercise-folder-link"
          >
            {copy.exercise.practiceMaterial.linkLabel}
          </a>
          <p className="text-muted exercise-folder-note">
            {interpolate(copy.exercise.practiceMaterial.noteBefore, {
              language: copy.language[language],
            })}{' '}
            <code>{LANGUAGE_TEST_COMMAND[language]}</code>{' '}
            {copy.exercise.practiceMaterial.noteAfter}
          </p>
        </>
      )}
    </section>
  );
}
