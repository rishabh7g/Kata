import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { ICurriculum, ModuleSummary } from '../curriculum';

/**
 * Every Module, ordered by ordinal with derived lock state — straight from
 * `ICurriculum.getModules()`. `null` while loading; the callers (nav count,
 * Curriculum rows) render nothing until the data is here rather than a
 * made-up placeholder.
 *
 * Re-reads on every navigation (`location.key`): ICurriculum derives lock
 * state from Checkpoints at read time (#9), so a Checkpoint the checklist
 * just wrote (#16) must move the nav count and unlock the next row as soon
 * as the learner returns to the Curriculum — the always-mounted AppShell
 * would otherwise keep the count it fetched on first load (#18).
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
