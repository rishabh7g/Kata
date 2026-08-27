import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { CurriculumProvider } from '../app/CurriculumContext';
import { ProgressProvider } from '../app/ProgressContext';
import type { ContentSource, ModuleIndex } from '../curriculum';
import { createCurriculum } from '../curriculum';
import type { ModuleSelfCheck } from '../progress';
import { createProgress } from '../progress';
import { expectWellFormedOutline } from '../test/headings';
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

// The full wiring from main.tsx (#18): ICurriculum over an in-memory
// ContentSource, side by side with the real IProgress over fake-indexeddb the
// screen reads Self-Check answers through — the two no longer touch (#158).
async function renderScreen({
  answers = [],
}: { answers?: readonly ModuleSelfCheck[] } = {}) {
  const progress = await createProgress();
  await progress.importState({ schemaVersion: 2, selfCheckAnswers: answers });
  const curriculum = createCurriculum(source);
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
    // Module titles are h2 — one level under the page h1 (#75).
    const titles = screen.getAllByRole('heading', { level: 2 });
    expect(titles.map((h) => h.textContent)).toEqual([
      'Deep Modules & Information Hiding',
      'Dependency Direction',
      'Testing at Boundaries + TDD loop',
      'Naming & Ubiquitous Language',
      'Error Design',
    ]);
    expect(container.querySelector('.curriculum-closing-rule')).toBeInTheDocument();
  });

  // The Library's first rule on this screen (#156): with an empty browser,
  // every Module is open to read from the very first visit.
  it('with empty storage: every row is a link to its own Module', async () => {
    const { container } = await renderScreen();
    await screen.findByText('01');

    const rows = [...container.querySelectorAll('.curriculum-row')];
    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.tagName)).toEqual(Array(5).fill('A'));
    expect(
      screen.getAllByRole('link').map((a) => a.getAttribute('href')),
    ).toEqual([
      '/modules/m01',
      '/modules/m02',
      '/modules/m03',
      '/modules/m04',
      '/modules/m05',
    ]);

    // No row is dimmed, disabled or held back by an icon that says so.
    for (const row of rows) {
      expect(row).not.toHaveAttribute('aria-disabled');
      expect(row.querySelectorAll('svg')).toHaveLength(1);
      expect(row.querySelector('.tag')).toHaveClass('tag-neutral');
    }
    expect(screen.getAllByText('Ready to start')).toHaveLength(5);
  });

  it('has one h1 and no skipped heading levels (#75)', async () => {
    const { container } = await renderScreen();
    await screen.findByText('01');

    // The page h1, then a Module title one level under it. The rows read at
    // 22px, which is h3's size in the design system — the level is the
    // outline's, not the type scale's.
    expect(expectWellFormedOutline(container)).toEqual([
      'h1 Learn design by producing code.',
      'h2 Deep Modules & Information Hiding',
      'h2 Dependency Direction',
      'h2 Testing at Boundaries + TDD loop',
      'h2 Naming & Ubiquitous Language',
      'h2 Error Design',
    ]);
  });

  // #134: the orientation block — three first-use definitions restored under
  // the keeper test's fourth clause (design/issue-guide.md § UI copy ban list).
  it('renders the orientation block between the title and the first Module row', async () => {
    const { container } = await renderScreen();
    await screen.findByText('01');

    const lines = [
      ...container.querySelectorAll('.curriculum-orientation-line'),
    ].map((line) => line.textContent);
    expect(lines).toEqual([
      'A Module is one concept: read it, then do its Exercises.',
      'You write and run the C# in your own IDE. Kata never runs or sees your code.',
      'Your progress is stored in this browser only.',
    ]);

    // In the header, after the h1 — so it reads before the rows and, at
    // <= 767px, stacks under the title through the header's own reflow.
    const block = container.querySelector('.curriculum-orientation');
    expect(block?.closest('.curriculum-header')).not.toBeNull();
    const firstRow = container.querySelector('.curriculum-row');
    expect(
      block?.compareDocumentPosition(container.querySelector('h1') as Node),
    ).toBe(Node.DOCUMENT_POSITION_PRECEDING);
    expect(block?.compareDocumentPosition(firstRow as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    // Static text only: no second way into a Module (the interaction-depth
    // question, design/issue-guide.md).
    expect(block?.querySelector('a, button, details, [role]')).toBeNull();
  });

  it('renders the orientation block before the Modules load, and unchanged after', async () => {
    // Empty progress, first paint: `modules` is still null, so no row exists
    // yet — the header block is already there and carries no counts.
    const { container } = await renderScreen();
    expect(container.querySelector('.curriculum-row')).toBeNull();
    const beforeLoad = container.querySelector(
      '.curriculum-orientation',
    )?.textContent;
    expect(beforeLoad).toContain('A Module is one concept');

    await screen.findByText('01');

    expect(container.querySelector('.curriculum-orientation')?.textContent).toBe(
      beforeLoad,
    );
    // No live data in it: no count, no date.
    expect(beforeLoad).not.toMatch(/\d/);
  });

  // The acceptance criterion of #156, now that the gated model's records are
  // a database of their own (#159): a browser still holding one renders
  // exactly what a fresh one does, and the database itself is gone after the
  // first load.
  it('renders identically for a browser holding the abandoned database', async () => {
    const empty = await renderScreen();
    await screen.findByText('01');
    const emptyHtml = empty.container.innerHTML;
    empty.unmount();
    globalThis.indexedDB = new IDBFactory();
    await seedAbandonedDatabase();

    const legacy = await renderScreen();
    await screen.findByText('01');

    expect(legacy.container.innerHTML).toBe(emptyHtml);
    // Nothing the old model recorded reaches the screen: no tag it wrote, no
    // date, no count of any kind.
    const text = legacy.container.textContent ?? '';
    expect(text).not.toMatch(/passed|Jun 2026/i);
    await waitFor(async () => {
      const names = (await indexedDB.databases()).map((d) => d.name);
      expect(names).toEqual(['kata-v2']);
    });
  });

  it('a fresh row carries the neutral tag and one arrow', async () => {
    const { container } = await renderScreen();
    await screen.findByText('01');

    const firstRow = container.querySelector('a.curriculum-row');
    const tag = firstRow?.querySelector('.tag');
    expect(tag).toHaveClass('tag', 'tag-neutral');
    expect(tag?.textContent).toBe('Ready to start');
    expect(firstRow?.querySelectorAll('svg')).toHaveLength(1);
  });

  it('clicking any row navigates to its Module route — including the last', async () => {
    await renderScreen();
    await screen.findByText('01');

    fireEvent.click(screen.getByRole('link', { name: /Error Design/ }));

    expect(screen.getByText('module screen probe')).toBeInTheDocument();
  });

  it('clicking the first row navigates to the Module route', async () => {
    await renderScreen();
    await screen.findByText('01');

    fireEvent.click(screen.getByRole('link', { name: /Deep Modules/ }));

    expect(screen.getByText('module screen probe')).toBeInTheDocument();
  });

  it('saved Self-Check answers show the outline In progress tag (#18)', async () => {
    await renderScreen({
      answers: [
        { moduleId: 'm02', answers: { q1: 'a' }, savedAt: '2026-06-13T10:00:00.000Z' },
      ],
    });

    const tag = await screen.findByText('In progress');
    expect(tag).toHaveClass('tag', 'tag-outline');
    // One row changed tag; the other four are untouched.
    expect(screen.getAllByText('Ready to start')).toHaveLength(4);
  });

  // Answers are read for every Module, whatever its position in the order
  // (#156) — a reader who answered Module 5's Self-Check first sees it said.
  it('shows the In progress tag on any Module, in any order', async () => {
    await renderScreen({
      answers: [
        { moduleId: 'm05', answers: { q1: 'a' }, savedAt: '2026-06-13T10:00:00.000Z' },
      ],
    });

    const tag = await screen.findByText('In progress');
    expect(tag.closest('.curriculum-row')).toHaveAttribute(
      'href',
      '/modules/m05',
    );
  });

  // #77: the Curriculum is the app itself, so the tab carries only its name.
  it('names the tab `Kata`', async () => {
    document.title = 'stale';
    await renderScreen();
    await screen.findByText('01');

    expect(document.title).toBe('Kata');
  });

  it('uses no banned terms and no run counts (docs/ubiquitous-language.md § Banned, #3)', async () => {
    const { container } = await renderScreen();
    await screen.findByText('01');

    const text = container.textContent ?? '';
    expect(text).not.toMatch(/lesson|course|level|quiz|flashcard|grade|score/i);
    expect(text).not.toMatch(/Green · |suites? green|\d+ \/ \d+ green/i);
  });

  // docs/ubiquitous-language.md § Removed terms — the words the Library
  // dropped when reading stopped being something to earn (#156).
  it('uses no removed term anywhere on the screen', async () => {
    const { container } = await renderScreen({
      answers: [
        { moduleId: 'm02', answers: { q1: 'a' }, savedAt: '2026-06-13T10:00:00.000Z' },
      ],
    });
    await screen.findByText('01');

    const text = container.textContent ?? '';
    expect(text).not.toMatch(
      /Exit Gate|Behavioral Checklist|Checkpoint|Verification Run|Verifier CLI|Workbench|unlock|locked|\bgate\b|submit/i,
    );
  });

  // design/issue-guide.md § UI copy ban list (#115) — the writing-style list,
  // separate from the domain vocabulary above. The orientation block (#134) is
  // the first prose this screen has carried since the copy pass, so the screen
  // asserts it here.
  it('uses no word from the UI copy ban list (#115)', async () => {
    const { container } = await renderScreen();
    await screen.findByText('01');

    const text = container.textContent ?? '';
    expect(text).not.toMatch(
      /streak|daily goal|days left|% complete|\bXP\b|\bjust\b|\bsimply\b|\beasy\b/i,
    );
  });
});

/**
 * A browser left over from the gated model: the `kata` database with one of
 * its stores in it. Opening IProgress deletes it (docs/engineering.md § 4).
 */
async function seedAbandonedDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('kata', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('checkpoints', { keyPath: 'moduleId' });
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}
