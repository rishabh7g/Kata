import { useEffect } from 'react';

/** The tab's name on the Curriculum, and whenever no screen has named one. */
export const APP_TITLE = 'Kata';

/**
 * Names the current screen in `document.title`, as `<screen> · Kata` (#77).
 *
 * Kata is a hash-routed SPA: nothing changes the title on its own, so every
 * history entry, bookmark and tab used to read the same `Kata`. The title is
 * also how a screen-reader user learns a route change happened at all.
 *
 * Passing `null` gives the plain `Kata` — what the Curriculum wants, and what
 * a screen still loading its content passes, so a route change never leaves
 * the previous Module's name in the tab.
 *
 * Call it above the screen's own early returns, so the title is set on the
 * same render that decides what to show. It follows the mounted screen rather
 * than the history entry, which is what makes Back and Forward correct for
 * free — each entry re-renders its own screen, which re-states its own title.
 */
export function useDocumentTitle(screen: string | null): void {
  useEffect(() => {
    document.title = screen === null ? APP_TITLE : `${screen} · ${APP_TITLE}`;
    return () => {
      // The screen that named the tab is going away; the next one names it on
      // its own first effect, and until then the app's own name is the truth.
      document.title = APP_TITLE;
    };
  }, [screen]);
}
