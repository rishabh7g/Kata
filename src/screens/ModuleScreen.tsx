import { Link, Navigate, useParams } from 'react-router-dom';
import { BackArrowIcon } from '../app/BackArrowIcon';
import { Markdown } from '../app/Markdown';
import { ModuleUnavailable } from '../app/ModuleUnavailable';
import { useCurriculum } from '../app/CurriculumContext';
import { useDocumentTitle } from '../app/useDocumentTitle';
import { useModuleDetail } from '../app/useModuleDetail';
import type { ExerciseBrief, ModelExample, ModuleDetail } from '../curriculum';
import { interpolate, useStrings } from '../strings/strings';
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
 * A pending Module (content pack not authored yet) renders the placeholder
 * state instead (#28): the prototype's muted copy blocks for Concept Page /
 * Model Examples / Exercises, and no navigable Exercise cards. It carries no
 * questions either, so it renders no aside at all.
 *
 * Everything rendered comes from `ICurriculum.getModule(id)` (#9). The cards
 * carry no suite status and no runs meta — the app knows nothing about the
 * learner's code (read-only decision, #3); the captures' status column is
 * historical and is not built.
 */
export function ModuleScreen() {
  const s = useStrings();
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
      : interpolate(s['module.tabTitle'], {
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
        {s['shell.backToCurriculum']}
      </Link>
      {/* Header: kicker + 44px title, no rule underneath
          (design/README.md § Screens › 2 header). The status tag that sat on
          the shared baseline is gone (#157): its passed state named a removed
          term, and its other two flipped on the reader's own Self-Check
          answers — a measure of the reader, which the Library does not keep. */}
      <header className="module-header">
        <p className="module-kicker">
          {interpolate(s['module.ordinalLabel'], { ordinal: ordinalLabel(module.ordinal) })}
        </p>
        <h1 className="module-title">{module.title}</h1>
      </header>
      <div className="module-body">
        <div>
          <ConceptSection module={module} />
          <div className="hr module-rule" />
          <section>
            <h2 className="module-section-label">{s['module.sectionLabel.modelExamples']}</h2>
            {module.modelExamples.length === 0 ? (
              // Pending copy per the prototype; also the quiet fallback for
              // a pack with no examples — never a blank section.
              <p className="text-muted module-pending-copy">
                {s['module.pending.modelExamples']}
              </p>
            ) : (
              module.modelExamples.map((example, index) => (
                <ModelExampleFigure key={index} example={example} />
              ))
            )}
          </section>
          <ExercisesSection module={module} />
        </div>
        {/* The Self-Check rides in the aside beside the prose it asks
            about (#157). A Module with no questions renders no aside — there
            is nothing else the column ever held. */}
        {module.selfCheckQuestions.length > 0 && (
          <aside className="module-aside">
            <SelfCheck
              moduleId={module.id}
              questions={module.selfCheckQuestions}
            />
          </aside>
        )}
      </div>
    </>
  );
}

/**
 * The Concept Page section: the section label, then the pack's prose.
 *
 * The packs still open with a provenance line — one emphasis-only paragraph
 * naming how the page was drafted — and the label row used to carry it beside
 * the label (#30). That line is authoring provenance, not learning content —
 * it told the learner how the page was made, which is nothing they read the
 * Module for — so it is no longer displayed (#139). It is still stripped,
 * because a line that stops being lifted out would otherwise reappear as the
 * first paragraph of the prose. Its wording is the packs' business and has
 * changed more than once (#173, #201), so nothing here quotes it.
 */
function ConceptSection({ module }: { module: ModuleDetail }) {
  const s = useStrings();
  if (module.pending) {
    return (
      <section>
        <h2 className="module-section-label">{s['module.sectionLabel.conceptPage']}</h2>
        {/* The pending copy: the prototype's block, reworded off the
            authoring pipeline it used to describe (#139). */}
        <p className="text-muted module-pending-copy">
          {s['module.pending.conceptPage']}
        </p>
      </section>
    );
  }

  const body = stripConceptNote(stripLeadingTitle(module.conceptPageMarkdown));
  return (
    <section>
      <h2 className="module-section-label">{s['module.sectionLabel.conceptPage']}</h2>
      <div className="module-concept">
        <Markdown source={body} />
      </div>
    </section>
  );
}

/**
 * The Exercises section — and its leading rule — or nothing at all.
 *
 * Exercises are 0..n per Module (#161): how many a Module carries is an
 * authoring convention (docs/design.md § Module anatomy — a Software Design
 * Module ships one refactor and one construct), not a schema rule. An
 * explain-only Module authors `"exercises": []` and gets no heading, no
 * empty-state line, and no divider above one: it simply reads shorter,
 * ending on its Model Examples. A section label over nothing would be the
 * screen telling the reader something is missing when nothing is.
 *
 * A pending Module is the one empty case that still speaks (#28): its pack
 * is not authored yet, so it keeps the prototype's placeholder line beside
 * the Concept Page and Model Examples ones — an absence with a reason.
 */
function ExercisesSection({ module }: { module: ModuleDetail }) {
  const s = useStrings();
  if (module.exercises.length === 0 && !module.pending) return null;
  return (
    <>
      <div className="hr module-rule" />
      <section>
        <h2 className="module-section-label">{s['module.sectionLabel.exercises']}</h2>
        {module.exercises.length === 0 ? (
          // Pending: the prototype's line, so the unauthored pack reads as
          // not-yet rather than blank. No cards, so a pending Module exposes
          // no navigable Exercise routes.
          <p className="text-muted module-pending-copy">
            {s['module.pending.exercises']}
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
    </>
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
  const s = useStrings();
  return (
    <Link
      to={`/modules/${moduleId}/exercises/${exercise.id}`}
      className="card module-exercise-card"
    >
      <span className="tag tag-outline">
        {exercise.type === 'refactor'
          ? s['module.exercise.tagRefactor']
          : s['module.exercise.tagConstruct']}
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
  const s = useStrings();
  return (
    <figure className="module-example">
      <div className="module-example-grid">
        <div className="module-example-cell">
          <div className="module-example-label">{s['module.example.before']}</div>
          <pre className="module-example-code">{example.before}</pre>
        </div>
        <div className="module-example-cell">
          <div className="module-example-label module-example-label-after">
            {s['module.example.after']}
          </div>
          <pre className="module-example-code">{example.after}</pre>
        </div>
      </div>
      <figcaption>{example.caption}</figcaption>
    </figure>
  );
}
