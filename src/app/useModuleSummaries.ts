import { useLocation } from 'react-router-dom';
import type { ICurriculum, ModuleSummary } from '../curriculum';
import { useAsyncValue } from './useAsyncValue';

/**
 * Every Module, ordered by ordinal — straight from `ICurriculum.getModules()`.
 * `null` while loading; the caller (the Curriculum rows) renders nothing until
 * the data is here rather than a made-up placeholder.
 *
 * Re-reads on every navigation (`location.key`). ICurriculum is a pure
 * function of committed content and caches it in memory, so a return
 * to the Curriculum costs one cached call and the screen never has to decide
 * whether its list is still current. A failed read only happens on a
 * first-ever visit with no network, and there is nothing sensible to render.
 */
export function useModuleSummaries(curriculum: ICurriculum): readonly ModuleSummary[] | null {
  const { key: locationKey } = useLocation();
  return useAsyncValue(
    () => curriculum.getModules(),
    [curriculum, locationKey],
    'Failed to load the Module index',
  );
}
