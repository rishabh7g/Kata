import { render, screen } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { CurriculumProvider } from './app/CurriculumContext';
import { ProgressProvider } from './app/ProgressContext';
import type { ICurriculum, ModuleSummary } from './curriculum';
import { createProgress } from './progress';

// A minimal ICurriculum: the shell renders no data of its own since the nav
// dropped its readout (#156), and the index route only lists what
// getModules() returns. The summaries still carry the old per-Module fields —
// the contract change is its own issue — precisely so the shell can be proved
// to ignore them.
const summaries: readonly ModuleSummary[] = [
  { id: 'm01', ordinal: 1, title: 'Deep Modules', description: 'Hide complexity.', pending: false, unlocked: true, checkpointAt: '2026-06-12T09:41:00.000Z' },
  { id: 'm02', ordinal: 2, title: 'Dependency Direction', description: 'Point at abstractions.', pending: true, unlocked: true, checkpointAt: '2026-07-01T09:41:00.000Z' },
  { id: 'm03', ordinal: 3, title: 'Testing at Boundaries', description: 'Test the Target Interface.', pending: true, unlocked: true, checkpointAt: null },
  { id: 'm04', ordinal: 4, title: 'Naming', description: 'Ubiquitous Language.', pending: true, unlocked: false, checkpointAt: null },
  { id: 'm05', ordinal: 5, title: 'Error Design', description: 'Define errors out of existence.', pending: true, unlocked: false, checkpointAt: null },
];

const curriculum: ICurriculum = {
  getModules: async () => summaries,
  getModule: async () => null,
};

beforeEach(() => {
  // A brand-new browser profile per test (#14's prescribed environment).
  globalThis.indexedDB = new IDBFactory();
});

async function renderAt(path: string, activeCurriculum: ICurriculum = curriculum) {
  const progress = await createProgress();
  return render(
    <CurriculumProvider curriculum={activeCurriculum}>
      <ProgressProvider progress={progress}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </ProgressProvider>
    </CurriculumProvider>,
  );
}

describe('app shell', () => {
  it('renders the Kata lockup, linking back to the Curriculum', async () => {
    await renderAt('/');

    expect(screen.getByRole('link', { name: 'Kata' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  // #156: the nav is a way back to the Curriculum, not a readout. It carries
  // the lockup and nothing else — no tally of the reader in permanent chrome.
  it('carries the lockup and nothing else in the nav', async () => {
    const { container } = await renderAt('/');
    await screen.findByText('01');

    const nav = container.querySelector('.app-nav');
    expect(nav?.textContent).toBe('Kata');
    expect(nav?.querySelectorAll('a')).toHaveLength(1);
  });

  // The stub's summaries still carry the old per-Module fields; the shell
  // renders nothing from them, on any route.
  it('renders no count even where the summaries still carry old fields', async () => {
    const { container } = await renderAt('/nowhere');

    expect(container.querySelector('.app-nav')?.textContent).toBe('Kata');
  });

  it('serves the Curriculum screen at the root route', async () => {
    await renderAt('/');

    expect(
      await screen.findByRole('heading', {
        name: 'Learn design by producing code.',
      }),
    ).toBeInTheDocument();
  });

  it('renders the shell for an unknown deep link instead of a dead end', async () => {
    await renderAt('/nowhere');

    expect(screen.getByRole('link', { name: 'Kata' })).toBeInTheDocument();
  });
});
