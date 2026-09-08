import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { ModuleUnavailable } from './ModuleUnavailable';
import { useCurriculum } from '../app/CurriculumContext';
import { useModuleDetail } from './useModuleDetail';
import type { ModuleDetail, ModuleId } from '../curriculum';

/**
 * Loads one Module and answers the three ways that can go wrong, so the two
 * screens that read a Module do not each carry the same guard triple:
 *
 * - the content would not load — the unavailable surface, with its retry;
 * - still loading — nothing, rather than a made-up placeholder;
 * - the id names no Module — back to the Curriculum, never a dead end.
 *
 * The Module reaches the screen as an argument, so the screen's own body is a
 * component that always has one. That is what lets the guards return early
 * here without a screen's hooks being called conditionally.
 */
export function ModuleGate({
  id,
  children,
}: {
  id: ModuleId;
  children: (module: ModuleDetail) => ReactNode;
}) {
  const curriculum = useCurriculum();
  const { detail, error, retry } = useModuleDetail(curriculum, id);

  if (error !== null) {
    return <ModuleUnavailable moduleId={id} error={error} onRetry={retry} />;
  }
  if (detail === undefined) return null;
  if (detail === null) return <Navigate to="/" replace />;
  return <>{children(detail)}</>;
}
