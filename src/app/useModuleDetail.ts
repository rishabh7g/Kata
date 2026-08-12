import { useCallback, useEffect, useState } from 'react';
import type { ICurriculum, ModuleDetail, ModuleId } from '../curriculum';

/** What one `getModule` call answered, and which request it answers. */
type Loaded = {
  curriculum: ICurriculum;
  id: ModuleId;
  attempt: number;
  /** `undefined` = the call rejected; `null` = the id is unknown. */
  detail: ModuleDetail | null | undefined;
  error: unknown;
};

export type ModuleDetailState = {
  /**
   * `undefined` while loading and after a failure, `null` when the id is
   * unknown — pending vs authored is already resolved inside the detail.
   */
  detail: ModuleDetail | null | undefined;
  /**
   * What `getModule(id)` rejected with, `null` otherwise. Check this before
   * `detail`: a failure leaves `detail` at `undefined`, which on its own
   * reads as "still loading" and blanks the screen forever (#69).
   */
  error: unknown;
  /** Re-run the load — the unavailable surface's `Try again` (#69). */
  retry: () => void;
};

/**
 * One Module's full detail, straight from `ICurriculum.getModule(id)` (#9).
 *
 * The result — resolved or rejected — is kept with the request that produced
 * it and handed back only when it still answers the id being asked for.
 * Clearing in an effect instead would leave one render holding the *previous*
 * Module's detail under the new id — and a child's effect (`<Navigate>`) runs
 * before this hook's, so the Exercise screen's unknown-brief fallback fired on
 * that stale render and bounced a cross-Module hash navigation back to the
 * previous Module (#67).
 *
 * A rejection is kept for the same reason a detail is: content JSON is fetched
 * network-first and cached as it is read (docs/engineering.md § 1 Offline), so
 * a Module never opened online simply fails offline, and the screen has to be
 * able to tell that apart from "still loading". A 404 is not a failure — the
 * content source turns a missing file into the pending shape.
 */
export function useModuleDetail(
  curriculum: ICurriculum,
  id: ModuleId,
): ModuleDetailState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    curriculum
      .getModule(id)
      .then((detail) => {
        if (!cancelled) {
          setLoaded({ curriculum, id, attempt, detail, error: null });
        }
      })
      .catch((error: unknown) => {
        console.error(`Failed to load Module ${id}`, error);
        if (!cancelled) {
          setLoaded({ curriculum, id, attempt, detail: undefined, error });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [curriculum, id, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  // Still loading: nothing has answered yet, or the id (or the source, or the
  // attempt) changed since this was read.
  const answersThisRequest =
    loaded !== null &&
    loaded.curriculum === curriculum &&
    loaded.id === id &&
    loaded.attempt === attempt;
  if (!answersThisRequest) return { detail: undefined, error: null, retry };

  return { detail: loaded.detail, error: loaded.error, retry };
}
