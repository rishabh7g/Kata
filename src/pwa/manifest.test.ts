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
