// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The header's 52px height and top safe-area inset (#105).
 *
 * jsdom resolves neither `env()` nor `max()`, so this is a source test: read
 * `src/styles/app.css` and assert the declarations are there, rather than
 * asserting a rendered layout.
 */

const appCss = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

describe('the header height and safe-area inset (#105)', () => {
  it('defines --header-height: 52px in :root', () => {
    const root = /:root\s*\{([\s\S]*?)\}/.exec(appCss)?.[1] ?? '';
    expect(root).toMatch(/--header-height:\s*52px/);
  });

  it('sets height: var(--header-height) and flex: none on .app-nav', () => {
    const rule = /\.app-nav\s*\{([\s\S]*?)\}/.exec(appCss)?.[1] ?? '';
    expect(rule).toMatch(/height:\s*var\(--header-height\)/);
    expect(rule).toMatch(/flex:\s*none/);
  });

  it('sets padding-top: max(var(--space-3), env(safe-area-inset-top)) on .app-nav', () => {
    const rule = /\.app-nav\s*\{([\s\S]*?)\}/.exec(appCss)?.[1] ?? '';
    expect(rule).toMatch(
      /padding-top:\s*max\(var\(--space-3\),\s*env\(safe-area-inset-top\)\)/,
    );
  });

  it('never uses a bare env(safe-area-inset-*) anywhere in the repo CSS', () => {
    const designCss = readFileSync(
      new URL('../../design/styles.css', import.meta.url),
      'utf8',
    );
    for (const css of [appCss, designCss]) {
      for (const declaration of css.split(';')) {
        if (declaration.includes('env(safe-area-inset-')) {
          expect(declaration).toMatch(/max\(/);
        }
      }
    }
  });
});
