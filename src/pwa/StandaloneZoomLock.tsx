import { useEffect } from 'react';

/**
 * Pinch-zoom off in the installed app, on in a browser tab.
 *
 * The static viewport tag (`index.html`) carries no zoom flags, so on the web
 * Kata zooms like any site and stays WCAG 2.1 SC 1.4.4 / 1.4.10 compliant.
 * Detection of "installed" is only possible client-side — the same URL is a
 * tab on one launch and the installed app on the next — so the lock has to be
 * a runtime component that amends the tag after the fact, never a build-time
 * string.
 *
 * It AMENDS the tag's existing content; it never writes a hardcoded
 * replacement. A hardcoded string would pass every other check while
 * silently dropping `viewport-fit=cover` — which turns off every
 * `env(safe-area-inset-*)` in the app in exactly the mode this component acts
 * on. `StandaloneZoomLock.test.tsx` asserts `viewport-fit=cover` survives the
 * lock — that is the assertion that catches a hardcoded rewrite.
 *
 * Accessibility, stated honestly: an installed user who relies on pinch-zoom
 * to enlarge small text cannot. That is a deliberate, declared exception for
 * the installed-app feel — it is why the 16px body-text floor and the 44px
 * tap floor stay in force as compensating obligations. Browser tabs remain
 * fully compliant.
 *
 * Kata is a Vite/React-Router SPA with one shell, not a per-route server
 * render that can restore the tag — mount once, effect runs once.
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
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="viewport"]',
    );
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
