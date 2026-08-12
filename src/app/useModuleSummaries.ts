import { useEffect, useState } from 'react';
import type { ICurriculum, ModuleSummary } from '../curriculum';

/**
 * Every Module, ordered by ordinal with derived lock state — straight from
 * `ICurriculum.getModules()`. `null` while loading; the callers (nav count,
 * Curriculum rows) render nothing until the data is here rather than a
 * made-up placeholder.
 */
export function useModuleSummaries(
  curriculum: ICurriculum,
): readonly ModuleSummary[] | null {
  const [modules, setModules] = useState<readonly ModuleSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    curriculum
      .getModules()
      .then((loaded) => {
        if (!cancelled) setModules(loaded);
      })
      .catch((error: unknown) => {
        // Content is precached by the service worker, so this only fires on a
        // first-ever visit with no network. Nothing sensible to render.
        console.error('Failed to load the Module index', error);
      });
    return () => {
      cancelled = true;
    };
  }, [curriculum]);

  return modules;
}
