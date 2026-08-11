import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Ships `src/pwa/sw.js` as `sw.js` next to the app, with the built shell's URLs
 * and a version baked in.
 *
 * The worker cannot know the hashed asset names (`assets/index-a1b2c3.js`) or
 * the base path on its own, so the build tells it: everything Vite emitted plus
 * everything in `public/` becomes the precache list, and a hash of those files'
 * bytes becomes the cache version — so any change to the shell means a new
 * cache, and an unchanged shell means the same one.
 */

const PLACEHOLDER = '__KATA_SW_CONFIG__';
const SERVICE_WORKER_FILE = 'sw.js';

/** Authored content lives under `public/content/` (docs/engineering.md § 3). */
const CONTENT_DIR = 'content';

export interface ServiceWorkerConfig {
  /** Cache-name suffix; changes whenever any precached file changes. */
  version: string;
  /** Vite's base path, e.g. `/Kata/`. */
  base: string;
  /** Path prefix of the runtime-cached content JSON, e.g. `/Kata/content/`. */
  contentPath: string;
  /** Absolute paths of the shell files cached at install time. */
  precache: string[];
}

/**
 * Turns built file names into the URLs the worker precaches.
 *
 * `index.html` becomes the base path itself, because that is the URL every
 * navigation resolves to under hash routing — caching it twice would only cost
 * bytes. Content JSON is left out on purpose: it is authored separately, it may
 * not exist yet, and the worker fetches it network-first instead.
 */
export function precacheUrls(base: string, files: readonly string[]): string[] {
  const urls = new Set<string>([base]);

  for (const file of files) {
    if (file === 'index.html' || file === SERVICE_WORKER_FILE) continue;
    if (file === CONTENT_DIR || file.startsWith(`${CONTENT_DIR}/`)) continue;
    urls.add(`${base}${file}`);
  }

  return [...urls].sort();
}

/** Replaces the worker's config placeholder with real values. */
export function injectConfig(
  template: string,
  config: ServiceWorkerConfig,
): string {
  if (!template.includes(PLACEHOLDER)) {
    throw new Error(`src/pwa/sw.js no longer contains ${PLACEHOLDER}`);
  }
  return template.replace(PLACEHOLDER, JSON.stringify(config, null, 2));
}

export function readServiceWorkerTemplate(): string {
  return readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
}

/** Every file under a directory, as paths relative to it, or none if absent. */
function listFiles(directory: string): string[] {
  if (directory === '') return [];
  try {
    return readdirSync(directory, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name).slice(directory.length + 1))
      .map((path) => path.split('\\').join('/'));
  } catch {
    return [];
  }
}

export function serviceWorkerPlugin(): Plugin {
  let base = '/';
  let publicDir = '';

  return {
    name: 'kata:service-worker',
    apply: 'build',

    configResolved(config) {
      base = config.base;
      publicDir = config.publicDir;
    },

    generateBundle(_options, bundle) {
      const emitted = Object.values(bundle).map((file) => ({
        name: file.fileName,
        bytes:
          file.type === 'chunk'
            ? Buffer.from(file.code)
            : Buffer.from(
                typeof file.source === 'string'
                  ? file.source
                  : new Uint8Array(file.source),
              ),
      }));
      const copied = listFiles(publicDir).map((name) => ({
        name,
        bytes: readFileSync(join(publicDir, name)),
      }));

      const precache = precacheUrls(
        base,
        [...emitted, ...copied].map((file) => file.name),
      );

      // The version covers exactly what gets cached — the document plus every
      // precached asset — so a shell change means a new cache and an unchanged
      // shell means the old one survives the deploy.
      const cached = new Set(precache);
      const version = createHash('sha256');
      for (const file of [...emitted, ...copied]
        .filter(
          (file) =>
            file.name === 'index.html' || cached.has(`${base}${file.name}`),
        )
        .sort((a, b) => a.name.localeCompare(b.name))) {
        version.update(file.name).update(file.bytes);
      }

      this.emitFile({
        type: 'asset',
        fileName: SERVICE_WORKER_FILE,
        source: injectConfig(readServiceWorkerTemplate(), {
          version: version.digest('hex').slice(0, 12),
          base,
          contentPath: `${base}${CONTENT_DIR}/`,
          precache,
        }),
      });
    },
  };
}
