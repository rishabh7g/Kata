/**
 * The ghost back button's arrow, copied from the design reference
 * (design/DevGym.dc.html § Module / § Exercise): 14px, 2 stroke, decorative
 * — the link text next to it is the accessible name.
 *
 * Shared by every back link: Module → Curriculum, Exercise → Module, and the
 * unavailable-content surface (#69).
 */
export function BackArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}
