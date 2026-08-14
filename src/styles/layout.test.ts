// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * One fixed shell, one scroll area (#104).
 *
 * jsdom resolves neither `env()` nor `max()` and does not lay out, so this is
 * a source test: read `src/styles/app.css` and assert the declarations exist,
 * rather than asserting a rendered layout.
 */

const appCss = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

describe('the app shell (#104)', () => {
  it('.app-shell is a 100dvh flex column with overflow hidden', () => {
    const rule = /\.app-shell\s*\{([\s\S]*?)\}/.exec(appCss)?.[1] ?? '';
    expect(rule).toMatch(/height:\s*100%/);
    expect(rule).toMatch(/height:\s*100dvh/);
    expect(rule).toMatch(/display:\s*flex/);
    expect(rule).toMatch(/flex-direction:\s*column/);
    expect(rule).toMatch(/overflow:\s*hidden/);
  });

  it('100vh appears nowhere in the app or design stylesheets', () => {
    const designCss = readFileSync(
      new URL('../../design/styles.css', import.meta.url),
      'utf8',
    );
    expect(appCss).not.toMatch(/100vh/);
    expect(designCss).not.toMatch(/100vh/);
  });

  it('.app-main is the one scroll area', () => {
    const rule = /\.app-main\s*\{([\s\S]*?)\}/.exec(appCss)?.[1] ?? '';
    expect(rule).toMatch(/flex:\s*1/);
    expect(rule).toMatch(/min-height:\s*0/);
    expect(rule).toMatch(/overflow-y:\s*auto/);
    expect(rule).toMatch(/overflow-x:\s*hidden/);
    expect(rule).toMatch(/overscroll-behavior:\s*contain/);
  });

  it('.app-nav is flex: none and no longer relies on position: sticky', () => {
    const rule = /\.app-nav\s*\{([\s\S]*?)\}/.exec(appCss)?.[1] ?? '';
    expect(rule).toMatch(/flex:\s*none/);
    expect(rule).not.toMatch(/position:\s*sticky/);
  });

  it('html, body get height: 100%, the fallback line\'s prerequisite', () => {
    expect(appCss).toMatch(/html,\s*body\s*\{\s*height:\s*100%;/);
  });

  it('the Module and Exercise asides still pin against a scroll container', () => {
    const moduleAside = /\.module-aside\s*\{([\s\S]*?)\}/.exec(appCss)?.[1] ?? '';
    const exerciseAside =
      /\.exercise-aside\s*\{([\s\S]*?)\}/.exec(appCss)?.[1] ?? '';
    expect(moduleAside).toMatch(/position:\s*sticky/);
    expect(exerciseAside).toMatch(/position:\s*sticky/);
  });
});
