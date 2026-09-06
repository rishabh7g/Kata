import { useEffect } from 'react';

/**
 * The tab's name on the Curriculum, and whenever no screen has named one.
 * Not part of `copy`: a product name is not translatable prose. This is the
 * one place it lives.
 */
export const APP_TITLE = 'Kata';

/**
 * Names the current screen in `document.title`, as `<screen> · Kata`. In a
 * hash-routed SPA nothing does this on its own, and the title is how a
 * screen-reader user learns a route change happened.
 *
 * `null` gives the plain `Kata`, so a route change never leaves the previous
 * Module in the tab. Call it above a screen's early returns.
 */
export function useDocumentTitle(screen: string | null): void {
  useEffect(() => {
    document.title = screen === null ? APP_TITLE : `${screen} · ${APP_TITLE}`;
    return () => {
      // The screen that named the tab is going away; until the next one
      // names it, the app's own name is the truth.
      document.title = APP_TITLE;
    };
  }, [screen]);
}
