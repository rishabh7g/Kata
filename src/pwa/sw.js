/**
 * Kata's service worker.
 *
 * docs/engineering.md § 1 Stack: "Web app manifest + a service worker
 * precaching the app shell **and** the content JSON; cache-first, versioned so
 * a new deploy activates on the next online load."
 *
 * Hand-rolled rather than generated: the whole policy is three strategies and
 * fits in one readable file, and the app ships no dependency it does not need.
 * It is authored as a classic worker script — `src/pwa/service-worker-plugin.ts`
 * replaces the placeholder below at build time with the built shell's URLs and
 * a version derived from their bytes.
 *
 * Every global it uses hangs off `self`, so `src/pwa/sw.test.ts` can run this
 * exact file against a fake worker scope.
 */

const CONFIG = __KATA_SW_CONFIG__;

const CACHE_PREFIX = 'kata-';
const CACHE_NAME = `${CACHE_PREFIX}${CONFIG.version}`;

self.addEventListener('install', (event) => {
  // Set here and never awaited: skipWaiting() only resolves once this worker is
  // active, and it cannot become active until the install event settles — so
  // awaiting it inside install() deadlocks the update. Setting the flag is
  // enough; the browser activates this build the moment the precache is done.
  self.skipWaiting();
  event.waitUntil(install());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(activate());
});

self.addEventListener('fetch', (event) => {
  const handler = route(event.request);
  if (handler !== null) event.respondWith(handler);
});

/**
 * Fills this version's cache with the shell.
 *
 * Deliberately not `cache.addAll()`: that is atomic, so one asset that 404s
 * would fail the whole install and leave the app with no service worker at all.
 * Each asset is fetched on its own and a failure costs only that asset, which
 * the fetch handler then picks up at runtime.
 */
async function install() {
  const cache = await self.caches.open(CACHE_NAME);
  await Promise.all(
    CONFIG.precache.map(async (url) => {
      // `cache: 'reload'` so a stale HTTP-cached copy never becomes the
      // precached one.
      const request = new Request(appUrl(url), { cache: 'reload' });
      try {
        await fetchAndCache(cache, request);
      } catch {
        // Offline or missing: leave it out and let the fetch handler try later.
      }
    }),
  );
}

/** Drops every older Kata cache, then takes over the open pages. */
async function activate() {
  const names = await self.caches.keys();
  await Promise.all(
    names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => self.caches.delete(name)),
  );
  await self.clients.claim();
}

/**
 * Picks the strategy for a request, or `null` to let the browser handle it
 * untouched (anything that is not a same-origin GET inside the app's scope).
 */
function route(request) {
  if (request.method !== 'GET') return null;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return null;
  if (!url.pathname.startsWith(CONFIG.base)) return null;

  // Hash routing keeps every route under the base path, so the one precached
  // document answers every navigation — deep links and reloads included.
  if (request.mode === 'navigate') return cacheFirst(new Request(appUrl(CONFIG.base)));

  // Content JSON is authored separately and is not in the precache, so a
  // Module that has not been written yet can never break the install. Network
  // first keeps an online reader on the freshest content and seeds the cache
  // for the next offline visit.
  if (url.pathname.startsWith(CONFIG.contentPath)) return networkFirst(request);

  return cacheFirst(request);
}

/** Precached shell: the cache answers, and anything missing is added to it. */
async function cacheFirst(request) {
  const cache = await self.caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached !== undefined) return cached;

  try {
    return await fetchAndCache(cache, request);
  } catch {
    return Response.error();
  }
}

/** Content JSON: the network answers while it can, the cache when it cannot. */
async function networkFirst(request) {
  const cache = await self.caches.open(CACHE_NAME);

  try {
    return await fetchAndCache(cache, request);
  } catch {
    const cached = await cache.match(request);
    return cached ?? Response.error();
  }
}

/** Resolves one of CONFIG's paths against the scope this worker is serving. */
function appUrl(path) {
  return new URL(path, self.location.href).href;
}

async function fetchAndCache(cache, request) {
  const response = await self.fetch(request);
  // Only a plain 200 is worth keeping: errors, redirects and opaque responses
  // would poison the cache for the life of this version.
  if (response.ok && response.type !== 'opaque') {
    await cache.put(request, response.clone());
  }
  return response;
}
