import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { CurriculumProvider } from '../app/CurriculumContext';
import type { ContentSource, ModuleContent, ModuleIndex } from '../curriculum';
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
  exercises: [],
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
          <Route path="/modules/:id" element={<ModuleScreen />} />
        </Routes>
      </MemoryRouter>
    </CurriculumProvider>,
  );
}

describe('Module screen', () => {
  it('renders the Concept Page markdown as styled prose in the 66ch container', async () => {
    const { container } = renderAt('/modules/m01');
    await screen.findByText('Concept Page');

    // Headings shift one level down: the page h1 is the header block's (#12).
    expect(
      screen.getByRole('heading', { level: 2, name: 'Deep Modules & Information Hiding' }),
    ).toBeInTheDocument();
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
      await screen.findByRole('heading', { level: 2, name: 'Deep Modules & Information Hiding' }),
    ).toBeInTheDocument();
  });

  it('renders a pending Module without a crash or blank page (#28 adds the real copy)', async () => {
    renderAt('/modules/m02');

    expect(await screen.findByText('Concept Page pending.')).toBeInTheDocument();
    expect(screen.getByText('Model Examples pending.')).toBeInTheDocument();
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
