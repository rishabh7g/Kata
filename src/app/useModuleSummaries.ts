import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { ICurriculum, ModuleSummary } from '../curriculum';

/**
 * Every Module, ordered by ordinal — straight from `ICurriculum.getModules()`.
 * `null` while loading; the caller (the Curriculum rows) renders nothing until
 * the data is here rather than a made-up placeholder.
 *
 * Re-reads on every navigation (`location.key`). ICurriculum is a pure
 * function of committed content and caches it in memory (#158), so a return
 * to the Curriculum costs one cached call and the screen never has to decide
 * whether its list is still current.
 */
export function useModuleSummaries(
  curriculum: ICurriculum,
): readonly ModuleSummary[] | null {
  const [modules, setModules] = useState<readonly ModuleSummary[] | null>(null);
  const { key: locationKey } = useLocation();

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
  }, [curriculum, locationKey]);

  return modules;
}
