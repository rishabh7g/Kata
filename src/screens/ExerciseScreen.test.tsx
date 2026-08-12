import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import {
  MemoryRouter,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom';
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
import { expectWellFormedOutline } from '../test/headings';
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
    { id: 'm02', ordinal: 2, title: 'Dependency Direction', description: 'Point dependencies at stable abstractions.', pending: false },
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

// Module 2 is authored too, so a brief in a *different* Module is reachable —
// the cross-Module navigation #67 broke needs two Modules with real content.
const m02Brief: ExerciseBrief = {
  id: 'm02-e1',
  type: 'refactor',
  title: 'Point a policy at an abstraction',
  concept: 'Dependency Direction',
  smell: 'Policy reaches down into a concrete detail.',
  targetInterfaceCode: 'public interface IClock { }',
  sizeBudgetLoc: 180,
  folderUrl: null,
};

const m02Content: ModuleContent = {
  schemaVersion: 1,
  id: 'm02',
  conceptPageMarkdown: '# Dependency Direction\n\nProse.',
  modelExamples: [{ before: 'b1', after: 'a1', caption: 'c1' }],
  exercises: [m02Brief],
  checklistQuestions: [
    { id: 'q1', prompt: 'm02 p1', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
    { id: 'q2', prompt: 'm02 p2', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
    { id: 'q3', prompt: 'm02 p3', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
  ],
};

const contentById: Record<string, ModuleContent> = {
  m01: content,
  m02: m02Content,
};

const source: ContentSource = {
  loadIndex: async () => index,
  loadModuleContent: async (id) => contentById[id] ?? null,
};

beforeEach(() => {
  // A brand-new browser profile per test; within one test, a new
  // createProgress against this SAME factory models a reload.
  globalThis.indexedDB = new IDBFactory();
});

/**
 * A control that lives OUTSIDE `Routes`, so clicking it changes only the route
 * params — the Exercise element stays mounted, exactly what a same-document
 * hash change does in the browser (#67). `initialEntries` on a fresh render
 * would remount instead and hide the bug.
 */
function JumpTo({ to }: { to: string }) {
  const navigate = useNavigate();
  return <button onClick={() => navigate(to)}>jump</button>;
}

/** The Module route's stand-in — names the Module it landed on, so a fallback
 * test can tell "back to the owning Module" from "back to the previous one". */
function ModuleProbe() {
  const { id } = useParams();
  return (
    <>
      <p>module probe</p>
      <p>probe id {id}</p>
    </>
  );
}

async function renderAt(
  path: string,
  progress?: IProgress,
  jumpTo?: string,
  contentSource: ContentSource = source,
) {
  const curriculum = createCurriculum(contentSource, {
    listCheckpoints: async () => [],
  });
  const activeProgress = progress ?? (await createProgress());
  const utils = render(
    <CurriculumProvider curriculum={curriculum}>
      <ProgressProvider progress={activeProgress}>
        <MemoryRouter initialEntries={[path]}>
          {jumpTo !== undefined && <JumpTo to={jumpTo} />}
          <Routes>
            <Route path="/" element={<p>curriculum probe</p>} />
            <Route path="/modules/:id" element={<ModuleProbe />} />
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
  it('has one h1 and no skipped heading levels (#75)', async () => {
    const { container } = await renderAt('/modules/m01/exercises/m01-e1');
    // The checklist panel renders nothing until its saved state loads, so the
    // outline is only complete once its label is on the page.
    await screen.findByText('Behavioral Checklist');

    // Four section labels at h2 — including the Behavioral Checklist's, which
    // lives in the aside and is the same kind of section.
    expect(expectWellFormedOutline(container)).toEqual([
      'h1 Deepen a shallow document store',
      'h2 Exercise Spec',
      'h2 Target Interface',
      'h2 Practice material',
      'h2 Behavioral Checklist',
    ]);
  });

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

  it("lands on another Module's Exercise when only the params change — no redirect to the previous Module (#67)", async () => {
    await renderAt(
      '/modules/m01/exercises/m01-e1',
      undefined,
      '/modules/m02/exercises/m02-e1',
    );
    await screen.findByRole('heading', {
      level: 1,
      name: 'Deepen a shallow document store',
    });

    fireEvent.click(screen.getByRole('button', { name: 'jump' }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Point a policy at an abstraction',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Exercise m02-e1 · Module 02')).toBeInTheDocument();
    // The stale-render window redirected to /modules/m01 instead (#67).
    expect(screen.queryByText('module probe')).not.toBeInTheDocument();
  });

  it("shows no other Module's brief while the new detail loads (#67)", async () => {
    await renderAt(
      '/modules/m01/exercises/m01-e1',
      undefined,
      '/modules/m02/exercises/m02-e1',
    );
    await screen.findByRole('heading', {
      level: 1,
      name: 'Deepen a shallow document store',
    });

    fireEvent.click(screen.getByRole('button', { name: 'jump' }));

    // The first render after the params change holds nothing at all: the
    // previous Module's brief must not sit under the new Module's kicker.
    expect(
      screen.queryByRole('heading', {
        level: 1,
        name: 'Deepen a shallow document store',
      }),
    ).not.toBeInTheDocument();
    await screen.findByRole('heading', {
      level: 1,
      name: 'Point a policy at an abstraction',
    });
  });

  it('still moves between two Exercises of the same Module on a params change', async () => {
    await renderAt(
      '/modules/m01/exercises/m01-e1',
      undefined,
      '/modules/m01/exercises/m01-e2',
    );
    await screen.findByRole('heading', {
      level: 1,
      name: 'Deepen a shallow document store',
    });

    fireEvent.click(screen.getByRole('button', { name: 'jump' }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Build a recent-values cache behind a two-method surface',
      }),
    ).toBeInTheDocument();
  });

  it('still falls back to the owning Module when a params change names an unknown brief', async () => {
    await renderAt(
      '/modules/m01/exercises/m01-e1',
      undefined,
      '/modules/m02/exercises/zz',
    );
    await screen.findByRole('heading', {
      level: 1,
      name: 'Deepen a shallow document store',
    });

    fireEvent.click(screen.getByRole('button', { name: 'jump' }));

    // The requested Module, not the one that was on screen.
    expect(await screen.findByText('probe id m02')).toBeInTheDocument();
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

describe('Submitting the checklist: focus and announcement (#73)', () => {
  /** Answers all three checks and presses the submit button. */
  async function submit(container: HTMLElement) {
    await screen.findByText('Behavioral Checklist');
    pickAnswer(container, 0, 'a');
    pickAnswer(container, 1, 'a');
    pickAnswer(container, 2, 'a');
    fireEvent.click(submitButton());
    await screen.findByText(/Submitted ·/);
  }

  it('moves focus into the submitted panel — the button that had it is gone', async () => {
    const { container } = await renderAt('/modules/m01/exercises/m01-e1');
    await submit(container);

    const panel = container.querySelector('.exercise-checklist-panel');
    await waitFor(() => {
      expect(document.activeElement).toBe(panel);
    });
    // Not <body>: the next Tab carries on from the panel rather than
    // restarting at the nav at the top of the page.
    expect(document.activeElement).not.toBe(document.body);
    // Focusable programmatically, never a Tab stop of its own.
    expect(panel).toHaveAttribute('tabindex', '-1');
    // …and it says what it is when focus arrives.
    expect(panel).toHaveAccessibleName(/^Submitted · /);
  });

  it('announces the gate banner’s two lines once, politely', async () => {
    const { container } = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Behavioral Checklist');

    // The region is mounted and empty before the submit: a region that
    // appears carrying its text is announced unreliably, or twice.
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region.textContent).toBe('');

    await submit(container);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'Exit Gate passed — Checkpoint recorded. Module 02 — Dependency Direction unlocked.',
      );
    });
    // Exactly what the banner says, and only one region saying it. The banner
    // waits for refresh() to re-read the gate, so it lands a tick after the
    // announcement the waitFor above caught — wait for it too (#87).
    await waitFor(() => {
      expect(container.querySelector('.exercise-gate-banner')).not.toBeNull();
    });
    const banner = container.querySelector('.exercise-gate-banner');
    expect(banner?.textContent).toBe(
      'Exit Gate passed — Checkpoint recorded.Module 02 — Dependency Direction unlocked.',
    );
    expect(screen.getAllByRole('status')).toHaveLength(1);
    // Announced, not shown: the visible layout is unchanged.
    expect(screen.getByRole('status')).toHaveClass('visually-hidden');
  });

  it('announces the closing line when no Module follows', async () => {
    const { container } = await renderAt('/modules/m02/exercises/m02-e1');
    await submit(container);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'Exit Gate passed — Checkpoint recorded. All five Modules passed — the Curriculum is complete.',
      );
    });
  });

  it('says nothing and takes no focus on a plain load of an already-submitted Module', async () => {
    const first = await renderAt('/modules/m01/exercises/m01-e1');
    await submit(first.container);
    first.unmount();

    // The reload: a fresh IProgress over the same database.
    const second = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText(/Submitted ·/);
    // The banner is on screen …
    expect(
      second.container.querySelector('.exercise-gate-banner'),
    ).toBeInTheDocument();
    // … and the live region is silent: nothing arrived in it.
    expect(screen.getByRole('status').textContent).toBe('');
    expect(document.activeElement).toBe(document.body);
  });
});

