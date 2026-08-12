import { createContext, useContext, type ReactNode } from 'react';
import type { ICurriculum } from '../curriculum';

/**
 * The seam the screens read curriculum data through. main.tsx provides the
 * real ICurriculum (HTTP content + stored Checkpoints); tests provide one
 * built over an in-memory ContentSource. Screens never construct their own —
 * lock state and ordering are ICurriculum's job (#9), rendering is theirs.
 */
const CurriculumContext = createContext<ICurriculum | null>(null);

export function CurriculumProvider({
  curriculum,
  children,
}: {
  curriculum: ICurriculum;
  children: ReactNode;
}) {
  return (
    <CurriculumContext.Provider value={curriculum}>
      {children}
    </CurriculumContext.Provider>
  );
}

export function useCurriculum(): ICurriculum {
  const curriculum = useContext(CurriculumContext);
  if (curriculum === null) {
    throw new Error('useCurriculum requires a <CurriculumProvider> above it');
  }
  return curriculum;
}
