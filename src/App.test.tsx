import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { CurriculumProvider } from './app/CurriculumContext';
import type { ICurriculum, ModuleSummary } from './curriculum';

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

function renderAt(path: string) {
  return render(
    <CurriculumProvider curriculum={curriculum}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </CurriculumProvider>,
  );
}

describe('app shell', () => {
  it('renders the Kata lockup, linking back to the Curriculum', () => {
    renderAt('/');

    expect(screen.getByRole('link', { name: 'Kata' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('counts Checkpoints over Modules in the nav — never a percentage', async () => {
    renderAt('/');

    expect(await screen.findByText('Checkpoints 2 / 5')).toBeInTheDocument();
  });

  it('serves the Curriculum screen at the root route', async () => {
    renderAt('/');

    expect(
      await screen.findByRole('heading', {
        name: 'Learn design by producing code.',
      }),
    ).toBeInTheDocument();
  });

  it('renders the shell for an unknown deep link instead of a dead end', () => {
    renderAt('/nowhere');

    expect(screen.getByRole('link', { name: 'Kata' })).toBeInTheDocument();
  });
});
