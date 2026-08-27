// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Assert the font ramp in both directions (#114).
 *
 * A missing face never errors — the browser synthesises the weight or falls
 * through to the next family, and the first person to find out is the user.
 * Kata's own smoke check (scripts/smoke.sh) only proves the one committed
 * face is reachable and looks like a real woff2; it proves nothing about
 * whether the weights the app renders are the weights the bundle carries, or
 * whether the bundle carries anything the app never uses. This is that check,
 * derived from the stylesheets rather than hand-written, so a new weight or a
 * deleted face turns it red.
 *
 * Kata ships exactly one webfont (design/fonts/archivo-latin.woff2, a
 * variable Archivo covering weight 100–900). The other two named families in
 * the mono stack (`'Cascadia Code'`, Consolas) sit AFTER a generic
 * (`ui-monospace`) that is always present — the house standard's "optional
 * enhancement over a sound fallback, not a wish" — so they need nothing
 * bundled. Archivo, by contrast, is the FIRST family in both the heading and
 * body stacks, ahead of any generic — that is what makes it a requirement
 * rather than a wish.
 */

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

const designCss = read('../design/styles.css');
const appCss = read('./styles/app.css');

/* ------------------------------------------------------------ the stacks */

/** CSS generic family keywords — always present, need nothing bundled. */
const GENERIC_FAMILIES = new Set([
  'system-ui',
  'sans-serif',
  'serif',
  'monospace',
  'ui-monospace',
  'ui-serif',
  'cursive',
  'fantasy',
]);

/** `--font-heading: "Archivo", system-ui, sans-serif;` → `['Archivo', 'system-ui', 'sans-serif']`. */
function parseStack(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
    .filter((part) => part.length > 0);
}

/** Every `--font-*` custom property declared in a `:root` block, family name to family name. */
function fontStacks(css: string): Record<string, string[]> {
  const stacks: Record<string, string[]> = {};
  for (const root of css.matchAll(/:root\s*\{([\s\S]*?)\n\}/g)) {
    const body = root[1] ?? '';
    for (const decl of body.matchAll(/--font-([a-z-]+):\s*([^;]+);/g)) {
      const name = decl[1] ?? '';
      if (name.endsWith('weight')) continue;
      stacks[name] = parseStack(decl[2] ?? '');
    }
  }
  return stacks;
}

/**
 * The families a stack actually requires the app to bundle: everything named
 * before the first generic keyword. A generic anywhere earlier means every
 * later name — generic or not — is an enhancement, not a requirement (#114).
 */
function requiredFamilies(stack: string[]): string[] {
  const genericIndex = stack.findIndex((family) => GENERIC_FAMILIES.has(family));
  const before = genericIndex === -1 ? stack : stack.slice(0, genericIndex);
  return before.filter((family) => !GENERIC_FAMILIES.has(family));
}

/* ------------------------------------------------------------ the weights */

/** The numeric custom properties (`--font-heading-weight: 800;`) so `var(...)` resolves. */
function numericVars(css: string): Record<string, number> {
  const vars: Record<string, number> = {};
  for (const decl of css.matchAll(/--([a-z0-9-]+):\s*(\d+);/g)) {
    vars[decl[1] ?? ''] = Number(decl[2]);
  }
  return vars;
}

/** Strip `@font-face { ... }` blocks before scanning for per-element `font-weight`. */
function withoutFontFaces(css: string): string {
  return css.replace(/@font-face\s*\{[^}]*\}/g, '');
}

/**
 * Every weight the stylesheets ask an element to render at — literal numbers
 * (`font-weight: 600;`) and `var(--font-heading-weight)` resolved through the
 * `:root` declarations of BOTH sheets, since app.css's `:root` can see
 * design/styles.css's tokens once bundled.
 */
