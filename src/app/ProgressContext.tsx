import { createContext, useContext, type ReactNode } from 'react';
import type { IProgress } from '../progress';

/**
 * The seam the screens write and read learner progress through — the only
 * write path in the app (design/README.md § Interactions). main.tsx provides
 * the real IProgress (IndexedDB, #14); tests provide one over fake-indexeddb.
 * Screens never construct their own: Checkpoint integrity is IProgress's job,
 * rendering is theirs.
 */
const ProgressContext = createContext<IProgress | null>(null);

export function ProgressProvider({
  progress,
  children,
}: {
  progress: IProgress;
  children: ReactNode;
}) {
  return (
    <ProgressContext.Provider value={progress}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress(): IProgress {
  const progress = useContext(ProgressContext);
  if (progress === null) {
    throw new Error('useProgress requires a <ProgressProvider> above it');
  }
  return progress;
}
