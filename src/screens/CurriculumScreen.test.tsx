import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CurriculumProvider } from '../app/CurriculumContext';
import type { Checkpoint, ContentSource, ModuleIndex } from '../curriculum';
import { createCurriculum } from '../curriculum';
import { CurriculumScreen } from './CurriculumScreen';

// The screen renders whatever ICurriculum returns, so the fixture is the real
// createCurriculum over an in-memory ContentSource — the same seam the app
// wires in main.tsx, minus HTTP. Mirrors the committed index: m01 non-pending.
// Deliberately not in ordinal order: row order must come from the data.
const index: ModuleIndex = {
  schemaVersion: 1,
  modules: [
    { id: 'm03', ordinal: 3, title: 'Testing at Boundaries + TDD loop', description: 'Test the Target Interface, not the internals.', pending: true },
    { id: 'm01', ordinal: 1, title: 'Deep Modules & Information Hiding', description: 'Hide the most complexity behind the smallest surface.', pending: false },
    { id: 'm05', ordinal: 5, title: 'Error Design', description: 'Define errors out of existence.', pending: true },
    { id: 'm02', ordinal: 2, title: 'Dependency Direction', description: 'Point dependencies at stable abstractions.', pending: true },
    { id: 'm04', ordinal: 4, title: 'Naming & Ubiquitous Language', description: 'Names drawn from the Ubiquitous Language.', pending: true },
  ],
};

const source: ContentSource = {
  loadIndex: async () => index,
  // The Curriculum screen never opens a content file.
  loadModuleContent: async () => null,
};

function renderScreen(checkpointList: readonly Checkpoint[] = []) {
  const curriculum = createCurriculum(source, {
    listCheckpoints: async () => checkpointList,
  });
  return render(
    <CurriculumProvider curriculum={curriculum}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<CurriculumScreen />} />
          {/* Probe for "navigates to the Module route" — #11 builds the real one. */}
          <Route path="/modules/:id" element={<p>module screen probe</p>} />
        </Routes>
      </MemoryRouter>
    </CurriculumProvider>,
  );
}

describe('Curriculum screen', () => {
  it('renders five rows in fixed ordinal order with a closing rule', async () => {
    const { container } = renderScreen();
    await screen.findByText('01');

    const rows = container.querySelectorAll('.curriculum-row');
    expect(rows).toHaveLength(5);
    const ordinals = [...rows].map(
      (row) => row.querySelector('.curriculum-row-ordinal')?.textContent,
    );
    expect(ordinals).toEqual(['01', '02', '03', '04', '05']);
    const titles = screen.getAllByRole('heading', { level: 3 });
    expect(titles.map((h) => h.textContent)).toEqual([
      'Deep Modules & Information Hiding',
      'Dependency Direction',
      'Testing at Boundaries + TDD loop',
      'Naming & Ubiquitous Language',
      'Error Design',
    ]);
    expect(container.querySelector('.curriculum-closing-rule')).toBeInTheDocument();
  });

  it('with no Checkpoints: Module 1 is Ready to start, Modules 2–5 are locked', async () => {
    const { container } = renderScreen();
    await screen.findByText('01');

    // Exactly one unlocked row, and it is a link to Module 1's route.
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/modules/m01');
    expect(screen.getAllByText('Ready to start')).toHaveLength(1);

    // Locked rows: inert divs, no status tag.
    const locked = container.querySelectorAll('.curriculum-row-locked');
    expect(locked).toHaveLength(4);
    for (const row of locked) {
      expect(row.tagName).toBe('DIV');
      expect(row).toHaveAttribute('aria-disabled', 'true');
      expect(row.querySelector('.tag')).toBeNull();
    }
  });

  it('clicking a locked row does nothing', async () => {
    renderScreen();
    await screen.findByText('01');

    fireEvent.click(screen.getByText('Dependency Direction'));

    expect(screen.queryByText('module screen probe')).not.toBeInTheDocument();
  });

  it('clicking an unlocked row navigates to the Module route', async () => {
    renderScreen();
    await screen.findByText('01');

    fireEvent.click(screen.getByRole('link', { name: /Deep Modules/ }));

    expect(screen.getByText('module screen probe')).toBeInTheDocument();
  });

  it('a Checkpoint shows Exit Gate passed with its date and unlocks the next Module', async () => {
    renderScreen([{ moduleId: 'm01', passedAt: '2026-06-12T09:41:00.000Z' }]);
    await screen.findByText('01');

    expect(screen.getByText('Exit Gate passed')).toBeInTheDocument();
    expect(screen.getByText('Checkpoint · 12 Jun 2026')).toBeInTheDocument();
    // The lock chain (derived by ICurriculum): Module 2 is now a link too.
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/modules/m01', '/modules/m02']);
    expect(screen.getAllByText('Ready to start')).toHaveLength(1);
  });

  it('uses no banned terms and no run counts (docs/ubiquitous-language.md § Banned, #3)', async () => {
    const { container } = renderScreen();
    await screen.findByText('01');

    const text = container.textContent ?? '';
    expect(text).not.toMatch(/lesson|course|level|quiz|flashcard|grade|score/i);
    expect(text).not.toMatch(/Green · |suites? green|\d+ \/ \d+ green/i);
  });
});
