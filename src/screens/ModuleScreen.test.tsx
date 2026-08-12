import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { CurriculumProvider } from '../app/CurriculumContext';
import type {
  Checkpoint,
  ContentSource,
  ModuleContent,
  ModuleIndex,
} from '../curriculum';
import { createCurriculum } from '../curriculum';
import { ModuleScreen } from './ModuleScreen';

// As in CurriculumScreen.test.tsx: the fixture is the real createCurriculum
// over an in-memory ContentSource — the same seam main.tsx wires, minus HTTP.
const index: ModuleIndex = {
  schemaVersion: 1,
  modules: [
    { id: 'm01', ordinal: 1, title: 'Deep Modules & Information Hiding', description: 'Hide the most complexity behind the smallest surface.', pending: false },
    { id: 'm02', ordinal: 2, title: 'Dependency Direction', description: 'Point dependencies at stable abstractions.', pending: true },
  ],
};

// Markdown exercising every construct the Concept Pages use: headings, the
// note line, strong/em/inline code, hard-wrapped paragraphs, both list kinds
// with wrapped continuation lines.
const conceptPageMarkdown = [
  '# Deep Modules & Information Hiding',
  '',
  '*LLM first draft · human-edited once · frozen*',
  '',
  '## The trade every module makes',
  '',
  'Every module has a **surface** and functionality: think of',
  '`File.ReadAllText(path)` — one call. The surface is *cost*.',
  '',
  '1. **Pass-through values.** Count',
  '   them.',
  '2. Required call order.',
  '',
  '- Defaults over knobs.',
  '- Pull complexity',
  '  downward.',
].join('\n');

const content: ModuleContent = {
  schemaVersion: 1,
  id: 'm01',
  conceptPageMarkdown,
  modelExamples: [
    {
      before: 'public void Write(string baseDir, string reportName, string contents, Encoding encoding) { /* every decision is the caller’s */ }',
      after: 'public void Write(string reportName, string contents) { }',
      caption: 'The directory layout and encoding decisions moved inside.',
    },
    {
      before: 'r.Open(path);\nr.Load();\nr.Close();',
      after: 'var report = ReportReader.Read(path);',
      caption: 'The lifecycle became the module’s business.',
    },
  ],
  // The two Module 1 brief kinds (#8): one refactor, one construct.
  exercises: [
    {
      id: 'm01-e1',
      type: 'refactor',
      title: 'Deepen a shallow document store',
      concept: 'Deep modules',
      smell: 'Shallow module: every decision leaks into the caller.',
      targetInterfaceCode: 'public interface IDocumentStore { }',
      sizeBudgetLoc: 120,
      folderUrl: null,
    },
    {
      id: 'm01-e2',
      type: 'construct',
      title: 'Build a recent-values cache behind a two-method surface',
      concept: 'Information hiding',
      smell: 'The stub tempts a shallow build: knobs the cache must own.',
      targetInterfaceCode: 'public interface IRecentValuesCache { }',
      sizeBudgetLoc: 150,
      folderUrl: null,
    },
  ],
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

function renderAt(path: string, checkpoints: readonly Checkpoint[] = []) {
  const curriculum = createCurriculum(source, {
    listCheckpoints: async () => checkpoints,
  });
  return render(
    <CurriculumProvider curriculum={curriculum}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<p>curriculum probe</p>} />
          <Route path="/modules/:id" element={<ModuleScreen />} />
          {/* Where a card's link lands once #15 builds the screen. */}
          <Route
            path="/modules/:id/exercises/:exerciseId"
            element={<p>exercise probe</p>}
          />
        </Routes>
      </MemoryRouter>
    </CurriculumProvider>,
  );
}

