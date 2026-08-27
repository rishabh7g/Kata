// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
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

/**
 * A token's value as it lands on `ground`: an alpha token (`--color-divider`
 * is ink at 40%) composites first, the way the browser paints it, so a rule
 * that paints one still measures as a real ratio rather than throwing (#97).
 */
function over(value: string, ground: string): string {
  const alpha = /^color-mix\(in srgb,\s*(#[0-9a-f]{6})\s+(\d+)%,\s*transparent\)$/i.exec(
    value,
  );
  const [, colour, percent] = alpha ?? [];
  if (colour === undefined || percent === undefined) return value;
  return mix(colour, Number(percent) / 100, ground);
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

/** Every selector in a stylesheet whose body paints `name`, e.g. `.hr`. */
function selectorsPainting(css: string, name: string): string[] {
  // Comments carry example declarations and would be read as selectors.
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g);
  const selectors: string[] = [];
  for (const [, selector, body] of rules) {
    if (selector !== undefined && body?.includes(`var(${name})`) === true) {
      selectors.push(selector.trim().replace(/\s+/g, ' '));
    }
  }
  return selectors;
}

/** Every class name the screens actually render — `className` is always a literal. */
const renderedClasses: ReadonlySet<string> = (() => {
  const src = new URL('../', import.meta.url);
  const names = new Set<string>();
  for (const entry of readdirSync(src, { encoding: 'utf8', recursive: true })) {
    if (!entry.endsWith('.tsx')) continue;
    for (const [, list] of readFileSync(new URL(entry, src), 'utf8').matchAll(
      /className="([^"]*)"/g,
    )) {
      for (const name of list?.split(/\s+/) ?? []) if (name !== '') names.add(name);
    }
  }
  return names;
})();

