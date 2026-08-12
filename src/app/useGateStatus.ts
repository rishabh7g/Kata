import { useCallback, useEffect, useState } from 'react';
import type { GateStatus, IProgress } from '../progress';

/**
 * `IProgress.getGateStatus` for one Module — `undefined` while loading, so a
 * screen can hold its aside rather than flash the wrong gate state. Shared by
 * the Module poster (#17) and the Exercise gate banner (#19).
 *
 * `refresh` re-reads the gate in place: the Exercise screen calls it when the
 * checklist submits on that same screen, so the banner appears without a
 * manual reload (#19). A refresh keeps the current status while the re-read
 * runs — resetting to `undefined` would blank a screen that holds on it —
 * whereas a Module change resets so no stale gate ever shows.
 */
export function useGateStatus(
  progress: IProgress,
  moduleId: string,
): { gate: GateStatus | undefined; refresh: () => void } {
  const [gate, setGate] = useState<GateStatus | undefined>(undefined);
  const [readCount, setReadCount] = useState(0);

  useEffect(() => {
    setGate(undefined);
  }, [progress, moduleId]);

  useEffect(() => {
    let cancelled = false;
    progress
      .getGateStatus(moduleId)
      .then((status) => {
        if (!cancelled) setGate(status);
      })
      .catch((error: unknown) => {
        // IndexedDB refusing to open is the only real cause; the read
        // surfaces still work, so log rather than blank the screen forever.
        console.error(`Failed to load gate status for ${moduleId}`, error);
      });
    return () => {
      cancelled = true;
    };
  }, [progress, moduleId, readCount]);

  const refresh = useCallback(() => setReadCount((count) => count + 1), []);

  return { gate, refresh };
}
