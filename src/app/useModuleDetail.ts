import { useEffect, useState } from 'react';
import type { ICurriculum, ModuleDetail, ModuleId } from '../curriculum';

/** What was loaded, and which request it answers. */
type Loaded = {
  curriculum: ICurriculum;
  id: ModuleId;
  detail: ModuleDetail | null;
};

/**
 * One Module's full detail, straight from `ICurriculum.getModule(id)` (#9).
 * `undefined` while loading (the screen renders nothing yet), `null` when the
 * id is unknown — pending vs authored is already resolved inside the detail.
 *
 * The result is kept with the request that produced it and handed back only
 * when it still answers the id being asked for. Clearing in an effect instead
 * would leave one render holding the *previous* Module's detail under the new
 * id — and a child's effect (`<Navigate>`) runs before this hook's, so the
 * Exercise screen's unknown-brief fallback fired on that stale render and
 * bounced a cross-Module hash navigation back to the previous Module (#67).
 */
export function useModuleDetail(
  curriculum: ICurriculum,
  id: ModuleId,
): ModuleDetail | null | undefined {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    curriculum
      .getModule(id)
      .then((detail) => {
        if (!cancelled) setLoaded({ curriculum, id, detail });
      })
      .catch((error: unknown) => {
        // Content is cached network-first after one online visit; this only
        // fires on a first-ever visit with no network. Nothing sensible to render.
        console.error(`Failed to load Module ${id}`, error);
      });
    return () => {
      cancelled = true;
    };
  }, [curriculum, id]);

  if (loaded === null) return undefined;
  // Still loading: the id (or the source) changed since this was read.
  if (loaded.curriculum !== curriculum || loaded.id !== id) return undefined;
  return loaded.detail;
}
