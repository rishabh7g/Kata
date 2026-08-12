import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { CurriculumProvider } from '../app/CurriculumContext';
import type {
  ContentSource,
  ExerciseBrief,
  ModuleContent,
  ModuleIndex,
} from '../curriculum';
import { createCurriculum } from '../curriculum';
import { ExerciseScreen } from './ExerciseScreen';

// As in ModuleScreen.test.tsx: the fixture is the real createCurriculum over
// an in-memory ContentSource — the same seam main.tsx wires, minus HTTP.
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

function renderAt(path: string) {
  const curriculum = createCurriculum(source, {
    listCheckpoints: async () => [],
  });
  return render(
    <CurriculumProvider curriculum={curriculum}>
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
    </CurriculumProvider>,
  );
}

describe('Exercise screen', () => {
  it('renders the refactor brief: kicker, 40px title, Refactor-type tag, back button (#15)', async () => {
    renderAt('/modules/m01/exercises/m01-e1');

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
    renderAt('/modules/m01/exercises/m01-e2');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Build a recent-values cache behind a two-method surface' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Construct-type')).toHaveClass('tag-outline');
    expect(screen.getByText('Exercise m01-e2 · Module 01')).toBeInTheDocument();
  });

  it('shows the Spec grid with exactly Concept / Smell / Size budget rows — no Workbench (#3)', async () => {
    const { container } = renderAt('/modules/m01/exercises/m01-e1');
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
    const { container } = renderAt('/modules/m01/exercises/m01-e1');
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

  it('keeps the Target Interface display-only — nothing editable in the block (#3)', async () => {
    const { container } = renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Target Interface');

    expect(container.querySelector('textarea')).not.toBeInTheDocument();
    expect(container.querySelector('input')).not.toBeInTheDocument();
    expect(
      container.querySelector('[contenteditable]'),
    ).not.toBeInTheDocument();
  });

  it('renders the disabled note while folderUrl is the null placeholder (#23 pending)', async () => {
    const { container } = renderAt('/modules/m01/exercises/m01-e1');
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
    renderAt('/modules/m01/exercises/m01-e2');
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
    renderAt('/modules/m01/exercises/m01-e1');

    fireEvent.click(await screen.findByRole('link', { name: 'Module 01' }));

    expect(await screen.findByText('module probe')).toBeInTheDocument();
  });

  it('reserves the empty aside column — the Behavioral Checklist lands there in #16', async () => {
    const { container } = renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Exercise Spec');

    const body = container.querySelector('.exercise-body');
    expect(body).toBeInTheDocument();
    const aside = body?.querySelector('aside.exercise-aside');
    expect(aside).toBeInTheDocument();
    expect(aside?.textContent).toBe('');
  });

  it('falls back to the owning Module for an unknown Exercise id', async () => {
    renderAt('/modules/m01/exercises/nope');

    expect(await screen.findByText('module probe')).toBeInTheDocument();
  });

  it('falls back to the Curriculum for an unknown Module id', async () => {
    renderAt('/modules/nope/exercises/m01-e1');

    expect(await screen.findByText('curriculum probe')).toBeInTheDocument();
  });

  it('deep-loads through the app routes identically', async () => {
    // Same entry the reloaded hash URL produces: App resolves the full path.
    const curriculum = createCurriculum(source, {
      listCheckpoints: async () => [],
    });
    render(
      <CurriculumProvider curriculum={curriculum}>
        <MemoryRouter initialEntries={['/modules/m01/exercises/m01-e1']}>
          <App />
        </MemoryRouter>
      </CurriculumProvider>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Deepen a shallow document store' }),
    ).toBeInTheDocument();
  });

  it('renders nothing verification-shaped: no terminal, runs, status, or Workbench (#3)', async () => {
    const { container } = renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Exercise Spec');

    const text = container.textContent ?? '';
    expect(text).not.toMatch(/terminal|workbench|verif/i);
    expect(text).not.toMatch(/\bgreen\b|\bfailing\b|run history|\bruns\b/i);
    // Nothing calendar-shaped either (docs/design.md § Pedagogy).
    expect(text).not.toMatch(/timeline|streak|schedule|deadline/i);
  });

  it('uses no banned terms (docs/ubiquitous-language.md § Banned)', async () => {
    const { container } = renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Exercise Spec');

    const text = container.textContent ?? '';
    expect(text).not.toMatch(/lesson|course|level|quiz|flashcard|grade|score/i);
  });
});