/**
 * The #69 repro on this screen: the brief lives inside the Module's content
 * JSON, so a content fetch that fails offline leaves the Exercise screen as
 * blank as the Module's. `failures` requests reject, the rest succeed.
 */
function offlineSource(failures = Number.POSITIVE_INFINITY): ContentSource {
  let attempts = 0;
  return {
    loadIndex: async () => index,
    loadModuleContent: async (id) => {
      attempts += 1;
      if (attempts <= failures) throw new TypeError('Failed to fetch');
      return contentById[id] ?? null;
    },
  };
}

describe("Module content that will not load (#69)", () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the same unavailable state the Module screen shows', async () => {
    const { container } = await renderAt(
      '/modules/m01/exercises/m01-e1',
      undefined,
      undefined,
      offlineSource(),
    );

    const notice = await screen.findByRole('alert');
    expect(
      screen.getByRole('heading', {
        name: "This Module's content is not available",
      }),
    ).toBeInTheDocument();
    expect(notice).toHaveTextContent('content/modules/m01.json');
    expect(notice).toHaveTextContent('TypeError: Failed to fetch');
    // Nothing of the brief renders — there is no brief.
    expect(container.querySelector('.exercise-header')).not.toBeInTheDocument();
    expect(container.querySelector('.exercise-aside')).not.toBeInTheDocument();
  });

  it('goes back to the Curriculum, not to the Module that will not load', async () => {
    await renderAt(
      '/modules/m01/exercises/m01-e1',
      undefined,
      undefined,
      offlineSource(),
    );
    await screen.findByRole('alert');

    fireEvent.click(screen.getByRole('link', { name: 'Curriculum' }));

    expect(screen.getByText('curriculum probe')).toBeInTheDocument();
  });

  it('renders the brief on Try again once the fetch succeeds — no reload', async () => {
    await renderAt(
      '/modules/m01/exercises/m01-e1',
      undefined,
      undefined,
      offlineSource(1),
    );
    await screen.findByRole('alert');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByText('Deepen a shallow document store'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('still falls back to the Module when its content file is merely missing', async () => {
    // A 404 is the pending shape, not a failure: no briefs, so the unknown-
    // brief fallback runs — the unavailable surface must stay out of it.
    await renderAt('/modules/m01/exercises/m01-e1', undefined, undefined, {
      loadIndex: async () => index,
      loadModuleContent: async () => null,
    });

    expect(await screen.findByText('probe id m01')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
