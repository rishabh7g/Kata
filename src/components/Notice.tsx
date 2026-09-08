import type { ReactNode } from 'react';

/**
 * The app's one failure surface: a quiet 2px-rule panel that names what went
 * wrong and what the reader can do about it.
 *
 * Presentational only, so any screen can raise one — the blocked progress
 * store and a Module whose content will not load are the same shape and
 * share this rather than growing a second panel.
 *
 * **A notice is the screen when it is raised**, so its title is that
 * screen's `h1`: nothing loaded to sit above it, and an `h2` alone would
 * leave the failure states with no outline to navigate. The tag is the
 * level, never the size — `.app-notice-title` carries the 16px size.
 * A notice raised inside a screen that already has an `h1` would need a
 * level prop; nothing does that today.
 */
export function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="app-notice" role="alert">
      <h1 className="app-notice-title">{title}</h1>
      {children}
    </section>
  );
}
