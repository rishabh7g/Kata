// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The 16/24/32 gutter ramp (#107), replacing the single fixed 40px gutter.
 *
 * jsdom does not lay out and does not resolve `env()`/`max()`, so this is a
 * source test: read `src/styles/app.css` and assert the tokens and the
 * min-width switches exist.
 */

const appCss = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

describe('the gutter ramp (#107)', () => {
  it('defines the three gutter tokens and --gutter in :root', () => {
    const root = /:root\s*\{([\s\S]*?)\n\}/.exec(appCss)?.[1] ?? '';
    expect(root).toMatch(/--gutter-sm:\s*16px/);
    expect(root).toMatch(/--gutter-md:\s*24px/);
    expect(root).toMatch(/--gutter-lg:\s*32px/);
    expect(root).toMatch(/--gutter:\s*var\(--gutter-sm\)/);
  });

  it('switches --gutter to the md/lg tokens at the two min-width breakpoints', () => {
    expect(appCss).toMatch(
      /@media \(min-width: 768px\)\s*\{\s*:root\s*\{\s*--gutter:\s*var\(--gutter-md\);/,
    );
    expect(appCss).toMatch(
      /@media \(min-width: 1024px\)\s*\{\s*:root\s*\{\s*--gutter:\s*var\(--gutter-lg\);/,
    );
  });

  it('drops the literal 40px gutter', () => {
    expect(appCss).not.toMatch(/--layout-gutter/);
    const container = /\.app-container\s*\{([\s\S]*?)\}/.exec(appCss)?.[1] ?? '';
    expect(container).not.toMatch(/40px/);
  });

  it('.app-container uses var(--gutter) with the landscape safe-area insets', () => {
    const container = /\.app-container\s*\{([\s\S]*?)\}/.exec(appCss)?.[1] ?? '';
    expect(container).toMatch(
      /padding-left:\s*max\(var\(--gutter\),\s*env\(safe-area-inset-left\)\)/,
    );
    expect(container).toMatch(
      /padding-right:\s*max\(var\(--gutter\),\s*env\(safe-area-inset-right\)\)/,
    );
  });

  it('records the ramp in design/tokens.json rather than a single gutter value', () => {
    const tokens: { layout: { gutter: unknown } } = JSON.parse(
      readFileSync(new URL('../../design/tokens.json', import.meta.url), 'utf8'),
    );
    expect(typeof tokens.layout.gutter).toBe('object');
    expect(tokens.layout.gutter).toMatchObject({ sm: 16, md: 24, lg: 32 });
  });
});
