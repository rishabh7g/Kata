// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The 16px body-text floor (#108).
 *
 * The house UI standard turns zoom off once the app is installed, so no text
 * a learner reads as body copy may render below 16px — an installed user has
 * no way to zoom back out. This is a source test: read the two stylesheets
 * and scan every `font-size` declaration, rather than a rendered layout.
 *
 * Two categories are not body text and are allow-listed below: the uppercase
 * micro-labels that act as section furniture (kickers, section labels, the
 * example BEFORE/AFTER labels, the exercise spec label, and
 * design/styles.css's own card kicker), and display type above 16px, which
 * this floor never touches.
 */

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

const appCss = read('./app.css');
const designCss = read('../../design/styles.css');

// Uppercase, section-furniture labels — never prose a learner reads a
// sentence in. Keep this list in sync with the classes design/README.md and
// app.css's own comments call out as label type, not body copy.
const ALLOWED_LABEL_SELECTORS = new Set([
  // app.css — the shared label rule (#75) and every screen's kicker.
  '.module-section-label',
  '.module-gate-poster-label',
  '.exercise-section-label',
  '.exercise-section-label-inline',
  '.module-kicker',
  '.exercise-kicker',
  '.exercise-spec-label',
  '.module-example-label',
  // design/styles.css — the design system's own kicker, same role as the
  // app's kickers above.
  '.card-kicker',
]);

/** Every `selector { ... font-size: Npx ... }` block in a stylesheet. */
function fontSizeDeclarations(
  css: string,
): { selectors: string[]; px: number }[] {
  const out: { selectors: string[]; px: number }[] = [];
  for (const block of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectorText = (block[1] ?? '').trim();
    const body = block[2] ?? '';
    for (const decl of body.matchAll(/font-size:\s*([\d.]+)px/g)) {
      out.push({
        selectors: selectorText.split(',').map((s) => s.trim()),
        px: Number(decl[1]),
      });
    }
  }
  return out;
}

function isAllowedLabel(selectors: string[]): boolean {
  return selectors.some((selector) =>
    [...ALLOWED_LABEL_SELECTORS].some((allowed) => selector.includes(allowed)),
  );
}

describe('the 16px body-text floor (#108)', () => {
  it('defines --text-body-min: 16px in app.css :root', () => {
    const root = /:root\s*\{([\s\S]*?)\n\}/.exec(appCss)?.[1] ?? '';
    expect(root).toMatch(/--text-body-min:\s*16px/);
  });

  it('sets body { font-size: 16px } in design/styles.css', () => {
    expect(designCss).toMatch(/body\s*\{[^}]*font-size:\s*16px/);
  });

  it('no font-size declaration in app.css is below 16px outside the label allow-list', () => {
    for (const { selectors, px } of fontSizeDeclarations(appCss)) {
      if (isAllowedLabel(selectors)) continue;
      expect(
        px,
        `${selectors.join(', ')} declares font-size: ${px}px, under the 16px body-text floor`,
      ).toBeGreaterThanOrEqual(16);
    }
  });

  it('no font-size declaration in design/styles.css is below 16px outside the label allow-list', () => {
    for (const { selectors, px } of fontSizeDeclarations(designCss)) {
      if (isAllowedLabel(selectors)) continue;
      expect(
        px,
        `${selectors.join(', ')} declares font-size: ${px}px, under the 16px body-text floor`,
      ).toBeGreaterThanOrEqual(16);
    }
  });

  it('no em/rem font-size declaration resolves under 16px against a 16px+ parent', () => {
    // Every relative font-size in both sheets was converted to an explicit
    // px value by #108 specifically so this never needs runtime resolution —
    // assert none crept back in.
    for (const css of [appCss, designCss]) {
      for (const decl of css.matchAll(/font-size:\s*([\d.]+)(em|rem)/g)) {
        throw new Error(
          `found a relative font-size (${decl[0]}) — express it in px so the floor is checkable statically`,
        );
      }
    }
  });

  it('every allow-listed label selector is actually declared uppercase somewhere', () => {
    // Guards the allow-list itself: every entry must be a real uppercase
    // label rule, not a body-copy class that snuck onto the list. Checks the
    // combined source rather than re-parsing rule blocks, since a couple of
    // the labels share one comma-separated rule (#75).
    for (const selector of ALLOWED_LABEL_SELECTORS) {
      const escaped = selector.replace('.', '\\.');
      const combined = `${appCss}\n${designCss}`;
      const selectorIndex = combined.search(new RegExp(escaped));
      expect(selectorIndex, `${selector} not found`).toBeGreaterThanOrEqual(0);
      const nextRuleClose = combined.indexOf('}', selectorIndex);
      const declBlock = combined.slice(selectorIndex, nextRuleClose);
      expect(declBlock).toMatch(/text-transform:\s*uppercase/);
    }
  });
});
