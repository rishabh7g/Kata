import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from '../App';
import { CurriculumProvider } from './CurriculumContext';
import { ProgressProvider } from './ProgressContext';
import { ProgressUnavailable } from './ProgressUnavailable';
import { createCurriculum, createHttpContentSource } from '../curriculum';
import { createProgress, type IProgress } from '../progress';
import { StandaloneZoomLock } from '../pwa/StandaloneZoomLock';

/**
 * Start Kata into `container`. Lives here rather than in main.tsx so the two
 * outcomes are testable: the app, or — when IndexedDB refuses to open (#68) —
 * the message that says so.
 *
 * The wait is what makes both paths possible: opening the database is async,
 * so nothing renders until it either opened or failed. One render either way,
 * so a working IndexedDB never flashes anything first.
 */
export async function startKata(
  container: HTMLElement,
  baseUrl: string,
): Promise<void> {
  const root = createRoot(container);

  // The one real IProgress (#14): the `kata` IndexedDB database. The
  // Self-Check (#157) writes through this seam and nothing else.
  let progress: IProgress;
  try {
    progress = await createProgress();
  } catch (error: unknown) {
    // IndexedDB refusing to open (blocked site data, private-mode edge cases)
    // leaves no Kata to run: IProgress is the app's only write path. Say so
    // on the page — a console line is not something a learner ever sees.
    console.error('Kata could not open its progress database', error);
    root.render(
      <StrictMode>
        <StandaloneZoomLock />
        <ProgressUnavailable error={error} />
      </StrictMode>,
    );
    return;
  }

  // The one real ICurriculum: committed content over HTTP and nothing else
  // (#158). It reads no progress data, so the two Target Interfaces are
  // wired side by side here rather than into each other.
  const curriculum = createCurriculum(createHttpContentSource(baseUrl));

  root.render(
    <StrictMode>
      <StandaloneZoomLock />
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
}
