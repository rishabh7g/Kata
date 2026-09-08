import { useLocation } from 'react-router-dom';
import type { Category, ICurriculum } from '../curriculum';
import { useAsyncValue } from './useAsyncValue';

/**
 * Every Category, in ordinal order — straight from
 * `ICurriculum.getCategories()`. `null` while loading, exactly like
 * `useModuleSummaries`: the Curriculum renders its shelves only once both
 * halves are here, never a heading over a made-up placeholder.
 *
 * Re-reads on every navigation (`location.key`) and costs nothing extra:
 * ICurriculum caches the one index load both reads come from. A failed read
 * is the same failure as the Module index it is read from — a first-ever
 * visit with no network — and there is nothing sensible to render for it.
 */
export function useCategories(curriculum: ICurriculum): readonly Category[] | null {
  const { key: locationKey } = useLocation();
  return useAsyncValue(
    () => curriculum.getCategories(),
    [curriculum, locationKey],
    'Failed to load the Categories',
  );
}
