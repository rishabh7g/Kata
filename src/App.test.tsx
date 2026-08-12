import { fireEvent, render, screen } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { CurriculumProvider } from './app/CurriculumContext';
import { ProgressProvider } from './app/ProgressContext';
import type { ICurriculum, ModuleSummary } from './curriculum';
import { createProgress } from './progress';

// A minimal ICurriculum: the shell only counts Checkpoints over Modules, and
// the index route only lists what getModules() returns. Two Checkpoints so
// the count is visibly counted, not the hard-coded 0 / 5.
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

  it('counts Checkpoints over Modules in the nav — never a percentage', async () => {
    await renderAt('/');

    expect(await screen.findByText('Checkpoints 2 / 5')).toBeInTheDocument();
  });

  it('re-reads the count on navigation: a new Checkpoint moves it (#18)', async () => {
    // ICurriculum derives from stored Checkpoints at read time, so the stub
    // is mutable: the state changes underneath, navigation re-reads it.
    let live: readonly ModuleSummary[] = summaries.map((s) => ({
      ...s,
      checkpointAt: null,
    }));
    await renderAt('/', {
      getModules: async () => live,
      getModule: async () => null,
    });
    expect(await screen.findByText('Checkpoints 0 / 5')).toBeInTheDocument();

    live = summaries; // two Checkpoints now recorded
    fireEvent.click(screen.getByRole('link', { name: 'Kata' }));

    expect(await screen.findByText('Checkpoints 2 / 5')).toBeInTheDocument();
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
