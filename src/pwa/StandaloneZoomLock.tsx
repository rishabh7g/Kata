import { useEffect } from 'react';

/**
 * Pinch-zoom off in the installed app, on in a browser tab. "Installed" is
 * only knowable at runtime, so this amends the viewport tag rather than
 * replacing it — a hardcoded string would drop `viewport-fit=cover` and with
 * it every safe-area inset, in exactly the mode this acts on.
 *
 * An installed reader who relies on pinch-zoom to enlarge small text cannot;
 * that is why the 16px text floor and 44px tap floor stay in force.
 */

/** The two directives this component owns — everything else in the tag is not ours. */
const LOCK = ['maximum-scale=1', 'user-scalable=no'];
const OWNED = /^(maximum-scale|user-scalable)\s*=/i;

/**
 * Strips our directives first, so it reads the CURRENT tag and cannot get
 * stuck locked after a display-mode change. Idempotent by construction.
 */
function syncViewport(meta: HTMLMetaElement, standalone: boolean): void {
  const base = meta.content
    .split(',')
    .map((d) => d.trim())
    .filter((d) => d.length > 0 && !OWNED.test(d));
  meta.content = (standalone ? [...base, ...LOCK] : base).join(', ');
}

export function StandaloneZoomLock(): null {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) return;

    const query = window.matchMedia('(display-mode: standalone)');
    const apply = (): void => syncViewport(meta, query.matches);
    apply();

    // Honour a display-mode change without a reload (installing, or the
    // installed app opened back out into a tab).
    query.addEventListener('change', apply);

    return () => {
      query.removeEventListener('change', apply);
      // Leave the tag as we found it, so an unmount never strands the app
      // zoom-locked.
      syncViewport(meta, false);
    };
  }, []);

  return null;
}
