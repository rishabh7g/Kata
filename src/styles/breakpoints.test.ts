// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The house breakpoint set — 480 / 768 / 1024, no others (#103).
 *
 * A source test: media queries don't lay out in jsdom, so this asserts the
 * literal values and directions in the stylesheets rather than a rendered
 * reflow.
 */

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

const appCss = read('./app.css');
const designCss = read('../../design/styles.css');

// The issue's own acceptance criteria give `max-width: 767px` as the phone-band
// example — one px under the 768 min-width band it complements, so max-width
// rules never overlap the min-width rule at the same nominal breakpoint.
const ALLOWED = new Set([480, 479, 768, 767, 1024, 1023]);

describe('the breakpoint set (#103)', () => {
  it('names no 720px or 960px media query anywhere', () => {
    for (const css of [appCss, designCss]) {
      expect(css).not.toMatch(/720px/);
      expect(css).not.toMatch(/960px/);
    }
  });

  it('every breakpoint value used is one of 480/768/1024', () => {
    for (const css of [appCss, designCss]) {
      for (const match of css.matchAll(
        /@media[^{]*\((?:min|max)-width:\s*(\d+)px\)/g,
      )) {
        expect(ALLOWED.has(Number(match[1]))).toBe(true);
      }
    }
  });

  it('design/styles.css has no media queries', () => {
    expect(designCss).not.toMatch(/@media/);
  });

  it('phone-band rules use max-width; tablet/laptop rules use min-width', () => {
    // The curriculum reflow is the one phone-band rule app.css has today.
    expect(appCss).toMatch(/@media \(max-width:\s*767px\)/);
    expect(appCss).toMatch(/@media \(min-width:\s*768px\)/);
    expect(appCss).toMatch(/@media \(min-width:\s*1024px\)/);
  });

  it('no single rule brackets both a min-width and a max-width around the same value', () => {
    for (const css of [appCss, designCss]) {
      for (const block of css.matchAll(/@media\s*\(([^)]*)\)\s*\{/g)) {
        const condition = block[1];
        expect(condition).not.toMatch(/min-width.*max-width|max-width.*min-width/);
      }
    }
  });

  it('.module-body is single-column by default, two-column at 1024px', () => {
    const baseModuleBody = /\.module-body\s*\{([\s\S]*?)\}/.exec(appCss)?.[1] ?? '';
    expect(baseModuleBody).toMatch(/grid-template-columns:\s*1fr\s*;/);

    // The two-column form only appears inside a min-width: 1024px block —
    // proves it isn't the base rule any more.
    expect(appCss).toMatch(
      /@media \(min-width:\s*1024px\)\s*\{\s*\.module-body\s*\{[\s\S]*?grid-template-columns:\s*1fr 350px/,
    );
  });

  it('gives the Exercise screen no second column to reflow (#157)', () => {
    // The Exercise body lost its 400px aside with the gated model (#157):
    // one column at every width, so there is no grid left to break at 1024.
    expect(appCss).not.toMatch(/\.exercise-body/);
    expect(appCss).not.toMatch(/1fr 400px/);
  });
});
