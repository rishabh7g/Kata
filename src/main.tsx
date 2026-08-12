import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { CurriculumProvider } from './app/CurriculumContext';
import { ProgressProvider } from './app/ProgressContext';
import { createCurriculum, createHttpContentSource } from './curriculum';
import { createProgress } from './progress';
import { registerServiceWorker } from './pwa/register';

// design/styles.css is the app stylesheet — the single source of styling truth
// (docs/engineering.md § 1). app.css only adds the app-layer layout on top.
import '../design/styles.css';
import './styles/app.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Root element #root is missing from index.html');
}

// The one real IProgress (#14): the `kata` IndexedDB database. Opening it is
// async, so the render waits for it — the checklist (#16) writes through
// this seam and nothing else.
createProgress()
  .then((progress) => {
    // The one real ICurriculum: committed content over HTTP, with IProgress
    // as its CheckpointReader (#18). ICurriculum re-reads Checkpoints on
    // every call, so a Checkpoint the checklist just wrote unlocks the next
    // Module without a reload.
    const curriculum = createCurriculum(
      createHttpContentSource(import.meta.env.BASE_URL),
      progress,
    );
    createRoot(container).render(
      <StrictMode>
        {/* Hash routing: GitHub Pages serves static files only, so a reloaded
            deep link has to resolve to /Kata/index.html. */}
        <CurriculumProvider curriculum={curriculum}>
          <ProgressProvider progress={progress}>
            <HashRouter>
              <App />
            </HashRouter>
          </ProgressProvider>
        </CurriculumProvider>
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    // IndexedDB refusing to open (private-mode edge cases) leaves nothing
    // sensible to render — surface it rather than a blank page with no clue.
    console.error('Kata could not open its progress database', error);
  });

// Only a production build emits sw.js (src/pwa/service-worker-plugin.ts), and a
// worker left over from a dev session would only serve stale files.
if (import.meta.env.PROD) {
  registerServiceWorker();
}
