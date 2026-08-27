import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { Category, ICurriculum } from '../curriculum';

/**
 * Every Category, in ordinal order — straight from
 * `ICurriculum.getCategories()`. `null` while loading, exactly like
 * `useModuleSummaries`: the Curriculum renders its shelves only once both
 * halves are here, never a heading over a made-up placeholder.
 *
 * Re-reads on every navigation (`location.key`) and costs nothing extra:
 * ICurriculum caches the one index load both reads come from (#158).
 */
export function useCategories(
  curriculum: ICurriculum,
): readonly Category[] | null {
  const [categories, setCategories] = useState<readonly Category[] | null>(null);
  const { key: locationKey } = useLocation();

  useEffect(() => {
    let cancelled = false;
    curriculum
      .getCategories()
      .then((loaded) => {
        if (!cancelled) setCategories(loaded);
      })
      .catch((error: unknown) => {
        // Same failure as the Module index it is read from: a first-ever
        // visit with no network. Nothing sensible to render.
        console.error('Failed to load the Categories', error);
      });
    return () => {
      cancelled = true;
    };
  }, [curriculum, locationKey]);

  return categories;
}
