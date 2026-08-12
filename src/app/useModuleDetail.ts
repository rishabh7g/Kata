import { useEffect, useState } from 'react';
import type { ICurriculum, ModuleDetail, ModuleId } from '../curriculum';

/**
 * One Module's full detail, straight from `ICurriculum.getModule(id)` (#9).
 * `undefined` while loading (the screen renders nothing yet), `null` when the
 * id is unknown — pending vs authored is already resolved inside the detail.
 */
export function useModuleDetail(
  curriculum: ICurriculum,
  id: ModuleId,
): ModuleDetail | null | undefined {
  const [detail, setDetail] = useState<ModuleDetail | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;
    setDetail(undefined);
    curriculum
      .getModule(id)
      .then((loaded) => {
        if (!cancelled) setDetail(loaded);
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

  return detail;
}
