/**
 * The app's one polite announcer: an always-mounted, visually hidden live
 * region a screen sets when something changes off the learner's cursor
 * (#73 — a confirmed progress import replaces what is stored while focus
 * sits on a button that looks untouched, which a screen reader would
 * otherwise never mention).
 *
 * Mount it empty and set `message` in response to the change, never from the
 * data a plain page load already carries: a live region announces what
 * *arrives* in it, so a region rendered with its text in place on load says
 * nothing, and a region that appears with its text may say it twice.
 *
 * `polite` on purpose — the outcome is not an interruption. `Notice` (#68) is
 * the loud half of this pair: `role="alert"` for a failure that replaced the
 * screen. Any screen needing "this happened, and focus moved" can reuse this
 * one rather than grow a second region — two live regions on a page race.
 */
export function LiveAnnouncement({ message }: { message: string }) {
  return (
    <div className="visually-hidden" role="status" aria-live="polite">
      {message}
    </div>
  );
}
