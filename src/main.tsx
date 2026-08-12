import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { CurriculumProvider } from './app/CurriculumContext';
import { createCurriculum, createHttpContentSource } from './curriculum';
import { registerServiceWorker } from './pwa/register';

// design/styles.css is the app stylesheet — the single source of styling truth
// (docs/engineering.md § 1). app.css only adds the app-layer layout on top.
import '../design/styles.css';
import './styles/app.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Root element #root is missing from index.html');
}

// The one real ICurriculum: committed content over HTTP, plus the Checkpoint
// seam. IProgress (#14) satisfies CheckpointReader and replaces the stub in
// #18; until then no Checkpoints exist, so Module 1 is unlocked, 2–5 locked.
const curriculum = createCurriculum(
  createHttpContentSource(import.meta.env.BASE_URL),
  { listCheckpoints: async () => [] },
);

createRoot(container).render(
  <StrictMode>
    {/* Hash routing: GitHub Pages serves static files only, so a reloaded
        deep link has to resolve to /Kata/index.html. */}
    <CurriculumProvider curriculum={curriculum}>
      <HashRouter>
        <App />
      </HashRouter>
    </CurriculumProvider>
  </StrictMode>,
);

// Only a production build emits sw.js (src/pwa/service-worker-plugin.ts), and a
// worker left over from a dev session would only serve stale files.
if (import.meta.env.PROD) {
  registerServiceWorker();
}