/** The hex a rule paints one property with, e.g. `.x`, `border` → `#605d5d`. */
function paint(selector: string, property: string): string {
  const pattern = new RegExp(`(?:^|[;{\\s])${property}\\s*:[^;]*var\\((--[\\w-]+)\\)`);
  const name = pattern.exec(rule(selector))?.[1];
  if (name === undefined) {
    throw new Error(`${selector} paints no token in ${property}`);
  }
  return token(name);
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
      // `.curriculum-kicker` styled the read-once Curriculum kicker deleted
      // on the copy pass (#113); the two remaining screen kickers stay.
      expect(rule('a')).toMatch(accentText);
      expect(rule('.btn-ghost')).toMatch(accentText);
      expect(rule('.tag-outline')).toMatch(accentText);
      expect(rule('.card-kicker')).toMatch(accentText);
      for (const kicker of ['.module-kicker', '.exercise-kicker']) {
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
  });

  describe('meaningful non-text elements (#93, #97)', () => {
    /**
     * SC 1.4.11 asks 3:1 of anything non-text that carries meaning — the icon
     * that says which state you are in, the ring that says where focus is.
     * Decorative rules and dividers are exempt, so `--color-divider` is not
     * here. Text roles are measured above at 4.5:1; this is the other floor.
     */
    const MARKERS: readonly [string, string][] = [
      // The Self-Check radio, unanswered — the dot IS the control, the input
      // behind it is 0×0 (#97).
      ['.radio .dot', 'border'],
      // …and answered: the accent field that says which option is picked.
      ['.radio input:checked + .dot', 'background'],
      // The 2px keyboard-focus ring (#71).
      [':focus-visible', 'outline'],
    ];

    it.each(MARKERS)('%s clears 3:1 on both grounds', (selector, property) => {
      const colour = paint(selector, property);
      for (const [, ground] of GROUNDS) {
        expect(contrast(over(colour, ground), ground)).toBeGreaterThanOrEqual(3);
      }
    });

    it('draws the unanswered Self-Check radio in the outline role, not the divider', () => {
      expect(rule('.radio .dot')).toMatch(
        /border:\s*1\.5px solid var\(--color-text-muted\)/,
      );
      // Ink at 40% composites to #9f9d9d on the ground — 2.41:1, the defect.
      const divider = over(token('--color-divider'), BG);
      expect(divider).toBe('#9f9d9d');
      expect(contrast(divider, BG)).toBe(2.41);
    });

    it('keeps the answered radio and its focus ring on the brand field', () => {
      // Both non-text at 3.76:1 — measured by MARKERS above, unchanged by #97.
      expect(rule('.radio input:checked + .dot')).toMatch(
        /border-color:\s*var\(--color-accent\);\s*background:\s*var\(--color-accent\)/,
      );
      expect(rule('.radio input:checked + .dot')).toMatch(
        /box-shadow:\s*inset 0 0 0 4px var\(--color-bg\)/,
      );
      expect(rule('.radio input:focus-visible + .dot')).toMatch(
        /outline:\s*2px solid var\(--color-accent\); outline-offset: 2px/,
      );
      expect(rule('.radio:hover .dot')).toMatch(/border-color:\s*var\(--color-accent\)/);
    });

    /**
     * The sweep, rather than one more line in the table above: `--color-divider`
     * is ink at 40% (2.41:1), which WCAG allows only for decoration. So every
     * selector painting it has to be a rule, a panel edge or a table line — a
     * control drawn in the divider role fails here without anyone remembering
     * to enumerate it. A blanket "every border clears 3:1" would be wrong; the
     * dividers are exempt and would fail it.
     */
    it('sweeps the divider role: rules, panel edges and table lines only', () => {
      const DECORATIVE = new Set([
        // design/styles.css — the system's rules and table lines.
        '.hr',
        '.nav',
        '.table th',
        '.table td',
        // The prototype controls no screen renders (asserted below).
        '.btn-secondary',
        '.input',
        '.seg',
        '.seg-opt + .seg-opt',
        // src/styles/app.css — 1px/2px rules and panel edges (tokens.json
        // layout.rules), plus the 2px grid gap between Model Example cells.
        '.app-notice',
        '.curriculum-row',
        '.curriculum-closing-rule',
        '.curriculum-backup-confirm',
        '.module-example-grid',
        '.self-check',
        '.self-check-item',
        '.exercise-spec-label',
        '.exercise-spec-value',
        '.exercise-interface-code',
      ]);
      const painted = [
        ...selectorsPainting(designCss, '--color-divider'),
        ...selectorsPainting(appCss, '--color-divider'),
      ];
      expect(painted.length).toBeGreaterThan(0);
      expect(painted.filter((selector) => !DECORATIVE.has(selector))).toEqual([]);
      // The dot left the list when #97 moved it to the outline role.
      expect(painted).not.toContain('.radio .dot');
    });

    it('renders none of the prototype controls the divider still outlines', () => {
      // .input / .seg / .seg-opt / .btn-secondary are control boundaries: at
      // 2.41:1 they would fail SC 1.4.11 the moment a screen used one. No
      // screen does — the Self-Check radio was the only one, and it is fixed.
      for (const control of ['input', 'seg', 'seg-opt', 'btn-secondary']) {
        expect(renderedClasses.has(control)).toBe(false);
      }
      // The control that IS rendered, so the sweep above is not vacuous.
      expect(renderedClasses.has('radio')).toBe(true);
      expect(renderedClasses.has('dot')).toBe(true);
    });

    it('keeps the ramp steps under 3:1 out of the app stylesheet entirely', () => {
      // 1.33 / 1.80 / 2.59 on the ground: these cannot paint anything that
      // means something, and app.css paints nothing that does not.
      for (const step of [
        '--color-neutral-300',
        '--color-neutral-400',
        '--color-neutral-500',
      ]) {
        expect(contrast(token(step), BG)).toBeLessThan(3);
        expect(appCss).not.toContain(`var(${step})`);
      }
    });
  });

  it('keeps tokens.json and styles.css saying the same thing', () => {
    expect(String(tokens.color.textMuted).startsWith(token('--color-text-muted'))).toBe(true);
    expect(String(tokens.color.accentText).startsWith(token('--color-accent-text'))).toBe(true);
    expect(String(tokens.color.accent).startsWith(token('--color-accent'))).toBe(true);
  });
});
