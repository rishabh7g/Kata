import { fireEvent, render, screen } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { CurriculumProvider } from '../app/CurriculumContext';
import { ProgressProvider } from '../app/ProgressContext';
import type { ContentSource, ModuleIndex } from '../curriculum';
import { createCurriculum } from '../curriculum';
import type { Checkpoint, ChecklistDraft } from '../progress';
import { createProgress } from '../progress';
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

beforeEach(() => {
  // A brand-new browser profile per test (#14's prescribed environment).
  globalThis.indexedDB = new IDBFactory();
});

// The full wiring from main.tsx (#18): the real IProgress over fake-indexeddb
// is both ICurriculum's CheckpointReader and the ProgressProvider value the
// screen reads drafts through.
async function renderScreen({
  checkpoints = [],
  drafts = [],
}: {
  checkpoints?: readonly Checkpoint[];
  drafts?: readonly ChecklistDraft[];
} = {}) {
  const progress = await createProgress();
  await progress.importState({
    schemaVersion: 1,
    checkpoints,
    submittedChecklists: [],
    checklistDrafts: drafts,
  });
  const curriculum = createCurriculum(source, progress);
  return render(
    <CurriculumProvider curriculum={curriculum}>
      <ProgressProvider progress={progress}>
        <MemoryRouter>
          <Routes>
            <Route path="/" element={<CurriculumScreen />} />
            {/* Probe for "navigates to the Module route" — #11 builds the real one. */}
            <Route path="/modules/:id" element={<p>module screen probe</p>} />
          </Routes>
        </MemoryRouter>
      </ProgressProvider>
    </CurriculumProvider>,
  );
}

describe('Curriculum screen', () => {
  it('renders five rows in fixed ordinal order with a closing rule', async () => {
    const { container } = await renderScreen();
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
    const { container } = await renderScreen();
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
    await renderScreen();
    await screen.findByText('01');

    fireEvent.click(screen.getByText('Dependency Direction'));

    expect(screen.queryByText('module screen probe')).not.toBeInTheDocument();
  });

  it('clicking an unlocked row navigates to the Module route', async () => {
    await renderScreen();
    await screen.findByText('01');

    fireEvent.click(screen.getByRole('link', { name: /Deep Modules/ }));

    expect(screen.getByText('module screen probe')).toBeInTheDocument();
  });

  it('a Checkpoint shows Exit Gate passed with its date and unlocks the next Module', async () => {
    await renderScreen({
      checkpoints: [{ moduleId: 'm01', passedAt: '2026-06-12T09:41:00.000Z' }],
    });
    await screen.findByText('01');

    expect(screen.getByText('Exit Gate passed')).toBeInTheDocument();
    expect(screen.getByText('Checkpoint · 12 Jun 2026')).toBeInTheDocument();
    // The lock chain (derived by ICurriculum): Module 2 is now a link too.
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/modules/m01', '/modules/m02']);
    expect(screen.getAllByText('Ready to start')).toHaveLength(1);
  });

  it('a saved checklist draft shows the outline In progress tag (#18)', async () => {
    await renderScreen({
      checkpoints: [{ moduleId: 'm01', passedAt: '2026-06-12T09:41:00.000Z' }],
      drafts: [
        { moduleId: 'm02', answers: { q1: 'a' }, savedAt: '2026-06-13T10:00:00.000Z' },
      ],
    });

    const tag = await screen.findByText('In progress');
    expect(tag).toHaveClass('tag', 'tag-outline');
    // The draft replaces `Ready to start` on row 02; row 01 stays passed.
    expect(screen.queryByText('Ready to start')).not.toBeInTheDocument();
    expect(screen.getByText('Exit Gate passed')).toBeInTheDocument();
  });

  it('a draft on a locked Module shows no tag — locked rows stay bare', async () => {
    const { container } = await renderScreen({
      drafts: [
        { moduleId: 'm03', answers: { q1: 'a' }, savedAt: '2026-06-13T10:00:00.000Z' },
      ],
    });
    await screen.findByText('Ready to start');

    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
    for (const row of container.querySelectorAll('.curriculum-row-locked')) {
      expect(row.querySelector('.tag')).toBeNull();
    }
  });

  it('uses no banned terms and no run counts (docs/ubiquitous-language.md § Banned, #3)', async () => {
    const { container } = await renderScreen();
    await screen.findByText('01');

    const text = container.textContent ?? '';
    expect(text).not.toMatch(/lesson|course|level|quiz|flashcard|grade|score/i);
    expect(text).not.toMatch(/Green · |suites? green|\d+ \/ \d+ green/i);
  });
});
