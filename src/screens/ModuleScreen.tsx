import { Link, Navigate, useParams } from 'react-router-dom';
import { BackArrowIcon } from '../app/BackArrowIcon';
import { Markdown } from '../app/Markdown';
import { ModuleUnavailable } from '../app/ModuleUnavailable';
import { useCurriculum } from '../app/CurriculumContext';
import { useDocumentTitle } from '../app/useDocumentTitle';
import { useModuleDetail } from '../app/useModuleDetail';
import type { ExerciseBrief, ModelExample, ModuleDetail } from '../curriculum';
import { copy, interpolate } from '../strings/copy';
import { SelfCheck } from './SelfCheck';

/**
 * Module — the reading surface: header, Concept Page prose, Model Examples,
 * and the Exercise cards (design/README.md § Screens › 2,
 * design/screens/02-state.png, 03-state.png).
 *
 * The aside column (tokens.json layout.moduleGrid: 1fr 350px) carries the
 * Module's Self-Check (#157) — its optional questions, answered beside the
 * prose they belong to. Nothing on this screen reports a state: the header
 * carries no status tag and the aside no gate panel, because a Library never
 * measures the reader (#155, #156).
 *
 * A Module carries 0..n Exercises (#161). With none, the whole Exercises
 * section is absent — no heading and no empty-state line — so an explain-only
 * Module simply reads shorter.
 *
 * Everything rendered comes from `ICurriculum.getModule(id)` (#9). The cards
 * carry no suite status and no runs meta — the app knows nothing about the
 * learner's code (read-only decision, #3); the captures' status column is
 * historical and is not built.
 */
export function ModuleScreen() {
  const { id } = useParams();
  const curriculum = useCurriculum();
  const {
    detail: module,
    error: loadError,
    retry,
  } = useModuleDetail(curriculum, id ?? '');
  // The tab names the Module once its content is here — while it loads, and
  // for a Module that will not load at all, the tab stays plain `Kata` (#77).
  useDocumentTitle(
    module === undefined || module === null
      ? null
      : interpolate(copy.module.tabTitle, {
          ordinal: ordinalLabel(module.ordinal),
          title: module.title,
        }),
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
  // Still loading: render nothing rather than a made-up placeholder.
  if (module === undefined) return null;
  // Unknown id: back to the Curriculum, never a dead end (mirrors App.tsx).
  if (module === null) return <Navigate to="/" replace />;

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
          <Markdown source={stripConceptNote(stripLeadingTitle(module.conceptPageMarkdown))} />
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
 * A Module's ordinal as every surface writes it: two digits, zero-padded —
 * `Module 03`, never `Module 3`.
 */
export function ordinalLabel(ordinal: number): string {
  return String(ordinal).padStart(2, '0');
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
 * Drops the packs' provenance line — an emphasis-only first paragraph — from
 * the prose (#139). It is committed in the markdown source, where provenance
 * belongs, and it is not content a learner reads, so nothing renders it: this
 * used to split it out for the label row (#30) and now discards it.
 *
 * The match is on that shape alone, never on the wording, which differs
 * between the packs and has been rewritten twice (#173, #201).
 *
 * Stripping stays, rather than the whole function going away, because the
 * packs are unchanged: without it that line would land in the body and read
 * as the Concept Page's opening paragraph. Only an emphasis-only first
 * paragraph counts — anything else stays in the body untouched, so a pack
 * with no such line renders in full.
 */
function stripConceptNote(markdown: string): string {
  const match = /^\s*\*[^*\n]+\*[^\S\n]*(?:\n|$)/.exec(markdown);
  return match === null ? markdown : markdown.slice(match[0].length);
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
          ? copy.module.exercise.tagRefactor
          : copy.module.exercise.tagConstruct}
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
