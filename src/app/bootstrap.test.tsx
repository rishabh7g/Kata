import { act, screen, within } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startKata } from './bootstrap';
import type { ModuleIndex } from '../curriculum';
import { expectWellFormedOutline } from '../test/headings';

// The committed index, trimmed to two Modules — enough for the nav count.
const index: ModuleIndex = {
  schemaVersion: 2,
  categories: [
    { id: 'software-design', ordinal: 1, title: 'Software Design', description: 'Design fundamentals in C#.', language: 'csharp' },
  ],
  modules: [
    { id: 'm01', categoryId: 'software-design', ordinal: 1, title: 'Deep Modules', description: 'Hide complexity.', pending: false },
    { id: 'm02', categoryId: 'software-design', ordinal: 2, title: 'Dependency Direction', description: 'Point at abstractions.', pending: false },
  ],
};

let container: HTMLElement;

beforeEach(() => {
  // A brand-new browser profile per test (#14's prescribed environment).
  globalThis.indexedDB = new IDBFactory();
  globalThis.fetch = vi.fn(
    async () => new Response(JSON.stringify(index), { status: 200 }),
  ) as typeof fetch;
  container = document.createElement('div');
  container.id = 'root';
  document.body.append(container);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  container.remove();
  vi.restoreAllMocks();
});

/** IndexedDB refusing to open, exactly as a blocked-site-data profile does. */
function blockIndexedDB(error: DOMException) {
  globalThis.indexedDB = {
    open: () => {
      const request = { onerror: null, onsuccess: null, onupgradeneeded: null, error } as unknown as IDBOpenDBRequest & {
        onerror: ((event: Event) => void) | null;
      };
      queueMicrotask(() => request.onerror?.(new Event('error')));
      return request;
    },
  } as unknown as IDBFactory;
}

describe('startKata', () => {
  it('renders the app when IndexedDB opens', async () => {
    await act(async () => {
      await startKata(container, '/Kata/');
    });

    expect(screen.getByRole('link', { name: 'Kata' })).toBeInTheDocument();
    // The Curriculum's first row — the nav carries no readout to assert on
    // since #156, so the proof the app rendered is the screen under it.
    expect(await screen.findByText('01')).toBeInTheDocument();
  });

  it('renders nothing before the progress database answers — no flash', async () => {
    await act(async () => {
      const started = startKata(container, '/Kata/');
      // The database is still opening: one render, and it has not happened.
      expect(container).toBeEmptyDOMElement();
      await started;
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('explains the blocked progress database instead of a blank page (#68)', async () => {
    blockIndexedDB(new DOMException('blocked', 'SecurityError'));

    await act(async () => {
      await startKata(container, '/Kata/');
    });

    const notice = screen.getByRole('alert');
    expect(
      within(notice).getByRole('heading', {
        name: 'Kata cannot open its progress database',
      }),
    ).toBeInTheDocument();
    // Names the cause and the one thing the learner can do about it.
    expect(notice).toHaveTextContent('Site data is blocked for localhost');
    expect(notice).toHaveTextContent('Allow site data for localhost');
    expect(notice).toHaveTextContent('SecurityError: blocked');
    // Inside #root, wearing the app stylesheet's classes.
    expect(container).toContainElement(notice);
    expect(notice).toHaveClass('app-notice');
    // Still the app: the lockup is there, and it is all the nav carries (#156).
    expect(screen.getByText('Kata')).toBeInTheDocument();
    expect(container.querySelector('.app-nav')?.textContent).toBe('Kata');
  });

  it('gives the blocked-database screen an outline to navigate (#94)', async () => {
    blockIndexedDB(new DOMException('blocked', 'SecurityError'));

    await act(async () => {
      await startKata(container, '/Kata/');
    });

    // The notice is the whole screen here — the shell renders the lockup and
    // nothing else — so its title is the h1. It was an h2 above nothing.
    expect(expectWellFormedOutline(container)).toEqual([
      'h1 Kata cannot open its progress database',
    ]);
    expect(container.querySelector('h1')).toHaveClass('app-notice-title');
  });

  it('still logs the failure for whoever is looking at the console', async () => {
    blockIndexedDB(new DOMException('blocked', 'SecurityError'));

    await act(async () => {
      await startKata(container, '/Kata/');
    });

    expect(console.error).toHaveBeenCalledWith(
      'Kata could not open its progress database',
      expect.any(DOMException),
    );
  });
});
