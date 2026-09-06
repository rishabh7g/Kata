import { Link, useParams } from 'react-router-dom';
import { ArrowRightIcon } from '../app/ArrowRightIcon';
import { BackArrowIcon } from '../app/BackArrowIcon';
import { Markdown } from '../app/Markdown';
import { ModuleGate } from '../app/ModuleGate';
import { ordinalLabel } from '../app/ordinalLabel';
import { useDocumentTitle } from '../app/useDocumentTitle';
import type { ExerciseBrief, ModelExample, ModuleDetail } from '../curriculum';
import { copy, interpolate } from '../strings/copy';
import { SelfCheck } from './SelfCheck';

/**
 * Module — the reading surface: header, the Concept Page prose, the Module's
 * Self-Check, Model Examples and the Exercise cards.
 *
 * Nothing here reports a state. The app never runs, sees or records the
 * reader's code, so a card carries no suite status and the header no tag.
 *
 * A Module carries 0..n Exercises. With none, the whole Exercises section is
 * absent — no heading, no empty-state line — so a Module that only explains
 * simply reads shorter.
 */
export function ModuleScreen() {
  const { id } = useParams();
  return (
    <ModuleGate id={id ?? ''}>
      {(module) => <ModuleView module={module} />}
    </ModuleGate>
  );
}

function ModuleView({ module }: { module: ModuleDetail }) {
  useDocumentTitle(
    interpolate(copy.module.tabTitle, {
      ordinal: ordinalLabel(module.ordinal),
      title: module.title,
    }),
  );

  return (
    <>
      <Link to="/" className="btn btn-ghost module-back">
        <BackArrowIcon />
        {copy.shell.backToCurriculum}
      </Link>
      {/* Header: kicker + 44px title, no rule underneath
          (design/README.md § Screens › 2 header). The status tag that sat on
          the shared baseline is gone (#157): its passed state named a removed
          term, and its other two flipped on the reader's own Self-Check
          answers — a measure of the reader, which the Library does not keep. */}
      <header className="module-header">
        <p className="module-kicker">
          {interpolate(copy.module.ordinalLabel, { ordinal: ordinalLabel(module.ordinal) })}
        </p>
        <h1 className="module-title">{module.title}</h1>
      </header>
      <div className="module-body">
        <div className="module-concept">
          <Markdown source={module.conceptPageMarkdown} />
        </div>
        {/* Beside the prose at 1024 and up, straight after it on a phone —
            which is where "answer them as you read" says it is. */}
        {module.selfCheckQuestions.length > 0 && (
          <aside className="module-aside">
            <SelfCheck
              moduleId={module.id}
              questions={module.selfCheckQuestions}
            />
          </aside>
        )}
        <div className="module-sections">
          {module.modelExamples.length > 0 && (
            <section>
              <div className="hr module-rule" />
              <h2 className="module-section-label">
                {copy.module.sectionLabel.modelExamples}
              </h2>
              {module.modelExamples.map((example, index) => (
                <ModelExampleFigure key={index} example={example} />
              ))}
            </section>
          )}
          <ExercisesSection module={module} />
        </div>
      </div>
    </>
  );
}

/**
 * The Exercises section, or nothing at all.
 *
 * Exercises are 0..n per Module: how many one carries is an authoring
 * convention (docs/design.md § Exercise coverage), not a schema rule. A
 * Module that only explains gets no heading and no empty-state line — it
 * simply reads shorter, ending on its Model Examples. A section label over
 * nothing is the screen telling the reader something is missing when
 * nothing is.
 */
function ExercisesSection({ module }: { module: ModuleDetail }) {
  if (module.exercises.length === 0) return null;
  return (
    <section>
      <div className="hr module-rule" />
      <h2 className="module-section-label">
        {copy.module.sectionLabel.exercises}
      </h2>
      <div className="module-exercises">
        {module.exercises.map((exercise) => (
          <ExerciseCard
            key={exercise.id}
            moduleId={module.id}
            exercise={exercise}
          />
        ))}
      </div>
    </section>
  );
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
        {exercise.type === 'refactor'
          ? copy.exercise.tagRefactor
          : copy.exercise.tagConstruct}
      </span>
      <div className="module-exercise-text">
        <div className="module-exercise-title">{exercise.title}</div>
        <div className="text-muted module-exercise-smell">{exercise.smell}</div>
      </div>
      <ArrowRightIcon />
    </Link>
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
          <div className="module-example-label">{copy.module.example.before}</div>
          <pre className="module-example-code">{example.before}</pre>
        </div>
        <div className="module-example-cell">
          <div className="module-example-label module-example-label-after">
            {copy.module.example.after}
          </div>
          <pre className="module-example-code">{example.after}</pre>
        </div>
      </div>
      <figcaption>{example.caption}</figcaption>
    </figure>
  );
}
