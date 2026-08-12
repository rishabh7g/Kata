import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { CurriculumProvider } from '../app/CurriculumContext';
import { ProgressProvider } from '../app/ProgressContext';
import type {
  ContentSource,
  ExerciseBrief,
  ModuleContent,
  ModuleIndex,
} from '../curriculum';
import { createCurriculum } from '../curriculum';
import type { IProgress } from '../progress';
import { createProgress } from '../progress';
import { ExerciseScreen } from './ExerciseScreen';

// As in ModuleScreen.test.tsx: the fixture is the real createCurriculum over
// an in-memory ContentSource — the same seam main.tsx wires, minus HTTP. The
// checklist tests add the real createProgress over fake-indexeddb (#14's
// prescribed test environment): a fresh IDBFactory per test is the "clear
// site data" reset, and re-opening the same factory models a reload.
const index: ModuleIndex = {
  schemaVersion: 1,
  modules: [
    { id: 'm01', ordinal: 1, title: 'Deep Modules & Information Hiding', description: 'Hide the most complexity behind the smallest surface.', pending: false },
    { id: 'm02', ordinal: 2, title: 'Dependency Direction', description: 'Point dependencies at stable abstractions.', pending: true },
  ],
};

// The two Module 1 brief kinds (#8): one refactor with the null folderUrl
// placeholder, one construct carrying a real URL so both practice-material
// states are reachable (the real pack stays null until #23).
const refactorBrief: ExerciseBrief = {
  id: 'm01-e1',
  type: 'refactor',
  title: 'Deepen a shallow document store',
  concept: 'Deep Modules & Information Hiding',
  smell: 'Shallow module: every decision leaks into the caller.',
  targetInterfaceCode:
    'public interface IDocumentStore\n{\n    void Save(string documentName, string contents);\n}',
  sizeBudgetLoc: 250,
  folderUrl: null,
};

const constructBrief: ExerciseBrief = {
  id: 'm01-e2',
  type: 'construct',
  title: 'Build a recent-values cache behind a two-method surface',
  concept: 'Information hiding',
  smell: 'The stub tempts a shallow build: knobs the cache must own.',
  targetInterfaceCode: 'public interface IRecentValuesCache { }',
  sizeBudgetLoc: 200,
  folderUrl: 'https://github.com/rishabh7g/Kata/tree/main/exercises/m01/m01-e2',
};

