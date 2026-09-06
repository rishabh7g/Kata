/**
 * The "into this row" arrow, on the Curriculum's Module rows and the Module's
 * Exercise cards. One glyph at one size; where a surface wants it larger, its
 * own rule sizes the svg.
 */
export function ArrowRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
