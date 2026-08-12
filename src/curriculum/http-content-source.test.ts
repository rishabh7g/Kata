// Written before the implementation (Module 0 discipline). The ContentSource
// seam per docs/engineering.md: HTTP in the app, in-memory in tests — this is
// the HTTP side, fetching the committed JSON under the app's base path.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpContentSource } from './http-content-source';

const index = { schemaVersion: 1, modules: [] };

function stubFetch(responder: (url: string) => Response) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
    responder(String(input)),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createHttpContentSource', () => {
  it('loads the index from <base>content/index.json', async () => {
    const fetchMock = stubFetch(() => Response.json(index));

    const loaded = await createHttpContentSource('/Kata/').loadIndex();

    expect(fetchMock).toHaveBeenCalledWith('/Kata/content/index.json');
    expect(loaded).toEqual(index);
  });

  it('loads a Module content file from <base>content/modules/<id>.json', async () => {
    const content = { schemaVersion: 1, id: 'm01' };
    const fetchMock = stubFetch(() => Response.json(content));

    const loaded = await createHttpContentSource('/Kata/').loadModuleContent('m01');

    expect(fetchMock).toHaveBeenCalledWith('/Kata/content/modules/m01.json');
    expect(loaded).toEqual(content);
  });

  it('returns null for a 404 — the Module has no content file yet (pending)', async () => {
    stubFetch(() => new Response('not found', { status: 404 }));

    const loaded = await createHttpContentSource('/Kata/').loadModuleContent('m02');

    expect(loaded).toBeNull();
  });

  it('throws on a non-404 failure loading the index', async () => {
    stubFetch(() => new Response('boom', { status: 500 }));

    await expect(createHttpContentSource('/Kata/').loadIndex()).rejects.toThrow();
  });
});