const content: ModuleContent = {
  schemaVersion: 1,
  id: 'm01',
  conceptPageMarkdown: '# Deep Modules & Information Hiding\n\nProse.',
  modelExamples: [
    { before: 'b1', after: 'a1', caption: 'c1' },
    { before: 'b2', after: 'a2', caption: 'c2' },
  ],
  exercises: [refactorBrief, constructBrief],
  checklistQuestions: [
    { id: 'q1', prompt: 'p1', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
    { id: 'q2', prompt: 'p2', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
    { id: 'q3', prompt: 'p3', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
  ],
};

const source: ContentSource = {
  loadIndex: async () => index,
  loadModuleContent: async (id) => (id === 'm01' ? content : null),
};

beforeEach(() => {
  // A brand-new browser profile per test; within one test, a new
  // createProgress against this SAME factory models a reload.
  globalThis.indexedDB = new IDBFactory();
});

async function renderAt(path: string, progress?: IProgress) {
  const curriculum = createCurriculum(source, {
    listCheckpoints: async () => [],
  });
  const activeProgress = progress ?? (await createProgress());
  const utils = render(
    <CurriculumProvider curriculum={curriculum}>
      <ProgressProvider progress={activeProgress}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/" element={<p>curriculum probe</p>} />
            <Route path="/modules/:id" element={<p>module probe</p>} />
            <Route
              path="/modules/:id/exercises/:exerciseId"
              element={<ExerciseScreen />}
            />
          </Routes>
        </MemoryRouter>
      </ProgressProvider>
    </CurriculumProvider>,
  );
  return { ...utils, progress: activeProgress };
}

/** Clicks the given option of the nth checklist question (0-based). */
function pickAnswer(container: HTMLElement, question: number, value: string) {
  const item = container.querySelectorAll('.exercise-checklist-item')[question];
  const radio = item?.querySelector(`input[value="${value}"]`);
  expect(radio).toBeInTheDocument();
  fireEvent.click(radio as HTMLInputElement);
}

function submitButton() {
  return screen.getByRole('button', { name: 'Submit Behavioral Checklist' });
}

describe('Exercise screen', () => {
  it('renders the refactor brief: kicker, 40px title, Refactor-type tag, back button (#15)', async () => {
    await renderAt('/modules/m01/exercises/m01-e1');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Deepen a shallow document store' }),
    ).toBeInTheDocument();
    // The kicker uppercases via CSS; the source text carries both ids.
    expect(screen.getByText('Exercise m01-e1 · Module 01')).toHaveClass(
      'exercise-kicker',
    );
    expect(screen.getByText('Refactor-type')).toHaveClass('tag-outline');
    expect(screen.getByRole('link', { name: 'Module 01' })).toHaveClass(
      'btn-ghost',
    );
    // The captures' second header tag is historical (#3): no test count.
    expect(screen.queryByText(/test suite ·/i)).not.toBeInTheDocument();
  });

  it('renders the construct brief with its Construct-type tag', async () => {
    await renderAt('/modules/m01/exercises/m01-e2');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Build a recent-values cache behind a two-method surface' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Construct-type')).toHaveClass('tag-outline');
    expect(screen.getByText('Exercise m01-e2 · Module 01')).toBeInTheDocument();
  });

  it('shows the Spec grid with exactly Concept / Smell / Size budget rows — no Workbench (#3)', async () => {
    const { container } = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Exercise Spec');

    const grid = container.querySelector('.exercise-spec-grid');
    expect(grid).toBeInTheDocument();
    const labels = [...(grid?.querySelectorAll('.exercise-spec-label') ?? [])];
    expect(labels.map((label) => label.textContent)).toEqual([
      'Concept',
      'Smell',
      'Size budget',
    ]);
    const values = [...(grid?.querySelectorAll('.exercise-spec-value') ?? [])];
    expect(values.map((value) => value.textContent)).toEqual([
      'Deep Modules & Information Hiding',
      'Shallow module: every decision leaks into the caller.',
      '≤ 250 LOC',
    ]);
    // The budget value renders mono (design/README.md § Screens › 3).
    expect(values[2]).toHaveClass('exercise-spec-value-mono');
  });

  it('renders the Target Interface block: h6, Immutable accent tag, note, C# code', async () => {
    const { container } = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Target Interface');

    expect(screen.getByText('Immutable')).toHaveClass('tag-accent');
    expect(
      screen.getByText(/Tests are written against this and only this/),
    ).toBeInTheDocument();
    const code = container.querySelector('pre.exercise-interface-code');
    expect(code?.textContent).toContain('public interface IDocumentStore');
    expect(code?.textContent).toContain(
      'void Save(string documentName, string contents);',
    );
  });

  it('keeps the Target Interface display-only — the only inputs anywhere are the checklist radios (#3)', async () => {
    const { container } = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Target Interface');
    // The checklist form loads its stored state before rendering; wait for it.
    await screen.findByRole('button', { name: 'Submit Behavioral Checklist' });

    expect(container.querySelector('textarea')).not.toBeInTheDocument();
    expect(
      container.querySelector('[contenteditable]'),
    ).not.toBeInTheDocument();
    // The checklist's radio pairs are the app's whole write surface: every
    // input is one of them, and none sits inside the Target Interface block.
    const inputs = [...container.querySelectorAll('input')];
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs.every((input) => input.type === 'radio')).toBe(true);
    expect(
      container.querySelector('.exercise-interface-code input'),
    ).not.toBeInTheDocument();
  });

  it('renders the disabled note while folderUrl is the null placeholder (#23 pending)', async () => {
    const { container } = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Practice material');

    expect(
      screen.getByText(/folder is not committed yet/),
    ).toBeInTheDocument();
    // A note, never a dead link: the block renders no anchor at all.
    expect(
      container.querySelector('.exercise-folder-link'),
    ).not.toBeInTheDocument();
  });

  it('links a real folderUrl out to GitHub in a new tab', async () => {
    await renderAt('/modules/m01/exercises/m01-e2');
    await screen.findByText('Practice material');

    const link = screen.getByRole('link', {
      name: "Open this Exercise's folder on GitHub",
    });
    expect(link).toHaveAttribute('href', constructBrief.folderUrl);
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByText(/run/).textContent).toContain(
      'dotnet test in your own IDE',
    );
    expect(
      screen.queryByText(/folder is not committed yet/),
    ).not.toBeInTheDocument();
  });

  it('returns to the owning Module via the back button', async () => {
    await renderAt('/modules/m01/exercises/m01-e1');

    fireEvent.click(await screen.findByRole('link', { name: 'Module 01' }));

    expect(await screen.findByText('module probe')).toBeInTheDocument();
  });

  it('falls back to the owning Module for an unknown Exercise id', async () => {
    await renderAt('/modules/m01/exercises/nope');

    expect(await screen.findByText('module probe')).toBeInTheDocument();
  });

  it('falls back to the Curriculum for an unknown Module id', async () => {
    await renderAt('/modules/nope/exercises/m01-e1');

    expect(await screen.findByText('curriculum probe')).toBeInTheDocument();
  });

  it('deep-loads through the app routes identically', async () => {
    // Same entry the reloaded hash URL produces: App resolves the full path.
    const curriculum = createCurriculum(source, {
      listCheckpoints: async () => [],
    });
    const progress = await createProgress();
    render(
      <CurriculumProvider curriculum={curriculum}>
        <ProgressProvider progress={progress}>
          <MemoryRouter initialEntries={['/modules/m01/exercises/m01-e1']}>
            <App />
          </MemoryRouter>
        </ProgressProvider>
      </CurriculumProvider>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Deepen a shallow document store' }),
    ).toBeInTheDocument();
  });

  it('renders nothing verification-shaped: no terminal, runs, status, or Workbench (#3)', async () => {
    const { container } = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Exercise Spec');

    const text = container.textContent ?? '';
    expect(text).not.toMatch(/terminal|workbench|verif/i);
    expect(text).not.toMatch(/\bgreen\b|\bfailing\b|run history|\bruns\b/i);
    // Nothing calendar-shaped either (docs/design.md § Pedagogy).
    expect(text).not.toMatch(/timeline|streak|schedule|deadline/i);
  });

  it('uses no banned terms (docs/ubiquitous-language.md § Banned)', async () => {
    const { container } = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Exercise Spec');
    await screen.findByText('Behavioral Checklist');

    const text = container.textContent ?? '';
    expect(text).not.toMatch(/lesson|course|level|quiz|flashcard|grade|score/i);
  });
});

