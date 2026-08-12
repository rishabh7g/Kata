import type { ReactNode } from 'react';

/**
 * The app's one failure surface: a quiet 2px-rule panel that names what went
 * wrong and what the learner can do about it (design/README.md § Screens —
 * the same framing as the Exit Gate and backup panels).
 *
 * Presentational only, so any screen can raise one. #68 uses it for the
 * blocked progress store; a Module whose content will not load is the same
 * shape (#69) and should reuse this rather than grow a second panel.
 *
 * **A notice is the screen when it is raised**, so its title is that screen's
 * `h1` — nothing loaded to sit above it. It was an `h2` with no `h1` anywhere,
 * which left the failure states with no outline to navigate at all (#94). The
 * tag is the level, never the size: `.app-notice-title` carries the design
 * system's 16px card-title type, exactly as #75 moved the 13px label type off
 * `h6` onto `.module-section-label`. A notice raised *inside* a screen that
 * already has an `h1` would need a level prop; nothing does that today, and
 * `src/test/headings.ts` fails the moment something tries.
 */
export function Notice({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="app-notice" role="alert">
      <h1 className="app-notice-title">{title}</h1>
      {children}
    </section>
  );
}
