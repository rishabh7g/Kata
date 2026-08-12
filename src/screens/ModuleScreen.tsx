import { Navigate, useParams } from 'react-router-dom';
import { Markdown } from '../app/Markdown';
import { useCurriculum } from '../app/CurriculumContext';
import { useModuleDetail } from '../app/useModuleDetail';
import type { ModelExample } from '../curriculum';

/**
 * Module — the reading surface: Concept Page prose and Model Examples
 * (design/README.md § Screens › 2, design/screens/02-state.png, 03-state.png).
 *
 * This is the main column only (#11). The header block and Exercise cards
 * land with #12, the Exit Gate aside with #13, and the pending-Module
 * placeholder copy with #28 — the aside column is already reserved so the
 * body grid (tokens.json layout.moduleGrid: 1fr 350px) is honest from day one.
 *
 * Everything rendered comes from `ICurriculum.getModule(id)` (#9): the
 * Concept Page markdown carries its own title and the
 * `LLM first draft · human-edited once · frozen` note.
 */
export function ModuleScreen() {
  const { id } = useParams();
  const module = useModuleDetail(useCurriculum(), id ?? '');

  // Still loading: render nothing rather than a made-up placeholder.
  if (module === undefined) return null;
  // Unknown id: back to the Curriculum, never a dead end (mirrors App.tsx).
  if (module === null) return <Navigate to="/" replace />;

  return (
    <div className="module-body">
      <div>
        <section>
          <h6 className="module-section-label">Concept Page</h6>
          {module.pending ? (
            // Bare minimum until the real placeholder copy lands (#28).
            <p className="text-muted">Concept Page pending.</p>
          ) : (
            <div className="module-concept">
              <Markdown source={module.conceptPageMarkdown} />
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
      </div>
      {/* The Exit Gate aside (#13) takes this column. */}
      <aside className="module-aside" />
    </div>
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