describe('Behavioral Checklist (#16)', () => {
  beforeEach(() => {
    // Fake only Date (fake-indexeddb needs real timers) so tests can pin
    // `now` and prove the submitted time survives a reload unchanged.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-12T09:41:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the three questions as radio pairs in the aside — no free-text field', async () => {
    const { container } = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Behavioral Checklist');

    const aside = container.querySelector('aside.exercise-aside');
    const items = [...(aside?.querySelectorAll('.exercise-checklist-item') ?? [])];
    expect(items.map((item) => item.querySelector('.exercise-checklist-prompt')?.textContent)).toEqual(['p1', 'p2', 'p3']);
    // Each check is exactly one radio pair (design/README.md § Screens › 3).
    for (const item of items) {
      expect(item.querySelectorAll('input[type="radio"]')).toHaveLength(2);
      expect(item.querySelectorAll('label.radio')).toHaveLength(2);
    }
    // No free-text field anywhere in the panel.
    expect(aside?.querySelector('textarea')).toBeNull();
    expect(aside?.querySelector('input[type="text"]')).toBeNull();
  });

  it('keeps submit disabled at 0, 1, and 2 answered pairs; enables it at 3', async () => {
    const { container } = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Behavioral Checklist');

    expect(submitButton()).toBeDisabled();
    pickAnswer(container, 0, 'a');
    expect(submitButton()).toBeDisabled();
    pickAnswer(container, 1, 'b');
    expect(submitButton()).toBeDisabled();
    pickAnswer(container, 2, 'a');
    expect(submitButton()).toBeEnabled();
  });

  it('flips to the read-only submitted state without a reload, showing exactly the chosen answers', async () => {
    const { container } = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Behavioral Checklist');

    pickAnswer(container, 0, 'a');
    pickAnswer(container, 1, 'b');
    pickAnswer(container, 2, 'a');
    fireEvent.click(submitButton());

    // Same render: the panel, not the form. 12 Aug 2026 09:41 UTC, local-formatted.
    expect(await screen.findByText(/Submitted ·/)).toBeInTheDocument();
    const panel = container.querySelector('.exercise-checklist-panel');
    expect(panel).toBeInTheDocument();
    const rows = [...(panel?.querySelectorAll('.exercise-checklist-row') ?? [])];
    expect(
      rows.map((row) => [
        row.querySelector('.exercise-checklist-row-question')?.textContent,
        row.querySelector('.exercise-checklist-row-answer')?.textContent,
      ]),
    ).toEqual([
      ['p1', 'A'],
      ['p2', 'B'],
      ['p3', 'A'],
    ]);
    // Read-only: the form is gone.
    expect(container.querySelector('input[type="radio"]')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Submit Behavioral Checklist' }),
    ).not.toBeInTheDocument();
  });

  it('still shows the submitted panel with the original time after a reload', async () => {
    const first = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Behavioral Checklist');
    pickAnswer(first.container, 0, 'a');
    pickAnswer(first.container, 1, 'a');
    pickAnswer(first.container, 2, 'a');
    fireEvent.click(submitButton());
    const line = await screen.findByText(/Submitted ·/);
    const originalLine = line.textContent;
    first.unmount();

    // The reload: a later clock, a fresh IProgress over the same database.
    vi.setSystemTime(new Date('2026-08-13T18:00:00.000Z'));
    const second = await renderAt('/modules/m01/exercises/m01-e1');

    const reloaded = await screen.findByText(/Submitted ·/);
    expect(reloaded.textContent).toBe(originalLine);
    expect(second.container.querySelector('input[type="radio"]')).toBeNull();
  });

  it('keeps a one-pair draft selected across a reload, with submit still disabled', async () => {
    const first = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Behavioral Checklist');
    pickAnswer(first.container, 1, 'b');
    // The autosave is fire-and-forget; wait for it to land before "reloading".
    await waitFor(async () => {
      expect(await first.progress.getChecklistDraft('m01')).not.toBeNull();
    });
    first.unmount();

    const second = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Behavioral Checklist');

    const items = second.container.querySelectorAll('.exercise-checklist-item');
    const restored = items[1]?.querySelector('input[value="b"]');
    expect(restored).toBeChecked();
    // The other pairs are untouched and the draft never enables submit.
    expect(items[0]?.querySelector('input:checked')).toBeNull();
    expect(items[2]?.querySelector('input:checked')).toBeNull();
    expect(submitButton()).toBeDisabled();
  });

  it('shows the gate banner in the same render when submission happens on this screen — no reload (#19)', async () => {
    const { container } = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Behavioral Checklist');
    // Negative case first: no banner before submission.
    expect(
      container.querySelector('.exercise-gate-banner'),
    ).not.toBeInTheDocument();

    pickAnswer(container, 0, 'a');
    pickAnswer(container, 1, 'a');
    pickAnswer(container, 2, 'b');
    fireEvent.click(submitButton());

    // Same render: the accent block joins the aside under the panel, with
    // the poster's next-Module line (#17's text rule).
    expect(
      await screen.findByText('Exit Gate passed — Checkpoint recorded.'),
    ).toBeInTheDocument();
    const banner = container.querySelector(
      '.exercise-aside .exercise-gate-banner',
    );
    expect(banner).toBeInTheDocument();
    expect(banner?.textContent).toContain(
      'Module 02 — Dependency Direction unlocked.',
    );
    // No banned terms in the banner (docs/ubiquitous-language.md § Banned).
    expect(banner?.textContent).not.toMatch(
      /lesson|course|level|quiz|flashcard|grade|score/i,
    );
  });

  it('moves the nav Checkpoint count in the same render as the submit — no navigation needed (#30)', async () => {
    // Full App (the always-mounted shell owns the count) over main.tsx's real
    // wiring: ICurriculum reads Checkpoints straight from IProgress.
    const progress = await createProgress();
    const curriculum = createCurriculum(source, {
      listCheckpoints: () => progress.listCheckpoints(),
    });
    const { container } = render(
      <CurriculumProvider curriculum={curriculum}>
        <ProgressProvider progress={progress}>
          <MemoryRouter initialEntries={['/modules/m01/exercises/m01-e1']}>
            <App />
          </MemoryRouter>
        </ProgressProvider>
      </CurriculumProvider>,
    );
    expect(await screen.findByText('Checkpoints 0 / 2')).toBeInTheDocument();
    await screen.findByText('Behavioral Checklist');

    pickAnswer(container, 0, 'a');
    pickAnswer(container, 1, 'a');
    pickAnswer(container, 2, 'a');
    fireEvent.click(submitButton());

    // screens/06-state.png: the count has already moved while still on the
    // Exercise screen — the submit bumps the location key so the shell
    // re-reads (#18's seam), no reload and no route change.
    expect(await screen.findByText('Checkpoints 1 / 2')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Deepen a shallow document store' }),
    ).toBeInTheDocument();
  });

  it("shows the banner on the Module's other Exercise screen after the pass — per Module, not per Exercise (#19)", async () => {
    const first = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Behavioral Checklist');
    pickAnswer(first.container, 0, 'a');
    pickAnswer(first.container, 1, 'a');
    pickAnswer(first.container, 2, 'a');
    fireEvent.click(submitButton());
    await screen.findByText('Exit Gate passed — Checkpoint recorded.');
    first.unmount();

    // The reload: a fresh IProgress over the same database, the other brief.
    const second = await renderAt('/modules/m01/exercises/m01-e2');

    expect(
      await screen.findByText('Exit Gate passed — Checkpoint recorded.'),
    ).toBeInTheDocument();
    expect(
      second.container.querySelector('.exercise-gate-banner')?.textContent,
    ).toContain('Module 02 — Dependency Direction unlocked.');
  });

  it('keeps the banner absent before submission even with a saved draft (#19)', async () => {
    const { container } = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Behavioral Checklist');

    pickAnswer(container, 0, 'a');
    pickAnswer(container, 1, 'a');

    expect(
      container.querySelector('.exercise-gate-banner'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Exit Gate passed — Checkpoint recorded.'),
    ).not.toBeInTheDocument();
  });

  it("shows the same submitted state on the Module's other Exercise screen — per Module, not per Exercise", async () => {
    const first = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Behavioral Checklist');
    pickAnswer(first.container, 0, 'a');
    pickAnswer(first.container, 1, 'a');
    pickAnswer(first.container, 2, 'b');
    fireEvent.click(submitButton());
    await screen.findByText(/Submitted ·/);
    first.unmount();

    const second = await renderAt('/modules/m01/exercises/m01-e2');

    expect(await screen.findByText(/Submitted ·/)).toBeInTheDocument();
    const rows = second.container.querySelectorAll('.exercise-checklist-row');
    expect(rows).toHaveLength(3);
    expect(second.container.querySelector('input[type="radio"]')).toBeNull();
  });
});