describe('Module screen', () => {
  it('renders the Concept Page markdown as styled prose in the 66ch container', async () => {
    const { container } = renderAt('/modules/m01');
    await screen.findByText('Concept Page');

    // The markdown's own leading `# title` is stripped — the header h1 (#12)
    // already carries it, so the title renders exactly once on the page.
    expect(
      screen.getAllByText('Deep Modules & Information Hiding'),
    ).toHaveLength(1);
    // Later headings still shift one level down (## → h3).
    expect(
      screen.getByRole('heading', { level: 3, name: 'The trade every module makes' }),
    ).toBeInTheDocument();

    const prose = container.querySelector('.module-concept');
    expect(prose).toBeInTheDocument();
    expect(prose?.querySelector('strong')?.textContent).toBe('surface');
    expect(prose?.querySelector('code')?.textContent).toBe('File.ReadAllText(path)');
    // Hard-wrapped source lines join into one paragraph (inline code intact).
    const paragraphs = [...(prose?.querySelectorAll('p') ?? [])];
    expect(paragraphs.map((p) => p.textContent)).toContain(
      'Every module has a surface and functionality: think of File.ReadAllText(path) — one call. The surface is cost.',
    );

    // Lists, including wrapped continuation lines.
    const ordered = [...(prose?.querySelectorAll('ol li') ?? [])];
    expect(ordered.map((li) => li.textContent)).toEqual([
      'Pass-through values. Count them.',
      'Required call order.',
    ]);
    const unordered = [...(prose?.querySelectorAll('ul li') ?? [])];
    expect(unordered.map((li) => li.textContent)).toEqual([
      'Defaults over knobs.',
      'Pull complexity downward.',
    ]);
  });

  it('shows the draft/edited/frozen note from the markdown', async () => {
    renderAt('/modules/m01');

    expect(
      await screen.findByText('LLM first draft · human-edited once · frozen'),
    ).toBeInTheDocument();
  });

  it('renders every Model Example as a BEFORE/AFTER pair with its caption', async () => {
    const { container } = renderAt('/modules/m01');
    await screen.findByText('Model Examples');

    const figures = container.querySelectorAll('.module-example');
    expect(figures).toHaveLength(2);
    for (const figure of figures) {
      const labels = [...figure.querySelectorAll('.module-example-label')];
      expect(labels.map((l) => l.textContent)).toEqual(['Before', 'After']);
      expect(labels[1]).toHaveClass('module-example-label-after');
      // Code renders verbatim in the scrolling cell, one <pre> per side.
      expect(figure.querySelectorAll('pre.module-example-code')).toHaveLength(2);
    }
    expect(screen.getByText(/decisions moved inside/)).toBeInTheDocument();
    expect(screen.getByText(/lifecycle became the module/)).toBeInTheDocument();
    // The grid cells own the horizontal overflow (min-width: 0 + overflow-x).
    expect(container.querySelector('.module-example-grid')).toBeInTheDocument();
  });

  it('deep-loads through the app routes identically', async () => {
    // Same entry the reloaded hash URL produces: App resolves /modules/m01.
    const curriculum = createCurriculum(source, {
      listCheckpoints: async () => [],
    });
    render(
      <CurriculumProvider curriculum={curriculum}>
        <MemoryRouter initialEntries={['/modules/m01']}>
          <App />
        </MemoryRouter>
      </CurriculumProvider>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Deep Modules & Information Hiding' }),
    ).toBeInTheDocument();
  });

  it('shows the header: kicker, 44px title, status tag, ghost back button (#12)', async () => {
    renderAt('/modules/m01');

    expect(await screen.findByText('Module 01')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Deep Modules & Information Hiding' }),
    ).toBeInTheDocument();
    // Fresh Module, no Checkpoint: the neutral tag, as on the Curriculum row.
    expect(screen.getByText('Ready to start')).toHaveClass('tag-neutral');
    expect(screen.getByRole('link', { name: 'Curriculum' })).toHaveClass(
      'btn-ghost',
    );
  });

  it('flips the header tag to Exit Gate passed once a Checkpoint exists', async () => {
    renderAt('/modules/m01', [
      { moduleId: 'm01', passedAt: '2026-06-12T09:41:00.000Z' },
    ]);

    expect(await screen.findByText('Exit Gate passed')).toHaveClass(
      'tag-accent',
    );
    expect(screen.queryByText('Ready to start')).not.toBeInTheDocument();
  });

  it('returns to the Curriculum via the back button', async () => {
    renderAt('/modules/m01');

    fireEvent.click(await screen.findByRole('link', { name: 'Curriculum' }));

    expect(await screen.findByText('curriculum probe')).toBeInTheDocument();
  });

  it('renders one card per brief — type tag, title, Smell line, arrow, no run status (#3)', async () => {
    const { container } = renderAt('/modules/m01');
    await screen.findByText('Exercises');

    const cards = [...container.querySelectorAll('.module-exercise-card')];
    expect(cards).toHaveLength(2);

    const [refactor, construct] = cards;
    expect(refactor?.querySelector('.tag-outline')?.textContent).toBe(
      'Refactor',
    );
    expect(refactor?.querySelector('.module-exercise-title')?.textContent).toBe(
      'Deepen a shallow document store',
    );
    expect(refactor?.querySelector('.module-exercise-smell')?.textContent).toBe(
      'Shallow module: every decision leaks into the caller.',
    );
    expect(refactor?.querySelector('svg')).toBeInTheDocument();
    expect(construct?.querySelector('.tag-outline')?.textContent).toBe(
      'Construct',
    );

    // Nothing verification-shaped anywhere on a card (removed per #3).
    for (const card of cards) {
      expect(card.textContent).not.toMatch(/green|failing|run|test suite/i);
    }
  });

  it('navigates to the Exercise route from anywhere on the card', async () => {
    renderAt('/modules/m01');
    await screen.findByText('Exercises');

    // The whole card is the link; its title is inside it.
    fireEvent.click(screen.getByText('Deepen a shallow document store'));

    expect(await screen.findByText('exercise probe')).toBeInTheDocument();
  });

  it('renders a pending Module without a crash or blank page (#28 adds the real copy)', async () => {
    renderAt('/modules/m02');

    expect(await screen.findByText('Concept Page pending.')).toBeInTheDocument();
    expect(screen.getByText('Model Examples pending.')).toBeInTheDocument();
    // Zero briefs: the section heading with a quiet note, never a crash.
    expect(screen.getByText('Exercises')).toBeInTheDocument();
    expect(screen.getByText('Exercises pending.')).toBeInTheDocument();
  });

  it('falls back to the Curriculum for an unknown Module id', async () => {
    renderAt('/modules/nope');

    expect(await screen.findByText('curriculum probe')).toBeInTheDocument();
  });

  it('uses no banned terms (docs/ubiquitous-language.md § Banned)', async () => {
    const { container } = renderAt('/modules/m01');
    await screen.findByText('Model Examples');

    const text = container.textContent ?? '';
    expect(text).not.toMatch(/lesson|course|level|quiz|flashcard|grade|score/i);
  });
});
