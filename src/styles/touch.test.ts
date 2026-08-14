// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The four unconditional app-feel rules (#106) — touch-action,
 * -webkit-tap-highlight-color and a chrome-only user-select.
 *
 * A source test: find the CSS rule (design/styles.css or app.css) whose
 * selector list contains each interactive class, and assert the shared
 * declarations resolve on it.
 */

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

const designCss = read('../../design/styles.css');
const appCss = read('./app.css');

/** All top-level rule blocks across both stylesheets, as { selectors, body }. */
function rules(css: string): { selectors: string; body: string }[] {
  const out: { selectors: string; body: string }[] = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push({ selectors: (match[1] ?? '').trim(), body: match[2] ?? '' });
  }
  return out;
}

const allRules = [...rules(designCss), ...rules(appCss)];

/** Every rule whose selector list mentions this class (as its own selector,
 * not as a compound like `.foo.bar` unless the class itself is compound). */
function rulesFor(selectorFragment: string): { selectors: string; body: string }[] {
  return allRules.filter((r) =>
    r.selectors
      .split(',')
      .map((s) => s.trim())
      .some((s) => s === selectorFragment || s.endsWith(selectorFragment)),
  );
}

function resolves(selectorFragment: string, declaration: RegExp): boolean {
  return rulesFor(selectorFragment).some((r) => declaration.test(r.body));
}

describe('touch-action and tap-highlight on every interactive surface (#106)', () => {
  const touchAction = /touch-action:\s*manipulation/;
  const tapHighlight = /-webkit-tap-highlight-color:\s*transparent/;

  // .curriculum-row, .module-exercise-card, .app-nav-brand and
  // .exercise-folder-link are all `a` under the hood (react-router Link /
  // a plain anchor); .module-back and .exercise-back are `.btn`, also `a`.
  it('the shared `a` rule carries both declarations', () => {
    expect(resolves('a', touchAction)).toBe(true);
    expect(resolves('a', tapHighlight)).toBe(true);
  });

  it('.btn carries both declarations', () => {
    expect(resolves('.btn', touchAction)).toBe(true);
    expect(resolves('.btn', tapHighlight)).toBe(true);
  });

  it('label.radio carries both declarations', () => {
    expect(resolves('label.radio', touchAction)).toBe(true);
    expect(resolves('label.radio', tapHighlight)).toBe(true);
  });

  it('.seg-opt carries both declarations', () => {
    expect(resolves('.seg-opt', touchAction)).toBe(true);
    expect(resolves('.seg-opt', tapHighlight)).toBe(true);
  });
});

describe('user-select: none on chrome only (#106)', () => {
  it('.nav and .btn are user-select: none', () => {
    expect(resolves('.nav', /user-select:\s*none/)).toBe(true);
    expect(resolves('.btn', /user-select:\s*none/)).toBe(true);
  });

  it('prose surfaces stay selectable', () => {
    for (const prose of [
      '.module-concept',
      '.module-example-code',
      '.exercise-interface-code',
    ]) {
      expect(resolves(prose, /user-select:\s*none/)).toBe(false);
    }
  });
});
