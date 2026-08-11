// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  injectConfig,
  precacheUrls,
  readServiceWorkerTemplate,
} from './service-worker-plugin';

const BASE = '/Kata/';

describe('precacheUrls', () => {
  const built = [
    'index.html',
    'assets/index-abc123.js',
    'assets/index-def456.css',
    'assets/archivo-latin-ghi789.woff2',
    'favicon.svg',
    'icons/icon-192.png',
    'manifest.webmanifest',
  ];

  it('precaches every built file under the base path', () => {
    expect(precacheUrls(BASE, built)).toEqual([
      '/Kata/',
      '/Kata/assets/archivo-latin-ghi789.woff2',
      '/Kata/assets/index-abc123.js',
      '/Kata/assets/index-def456.css',
      '/Kata/favicon.svg',
      '/Kata/icons/icon-192.png',
      '/Kata/manifest.webmanifest',
    ]);
  });

  it('caches index.html once, as the base path every navigation resolves to', () => {
    const urls = precacheUrls(BASE, built);

    expect(urls).toContain('/Kata/');
    expect(urls).not.toContain('/Kata/index.html');
  });

  it('leaves the authored content JSON out — it is fetched network-first', () => {
    const urls = precacheUrls(BASE, [
      ...built,
      'content/index.json',
      'content/modules/m01.json',
    ]);

    expect(urls.filter((url) => url.includes('/content/'))).toEqual([]);
  });

  it('never precaches the worker itself', () => {
    expect(precacheUrls(BASE, ['sw.js'])).toEqual(['/Kata/']);
  });
});

describe('injectConfig', () => {
  const config = {
    version: 'abc123',
    base: BASE,
    contentPath: '/Kata/content/',
    precache: ['/Kata/'],
  };

  it('replaces the placeholder in the shipped worker', () => {
    const source = injectConfig(readServiceWorkerTemplate(), config);

    expect(source).not.toContain('__KATA_SW_CONFIG__');
    expect(source).toContain('"version": "abc123"');
    expect(source).toContain('"contentPath": "/Kata/content/"');
  });

  it('fails the build if the worker loses its placeholder', () => {
    expect(() => injectConfig('const CONFIG = {};', config)).toThrow(
      /__KATA_SW_CONFIG__/,
    );
  });
});
