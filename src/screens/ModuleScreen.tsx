import { Link, Navigate, useParams } from 'react-router-dom';
import { Markdown } from '../app/Markdown';
import { useCurriculum } from '../app/CurriculumContext';
import { useModuleDetail } from '../app/useModuleDetail';
import type { ExerciseBrief, ModelExample, ModuleDetail } from '../curriculum';

/**
 * Module — the reading surface: header, Concept Page prose, Model Examples,
 * and the Exercise cards (design/README.md § Screens › 2,
 * design/screens/02-state.png, 03-state.png).
 *
 * The pending-Module placeholder copy lands with #28; the aside column holds
 * the Exit Gate panel (#13) so the body grid (tokens.json layout.moduleGrid:
 * 1fr 350px) carries both columns.
 *
 * Everything rendered comes from `ICurriculum.getModule(id)` (#9). The cards
 * carry no suite status and no runs meta — the app knows nothing about the
 * learner's code (read-only decision, #3); the captures' status column is
 * historical and is not built.
 */
export function ModuleScreen() {
  const { id } = useParams();
  const module = useModuleDetail(useCurriculum(), id ?? '');

  // Still loading: render nothing rather than a made-up placeholder.
  if (module === undefined) return null;
  // Unknown id: back to the Curriculum, never a dead end (mirrors App.tsx).
  if (module === null) return <Navigate to="/" replace />;

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
            Module {String(module.ordinal).padStart(2, '0')}
          </p>
          <h1 className="module-title">{module.title}</h1>
        </div>
        <ModuleStatusTag module={module} />
      </header>
      <div className="module-body">
        <div>
          <section>
            <h6 className="module-section-label">Concept Page</h6>
            {module.pending ? (
              // Bare minimum until the real placeholder copy lands (#28).
              <p className="text-muted">Concept Page pending.</p>
            ) : (
              <div className="module-concept">
                <Markdown source={stripLeadingTitle(module.conceptPageMarkdown)} />
              </div>
            )}
          </section>
          <div className="hr module-rule" />
          <section>
            <h6 className="module-section-label">Model Examples</h6>
            {module.modelExamples.length === 0 ? (
              <p className="text-muted">Model Examples pending.</p>
            ) : (
              module.modelExamples.map((example, index) => (
                <ModelExampleFigure key={index} example={example} />
              ))
            )}
          </section>
          <div className="hr module-rule" />
          <section>
            <h6 className="module-section-label">Exercises</h6>
            {module.exercises.length === 0 ? (
              // Quiet note, never a crash; #28 adds the real pending copy.
              <p className="text-muted">Exercises pending.</p>
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
        {/* Read-only for now: no IProgress (#14) means no submitted checklist
            can exist, so the condition is always unmet here. #16/#17 wire the
            live state and the passed poster. */}
        <ExitGateAside checklistSubmitted={false} />
      </div>
    </>
  );
}

/**
 * The sticky Exit Gate panel (design/README.md § Screens › 2 › Exit Gate
 * aside): 2px-bordered, with a SINGLE condition row — "Behavioral Checklist
 * submitted" — and the checkpoint-based-progression note. The gate is the
 * checklist alone: the captures' second row ("All Exercise Test Suites
 * green") is historical per the read-only decision (#3) and is not built.
 *
 * Exported so tests can reach the met state (check icon) before #16 wires a
 * real submission; the screen itself always renders it unmet until then.
 */
export function ExitGateAside({
  checklistSubmitted,
}: {
  checklistSubmitted: boolean;
}) {
  return (
    <aside className="module-aside">
      <div className="module-gate-panel">
        <h6 className="module-section-label">Exit Gate</h6>
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
 * The header's right-aligned tag, mirroring the Curriculum row tags: the
 * `In progress` outline flip needs IProgress draft state and lands with #18.
 */
function ModuleStatusTag({ module }: { module: ModuleDetail }) {
  if (module.checkpointAt !== null) {
    return (
      <span className="tag tag-accent module-header-tag">Exit Gate passed</span>
    );
  }
  return (
    <span className="tag tag-neutral module-header-tag">Ready to start</span>
  );
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

function BackArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
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
