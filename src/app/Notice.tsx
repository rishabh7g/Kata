import type { ReactNode } from 'react';

/**
 * The app's one failure surface: a quiet 2px-rule panel that names what went
 * wrong and what the learner can do about it (design/README.md § Screens —
 * the same framing as the Exit Gate and backup panels).
 *
 * Presentational only, so any screen can raise one. #68 uses it for the
 * blocked progress store; a Module whose content will not load is the same
 * shape (#69) and should reuse this rather than grow a second panel.
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
      <h2 className="app-notice-title">{title}</h2>
      {children}
    </section>
  );
}
