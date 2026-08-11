/**
 * The Kata brand mark — three steps climbing (ink) to an accent square.
 * Shape copied from design/assets/kata-mark.svg; the two fills are the token
 * variables rather than the asset's literal hexes, so the mark follows the
 * design system. Ink + accent only; never recolor, never round
 * (design/README.md § Brand).
 *
 * Decorative: in the lockup the word "Kata" next to it carries the name, so
 * the mark is hidden from assistive tech rather than announced twice.
 */
export function KataMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block' }}
    >
      <rect x="4" y="32" width="12" height="12" fill="var(--color-text)" />
      <rect x="18" y="18" width="12" height="12" fill="var(--color-text)" />
      <rect x="32" y="4" width="12" height="12" fill="var(--color-accent)" />
    </svg>
  );
}
