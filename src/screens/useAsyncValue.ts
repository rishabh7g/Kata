import { useEffect, useState, type DependencyList } from 'react';

/**
 * The value one asynchronous read answers with — `null` until it does.
 *
 * Owns the scaffold every read-on-mount hook used to carry for itself: the
 * read runs whenever `deps` change; a result that lands after the deps moved
 * on, or after unmount, is dropped rather than set; a rejection is logged
 * under `label` and leaves the value where it was, because none of the
 * callers has anything sensible to render for it. The previous value is kept
 * while a re-read is in flight, so a navigation that re-reads cached content
 * never blanks the screen.
 *
 * `load` is a fresh closure every render and is deliberately not a dep: what
 * it reads is what `deps` names.
 */
export function useAsyncValue<T>(
  load: () => Promise<T>,
  deps: DependencyList,
  label: string,
): T | null {
  const [value, setValue] = useState<T | null>(null);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((loaded) => {
        if (!cancelled) setValue(loaded);
      })
      .catch((error: unknown) => {
        console.error(label, error);
      });
    return () => {
      cancelled = true;
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return value;
}
