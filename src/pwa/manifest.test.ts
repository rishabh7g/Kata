// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The installability contract: what Chrome needs to offer the install prompt,
 * and the design values the manifest is not allowed to drift from.
 */

const manifest: {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: { src: string; sizes: string; type: string; purpose: string }[];
} = JSON.parse(
  readFileSync(new URL('../../public/manifest.webmanifest', import.meta.url), 'utf8'),
);

const tokens: { color: { bg: string } } = JSON.parse(
  readFileSync(new URL('../../design/tokens.json', import.meta.url), 'utf8'),
);

const indexHtml = readFileSync(
  new URL('../../index.html', import.meta.url),
  'utf8',
);

function readIcon(src: string): Buffer {
  return readFileSync(new URL(`../../public/${src.slice(2)}`, import.meta.url));
}

describe('web app manifest', () => {
  it('names the app and opens it standalone', () => {
    expect(manifest.name).toBe('Kata');
    expect(manifest.short_name).toBe('Kata');
    expect(manifest.display).toBe('standalone');
  });

  it('keeps start_url and scope relative, so they follow the base path', () => {
    // Resolved against the manifest's own URL, these are /Kata/ on Pages and
    // stay correct anywhere else the app is served from.
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(
      manifest.icons.every((icon) => icon.src.startsWith('./')),
    ).toBe(true);
  });

  it('paints the browser chrome in the design ground colour', () => {
    expect(manifest.theme_color).toBe(tokens.color.bg);
    expect(manifest.background_color).toBe(tokens.color.bg);
    expect(indexHtml).toContain(`<meta name="theme-color" content="${tokens.color.bg}" />`);
  });

  it('is linked from the document through the base path', () => {
    expect(indexHtml).toContain(
      '<link rel="manifest" href="%BASE_URL%manifest.webmanifest" />',
    );
  });

  // House UI baseline standard: the static tag is exactly this string, no
  // zoom flags (maximum-scale / user-scalable), so the web stays fully
  // zoomable per WCAG 2.1 SC 1.4.4 / 1.4.10. viewport-fit=cover is required
  // for every env(safe-area-inset-*) in the app to resolve to anything but 0.
  it('pins the exact static viewport tag, with viewport-fit=cover', () => {
    expect(indexHtml).toContain(
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />',
    );
  });
});

describe('manifest icons', () => {
  it('declares the 192 and 512 icons an install needs, plus a maskable one', () => {
    const declared = manifest.icons.map(
      (icon) => `${icon.sizes} ${icon.purpose}`,
    );

    expect(declared).toEqual([
      '192x192 any',
      '512x512 any',
      '512x512 maskable',
    ]);
  });

  it.each([0, 1, 2])('ships icon %i at the size it declares', (index) => {
    const icon = manifest.icons[index];
    if (icon === undefined) throw new Error(`No icon ${index}`);
    const bytes = readIcon(icon.src);

    expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(icon.type).toBe('image/png');
    expect(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`).toBe(icon.sizes);
  });
});

// The two icons the house UI standard requires that sit outside the
// manifest's own `icons` array (#109): iOS reads apple-touch-icon-180.png
// straight off index.html's <link>, and favicon-32.png is the PNG fallback
// tab icon for browsers that will not take the SVG favicon.
describe('the two icons outside the manifest (#109)', () => {
  const read = (relative: string): Buffer =>
    readFileSync(new URL(`../../public/${relative}`, import.meta.url));

  it('ships apple-touch-icon-180.png at 180×180 and links it from index.html', () => {
    const bytes = read('icons/apple-touch-icon-180.png');

    expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`).toBe('180x180');
    expect(indexHtml).toContain(
      '<link rel="apple-touch-icon" href="%BASE_URL%icons/apple-touch-icon-180.png" />',
    );
    // Not the 192 aliased in as an apple-touch-icon — that forces iOS to
    // downscale a 192 to 180 and antialias the mark's integer-coordinate
    // squares, which the generator wrote to need none.
    expect(indexHtml).not.toContain('rel="apple-touch-icon" href="%BASE_URL%icons/icon-192.png"');
  });

  it('ships favicon-32.png at 32×32 and links it from index.html', () => {
    const bytes = read('icons/favicon-32.png');

    expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`).toBe('32x32');
    expect(indexHtml).toContain(
      '<link rel="icon" type="image/png" sizes="32x32" href="%BASE_URL%icons/favicon-32.png" />',
    );
  });

  it('neither new icon is declared in the manifest icons array', () => {
    const sources = manifest.icons.map((icon) => icon.src);
    expect(sources).not.toContain('./icons/apple-touch-icon-180.png');
    expect(sources).not.toContain('./icons/favicon-32.png');
  });
});
