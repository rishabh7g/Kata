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
   * `undefined` while loading and after a failure, `null` when the id names
   * no Module in the index.
   */
  detail: ModuleDetail | null | undefined;
  /**
   * What `getModule(id)` rejected with, `null` otherwise. Check this before
   * `detail`: a failure leaves `detail` at `undefined`, which on its own
   * reads as "still loading" and blanks the screen forever.
   */
  error: unknown;
  /** Re-run the load — the unavailable surface's `Try again`. */
  retry: () => void;
};

/**
 * One Module's full detail, straight from `ICurriculum.getModule(id)`.
 *
 * The result — resolved or rejected — is kept with the request that produced
 * it and handed back only when it still answers the id being asked for.
 * Clearing in an effect instead leaves one render holding the previous
 * Module's detail under the new id, and a child's `<Navigate>` effect runs
 * first: that is what bounced a cross-Module hash navigation backwards.
 *
 * A rejection is kept because content is fetched network-first, so a Module
 * never opened online fails offline and the screen has to tell that apart
 * from "still loading".
 */
export function useModuleDetail(curriculum: ICurriculum, id: ModuleId): ModuleDetailState {
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
