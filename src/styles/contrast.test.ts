// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The contrast floor (design/README.md § Contrast floor, #70).
 *
 * Colour is token-sourced: design/tokens.json is the source of truth,
 * design/styles.css declares the CSS variables, and every rule references
 * them. So the floor is checkable without a browser — resolve the tokens the
 * text roles point at, and measure them against the two grounds text ever
 * sits on. The live measurement over the rendered DOM still happens per
 * change (the PR carries it); this is the regression net that fails in CI the
 * moment a token drifts back under AA.
 */

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

const designCss = read('../../design/styles.css');
const appCss = read('./app.css');
const tokens: { color: Record<string, unknown> } = JSON.parse(
  read('../../design/tokens.json'),
);

// ── Token resolution ─────────────────────────────────────────────────────

const ROOT = /:root\s*\{([\s\S]*?)\}/.exec(designCss)?.[1] ?? '';
const declarations = new Map<string, string>();
for (const match of ROOT.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
  const [, name, value] = match;
  if (name !== undefined && value !== undefined) {
    declarations.set(name, value.trim());
  }
}

/** The hex a custom property resolves to, following `var()` references. */
function token(name: string): string {
  const value = declarations.get(name);
  if (value === undefined) throw new Error(`styles.css declares no ${name}`);
  const reference = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
  return reference === undefined ? value : token(reference);
}

// ── WCAG 2.1 relative luminance and contrast ─────────────────────────────

function luminance(hex: string): number {
  const digits = /^#([0-9a-f]{6})$/i.exec(hex)?.[1];
  if (digits === undefined) throw new Error(`not a hex colour: ${hex}`);
  const int = Number.parseInt(digits, 16);
  const linear = (value: number): number => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * linear((int >> 16) & 255) +
    0.7152 * linear((int >> 8) & 255) +
    0.0722 * linear(int & 255)
  );
}

