// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { injectConfig, readServiceWorkerTemplate } from './service-worker-plugin';

/**
 * Runs the shipped worker (`src/pwa/sw.js`, with a build config injected the way
 * the plugin does it) inside a fake worker scope, so its caching rules are
 * exercised as written rather than restated here.
 */

const ORIGIN = 'https://example.test';
const BASE = '/Kata/';
const SCOPE = `${ORIGIN}${BASE}`;
const VERSION = 'testversion';
const CACHE = `kata-${VERSION}`;
const SHELL = `${BASE}assets/index-abc123.js`;
const MISSING = `${BASE}assets/gone.css`;

/** What the deploy actually serves — MISSING is precached but absent. */
const SERVED: Record<string, string> = {
  [BASE]: '<!doctype html>shell',
  [SHELL]: 'app js',
};

type Listener = (event: unknown) => void;

class FakeCache {
  readonly entries = new Map<string, Response>();

  put(request: Request | string, response: Response): Promise<void> {
    this.entries.set(urlOf(request), response);
    return Promise.resolve();
  }

  match(request: Request | string): Promise<Response | undefined> {
    return Promise.resolve(this.entries.get(urlOf(request)));
  }
}

class FakeCacheStorage {
  readonly opened = new Map<string, FakeCache>();

  open(name: string): Promise<FakeCache> {
    const cache = this.opened.get(name) ?? new FakeCache();
    this.opened.set(name, cache);
    return Promise.resolve(cache);
  }

  keys(): Promise<string[]> {
    return Promise.resolve([...this.opened.keys()]);
  }

  delete(name: string): Promise<boolean> {
    return Promise.resolve(this.opened.delete(name));
  }
}

function urlOf(request: Request | string): string {
  return typeof request === 'string' ? request : request.url;
}

function ok(body: string): Response {
  return new Response(body, { status: 200 });
}

function serveFrom(files: Record<string, string>) {
  return (request: Request): Promise<Response> => {
    const body = files[new URL(request.url).pathname];
    return Promise.resolve(
      body === undefined ? new Response('not found', { status: 404 }) : ok(body),
    );
  };
}

/** Loads sw.js into a fake `self` and hands back the scope plus event drivers. */
function startWorker() {
  const listeners = new Map<string, Listener>();
  const scope = {
    caches: new FakeCacheStorage(),
    clients: { claim: vi.fn(() => Promise.resolve()) },
    fetch: vi.fn(serveFrom(SERVED)),
    location: { origin: ORIGIN, href: `${SCOPE}sw.js` },
    skipWaiting: vi.fn(() => Promise.resolve()),
    addEventListener: (type: string, listener: Listener) => {
      listeners.set(type, listener);
    },
  };

  const source = injectConfig(readServiceWorkerTemplate(), {
    version: VERSION,
    base: BASE,
    contentPath: `${BASE}content/`,
    precache: [BASE, SHELL, MISSING],
  });
  new Function('self', source)(scope);

  async function lifecycle(type: 'install' | 'activate'): Promise<void> {
    const pending: Promise<unknown>[] = [];
    listeners.get(type)?.({ waitUntil: (work: Promise<unknown>) => pending.push(work) });
    await Promise.all(pending);
  }

  async function request(
    url: string,
    init: { mode?: string; method?: string } = {},
  ): Promise<Response | undefined> {
    const responses: Promise<Response>[] = [];
    listeners.get('fetch')?.({
      request: { url, method: init.method ?? 'GET', mode: init.mode ?? 'no-cors' },
      respondWith: (response: Promise<Response>) => responses.push(response),
    });
    const [handled] = responses;
    return handled === undefined ? undefined : await handled;
  }

  return { scope, lifecycle, request };
}

async function installedWorker() {
  const worker = startWorker();
  await worker.lifecycle('install');
  await worker.lifecycle('activate');
  return worker;
}

describe('service worker install', () => {
  it('precaches the shell into a cache named for the build version', async () => {
    const { scope } = await installedWorker();

    const cached = [...(scope.caches.opened.get(CACHE)?.entries.keys() ?? [])];
    expect(cached.sort()).toEqual([`${ORIGIN}${BASE}`, `${ORIGIN}${SHELL}`]);
  });

  it('still installs when a precached URL is missing, unlike cache.addAll', async () => {
    const { scope } = await installedWorker();

    expect(scope.skipWaiting).toHaveBeenCalled();
    expect(
      scope.caches.opened.get(CACHE)?.entries.has(`${ORIGIN}${MISSING}`),
    ).toBe(false);
  });

  it('still installs when the network is down entirely', async () => {
    const worker = startWorker();
    worker.scope.fetch.mockRejectedValue(new Error('offline'));

    await expect(worker.lifecycle('install')).resolves.toBeUndefined();
    expect(worker.scope.skipWaiting).toHaveBeenCalled();
  });
});

describe('service worker activate', () => {
  it('deletes the previous version’s cache and keeps this one', async () => {
    const worker = startWorker();
    const stale = await worker.scope.caches.open('kata-oldversion');
    await stale.put(`${ORIGIN}${SHELL}`, ok('old js'));

    await worker.lifecycle('install');
    await worker.lifecycle('activate');

    expect([...worker.scope.caches.opened.keys()]).toEqual([CACHE]);
  });

  it('takes over the pages that are already open', async () => {
    const { scope } = await installedWorker();

    expect(scope.clients.claim).toHaveBeenCalled();
  });
});

describe('service worker fetch', () => {
  let worker: Awaited<ReturnType<typeof installedWorker>>;

  beforeEach(async () => {
    worker = await installedWorker();
  });

  it('answers a navigation with the cached document, offline included', async () => {
    worker.scope.fetch.mockRejectedValue(new Error('offline'));

    const response = await worker.request(`${SCOPE}#/modules/m01`, {
      mode: 'navigate',
    });

    await expect(response?.text()).resolves.toBe('<!doctype html>shell');
  });

  it('answers a precached asset from the cache without touching the network', async () => {
    worker.scope.fetch.mockClear();

    const response = await worker.request(`${ORIGIN}${SHELL}`);

    await expect(response?.text()).resolves.toBe('app js');
    expect(worker.scope.fetch).not.toHaveBeenCalled();
  });

  it('caches an asset it had to fetch, so the next load is offline-safe', async () => {
    const url = `${ORIGIN}${BASE}assets/late.css`;
    worker.scope.fetch.mockResolvedValue(ok('late css'));

    await worker.request(url);
    worker.scope.fetch.mockRejectedValue(new Error('offline'));

    await expect((await worker.request(url))?.text()).resolves.toBe('late css');
  });

  it('takes content JSON from the network first, then caches it for offline', async () => {
    const url = `${ORIGIN}${BASE}content/index.json`;
    worker.scope.fetch.mockResolvedValue(ok('{"fresh":true}'));

    const fresh = await worker.request(url);
    expect(worker.scope.fetch).toHaveBeenCalled();
    await expect(fresh?.text()).resolves.toBe('{"fresh":true}');

    worker.scope.fetch.mockRejectedValue(new Error('offline'));
    await expect((await worker.request(url))?.text()).resolves.toBe(
      '{"fresh":true}',
    );
  });

  it('leaves other origins, other paths and non-GET requests alone', async () => {
    await expect(
      worker.request('https://fonts.googleapis.com/css'),
    ).resolves.toBeUndefined();
    await expect(worker.request(`${ORIGIN}/other/app.js`)).resolves.toBeUndefined();
    await expect(
      worker.request(`${ORIGIN}${SHELL}`, { method: 'POST' }),
    ).resolves.toBeUndefined();
  });
});