function renderedWeights(): number[] {
  const vars = { ...numericVars(designCss), ...numericVars(appCss) };
  const weights = new Set<number>();

  for (const css of [withoutFontFaces(designCss), withoutFontFaces(appCss)]) {
    for (const decl of css.matchAll(/font-weight:\s*([^;]+);/g)) {
      const value = (decl[1] ?? '').trim();
      if (/^\d+$/.test(value)) {
        weights.add(Number(value));
        continue;
      }
      const varName = value.match(/^var\(--([a-z0-9-]+)\)$/)?.[1];
      if (varName !== undefined && vars[varName] !== undefined) {
        weights.add(vars[varName]);
      }
    }
  }
  return [...weights].sort((a, b) => a - b);
}

/* ------------------------------------------------------------ the ramp */

/** Every (family, weight) pair the app's type tokens ask for. */
function requiredFaces(): { family: string; weight: number }[] {
  const stacks = fontStacks(designCss);
  Object.assign(stacks, fontStacks(appCss));
  const weights = renderedWeights();

  const families = new Set<string>();
  for (const stack of Object.values(stacks)) {
    for (const family of requiredFamilies(stack)) families.add(family);
  }

  const faces: { family: string; weight: number }[] = [];
  for (const family of families) {
    for (const weight of weights) faces.push({ family, weight });
  }
  return faces;
}

/* ------------------------------------------------------------ the bundle */

interface BundledFace {
  family: string;
  min: number;
  max: number;
  display: string | undefined;
  src: string | undefined;
}

/** Every `@font-face` a stylesheet declares, weight expressed as a [min, max] range. */
function bundledFaces(css: string): BundledFace[] {
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((block) => {
    const body = block[1] ?? '';
    const family = body.match(/font-family:\s*['"]([^'"]+)['"]/)?.[1] ?? '';
    const weightDecl = body.match(/font-weight:\s*([^;]+);/)?.[1]?.trim() ?? '';
    const [minText, maxText] = weightDecl.split(/\s+/);
    const min = Number(minText ?? Number.NaN);
    const max = maxText === undefined ? min : Number(maxText);
    return {
      family,
      min,
      max,
      display: body.match(/font-display:\s*([a-z-]+);/)?.[1],
      src: body.match(/src:\s*([^;]+);/)?.[1],
    };
  });
}

const bundle = bundledFaces(designCss);

function covers(face: BundledFace, family: string, weight: number): boolean {
  return face.family === family && weight >= face.min && weight <= face.max;
}

/* ------------------------------------------------------------ third-party origins */

/** Known third-party font hosts an offline PWA may never depend on. */
const FONT_HOSTS = /fonts\.(googleapis|gstatic|bunny)\.com|use\.typekit\.net|cdnfonts\.com/;

/**
 * Every source file the shipped app can carry a string into: src/**, minus
 * this repo's own tests. sw.test.ts uses a googleapis.com URL only as a test
 * fixture for the service worker's cross-origin cache rejection — never
 * fetched, never shipped — so *.test.ts(x) is out of scope for this scan, the
 * same way scripts/ and design/DevGym.dc.html (the historical HTML
 * prototype, a design reference never bundled) are.
 */
function shippedSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...shippedSourceFiles(full));
    } else if (/\.(ts|tsx|css)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('the font ramp, both directions (#114)', () => {
  it('parses the app-body and heading stacks down to Archivo, and the mono stack down to nothing', () => {
    const stacks = { ...fontStacks(designCss), ...fontStacks(appCss) };

    expect(stacks['heading']).toEqual(['Archivo', 'system-ui', 'sans-serif']);
    expect(stacks['body']).toEqual(['Archivo', 'system-ui', 'sans-serif']);
    expect(stacks['mono']).toEqual(['ui-monospace', 'Cascadia Code', 'Consolas', 'monospace']);

    expect(requiredFamilies(stacks['heading'] ?? [])).toEqual(['Archivo']);
    expect(requiredFamilies(stacks['body'] ?? [])).toEqual(['Archivo']);
    // ui-monospace is a generic, and it comes first — nothing after it is required.
    expect(requiredFamilies(stacks['mono'] ?? [])).toEqual([]);
  });

  it('resolves the weights the app actually renders: 400 and 800', () => {
    // 600 left with the gated model (#157): its removed panels' answer rows
    // and condition title were the only two rules that asked for it. The bundled face is the 100–900 variable one,
    // so a dropped weight is one less synthesis, not one less file.
    expect(renderedWeights()).toEqual([400, 800]);
  });

  it('covers every (family, weight) the tokens name with a committed @font-face', () => {
    const missing = requiredFaces().filter(
      ({ family, weight }) => !bundle.some((face) => covers(face, family, weight)),
    );

    expect(
      missing,
      `${missing.map((f) => `${f.family} ${f.weight}`).join(', ')} — the app renders these and the bundle lacks them. A missing weight is not an error: the browser synthesises it and nobody is told.`,
    ).toEqual([]);
  });

  it('bundles no face that nothing renders — no dead payload', () => {
    const required = requiredFaces();
    const surplus = bundle.filter(
      (face) => !required.some((f) => covers(face, f.family, f.weight)),
    );

    expect(
      surplus.map((f) => f.family),
      'a bundled face nothing renders is dead payload shipped to every device',
    ).toEqual([]);
  });

  it('declares font-display: swap on every @font-face — text is readable before the face arrives', () => {
    expect(bundle.length).toBeGreaterThan(0);
    for (const face of bundle) {
      expect(face.display, `${face.family} has no font-display: swap`).toBe('swap');
    }
  });

  it('self-hosts the one webfont — no @font-face src points off-repo', () => {
    for (const face of bundle) {
      expect(face.src, `${face.family} has no src`).toBeDefined();
      expect(face.src).not.toMatch(/^https?:\/\//);
      expect(face.src).toContain('.woff2');
    }
  });

  it('fails today if archivo-latin.woff2 is deleted', () => {
    // A source test, not a filesystem probe: the @font-face src is what the
    // browser actually resolves, and it must name the committed file.
    const archivo = bundle.find((face) => face.family === 'Archivo');
    expect(archivo?.src).toContain('archivo-latin.woff2');

    const woff2 = new URL('../design/fonts/archivo-latin.woff2', import.meta.url);
    expect(() => statSync(woff2)).not.toThrow();
  });

  it('would fail if a new weight the bundle does not cover were rendered', () => {
    // A weight outside the committed 100–900 variable range, e.g. Archivo at
    // 950, must not be silently "covered" by this test's own logic.
    const archivo = bundle.find((face) => face.family === 'Archivo');
    expect(archivo).toBeDefined();
    expect(covers(archivo!, 'Archivo', 950)).toBe(false);
  });

  it('names no third-party font origin anywhere the app ships', () => {
    const repoRoot = new URL('..', import.meta.url).pathname;
    const files = [
      ...shippedSourceFiles(join(repoRoot, 'src')),
      join(repoRoot, 'index.html'),
      join(repoRoot, 'design/styles.css'),
    ];

    const offenders = files.filter((file) => FONT_HOSTS.test(readFileSync(file, 'utf8')));

    expect(
      offenders,
      `${offenders.join(', ')} names a third-party font origin — an offline PWA cannot depend on one.`,
    ).toEqual([]);
  });

  it('scopes the third-party scan past the service-worker test fixture, on purpose', () => {
    // src/pwa/sw.test.ts asserts the worker REJECTS a cross-origin fonts.googleapis.com
    // request from its own cache — the URL is a fixture proving the rejection, not
    // something the app fetches. It is deliberately outside shippedSourceFiles()
    // above (which excludes every *.test.ts(x)), and this pins that down: if the
    // fixture is ever moved into shipped code, this test explains why the scan would
    // start failing rather than leaving that a silent surprise.
    const fixture = read('./pwa/sw.test.ts');
    expect(fixture).toMatch(FONT_HOSTS);
  });
});