/** `foreground` at `alpha` composited over `background`, as the browser does. */
function mix(foreground: string, alpha: number, background: string): string {
  const channels = (hex: string): number[] => {
    const int = Number.parseInt(hex.slice(1), 16);
    return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
  };
  const front = channels(foreground);
  return (
    '#' +
    channels(background)
      .map((back, index) =>
        Math.round((front[index] ?? 0) * alpha + back * (1 - alpha))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/** Rounded to 2dp, the way the issue and the PR quote the numbers. */
function contrast(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

const BG = token('--color-bg');
const SURFACE = token('--color-surface');

/** Every ground body text composites onto (design/README.md § Contrast). */
const GROUNDS: readonly [string, string][] = [
  ['--color-bg', BG],
  ['--color-surface', SURFACE],
];

/** The rule body of a single-class selector, from either stylesheet. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?:^|[},/*\\s])${escaped}\\s*\\{([^}]*)\\}`, 'm');
  const body = pattern.exec(designCss)?.[1] ?? pattern.exec(appCss)?.[1];
  if (body === undefined) throw new Error(`no rule for ${selector}`);
  return body;
}

describe('the contrast floor', () => {
  it('is a real WCAG measurement (self-check against the known pair)', () => {
    // Ink on the ground measures 14.86:1 in the browser (CDP over the
    // rendered DOM); a colour against itself is 1:1 by definition.
    expect(contrast(token('--color-text'), BG)).toBe(14.86);
    expect(contrast(BG, BG)).toBe(1);
  });

  describe('secondary text (#70)', () => {
    it.each(GROUNDS)('clears 4.5:1 on %s', (_name, ground) => {
      expect(contrast(token('--color-text-muted'), ground)).toBeGreaterThanOrEqual(4.5);
    });

    it('stays a tone below ink, so the hierarchy survives the fix', () => {
      const ink = contrast(token('--color-text'), BG);
      const muted = contrast(token('--color-text-muted'), BG);
      expect(muted).toBeLessThan(ink / 2);
    });

    it('is one token, not ink at an alpha (55% ink read 3.65:1)', () => {
      const muted = /color:\s*var\(--color-text-muted\)/;
      expect(rule('.text-muted')).toMatch(muted);
      expect(rule('figcaption')).toMatch(muted);
      expect(rule('.card-meta')).toMatch(muted);
      expect(rule('.table th')).toMatch(muted);
      expect(rule('.field > label')).toMatch(muted);
    });

    it('leaves no alpha-muted ink anywhere in either stylesheet', () => {
      // `(?<![\w-])` so a border-color, which is not text, does not match.
      const alphaMuted =
        /(?<![\w-])color:\s*color-mix\(in srgb, var\(--color-text\) \d+%, transparent\)/g;
      expect(designCss.match(alphaMuted)).toBeNull();
      expect(appCss.match(alphaMuted)).toBeNull();
    });

    it('carries the micro-labels too — they sit on the surface cell', () => {
      // neutral-600 read 3.55:1 there and 3.85:1 on the ground (#70).
      expect(rule('.module-example-label')).toMatch(
        /color:\s*var\(--color-text-muted\)/,
      );
      expect(rule('.exercise-spec-label')).toMatch(
        /color:\s*var\(--color-text-muted\)/,
      );
      expect(contrast(token('--color-neutral-600'), SURFACE)).toBeLessThan(4.5);
    });
  });

  describe('accent text (#71)', () => {
    it.each(GROUNDS)('clears 4.5:1 on %s', (_name, ground) => {
      expect(contrast(token('--color-accent-text'), ground)).toBeGreaterThanOrEqual(4.5);
    });

    it('is what every accent-coloured string points at', () => {
      const accentText = /var\(--color-accent-text\)/;
      // Links, ghost labels, outline tags, kickers, the AFTER label, the
      // import error — the roles the QA sweep measured at 3.47–3.76 (#71).
      expect(rule('a')).toMatch(accentText);
      expect(rule('.btn-ghost')).toMatch(accentText);
      expect(rule('.tag-outline')).toMatch(accentText);
      expect(rule('.card-kicker')).toMatch(accentText);
      for (const kicker of [
        '.curriculum-kicker',
        '.module-kicker',
        '.exercise-kicker',
      ]) {
        expect(rule(kicker)).toMatch(accentText);
      }
      expect(rule('.curriculum-backup-error')).toMatch(accentText);
      expect(rule('.module-example-label-after')).toMatch(accentText);
    });

    it('gives the primary action a field its label can sit on', () => {
      // The label is --color-bg on the field; the brand red gave 3.76.
      expect(rule('.btn-primary')).toMatch(/background:\s*var\(--color-accent-text\)/);
      expect(contrast(BG, token('--color-accent-text'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(BG, token('--color-accent-800'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(BG, token('--color-accent-900'))).toBeGreaterThanOrEqual(4.5);
    });

    it('leaves the brand accent as a field colour, and only where 3:1 is the bar', () => {
      // The 2px focus ring is non-text (SC 1.4.11): 3:1, on either ground.
      expect(rule(':focus-visible')).toMatch(/outline:\s*2px solid var\(--color-accent\)/);
      for (const [, ground] of GROUNDS) {
        expect(contrast(token('--color-accent'), ground)).toBeGreaterThanOrEqual(3);
      }
      // …and it is under AA for text, which is the whole point of the split.
      expect(contrast(token('--color-accent'), BG)).toBeLessThan(4.5);
    });

    it('keeps the poster label readable on the field it dims against', () => {
      // Ground-coloured type at opacity o over the brand field: 0.75 read
      // 2.63:1, under even the 3:1 the poster's display type answers to.
      const opacity = Number(
        /opacity:\s*([\d.]+)/.exec(rule('.module-gate-poster-label'))?.[1],
      );
      const field = token('--color-accent');
      const dimmed = mix(BG, opacity, field);
      expect(contrast(dimmed, field)).toBeGreaterThanOrEqual(3);
      // Still a step under the display line, so the poster keeps its hierarchy.
      expect(opacity).toBeLessThan(1);
    });
  });

  it('keeps tokens.json and styles.css saying the same thing', () => {
    expect(String(tokens.color.textMuted).startsWith(token('--color-text-muted'))).toBe(true);
    expect(String(tokens.color.accentText).startsWith(token('--color-accent-text'))).toBe(true);
    expect(String(tokens.color.accent).startsWith(token('--color-accent'))).toBe(true);
  });
});
