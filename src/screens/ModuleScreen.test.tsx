import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import {
  MemoryRouter,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { CurriculumProvider } from '../app/CurriculumContext';
import { ProgressProvider } from '../app/ProgressContext';
import type {
  ContentSource,
  ModuleContent,
  ModuleIndex,
} from '../curriculum';
import { createCurriculum } from '../curriculum';
import type { IProgress } from '../progress';
import { createProgress } from '../progress';
import { expectWellFormedOutline } from '../test/headings';
import { ModuleScreen } from './ModuleScreen';

// As in CurriculumScreen.test.tsx: the fixture is the real createCurriculum
// over an in-memory ContentSource — the same seam main.tsx wires, minus HTTP.
const index: ModuleIndex = {
  schemaVersion: 2,
  categories: [
    { id: 'software-design', ordinal: 1, title: 'Software Design', description: 'Design fundamentals in C#.', language: 'csharp' },
  ],
  modules: [
    { id: 'm01', categoryId: 'software-design', ordinal: 1, title: 'Deep Modules & Information Hiding', description: 'Hide the most complexity behind the smallest surface.', pending: false },
    { id: 'm02', categoryId: 'software-design', ordinal: 2, title: 'Dependency Direction', description: 'Point dependencies at stable abstractions.', pending: true },
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
  selfCheckQuestions: [
    { id: 'q1', prompt: 'p1', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
    { id: 'q2', prompt: 'p2', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
    { id: 'q3', prompt: 'p3', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
  ],
};

const source: ContentSource = {
  loadIndex: async () => index,
  loadModuleContent: async (id) => (id === 'm01' ? content : null),
};

// An explain-only Module (#161): authored, complete, and carrying no
// Exercises at all — the shape milestone L3's Agentic AI Modules ship in.
// Exercises are 0..n; two-of-a-kind is a Software Design authoring
// convention (docs/design.md § Module anatomy), not a schema rule.
const explainOnlyContent: ModuleContent = {
  ...content,
  id: 'm03',
  conceptPageMarkdown: '# Explain-only Module\n\n## Reading it is the whole Module\n\nNothing to clone.',
  exercises: [],
};

const explainOnlyIndex: ModuleIndex = {
  ...index,
  modules: [
    ...index.modules,
    { id: 'm03', categoryId: 'software-design', ordinal: 3, title: 'Explain-only Module', description: 'A Module that only explains.', pending: false },
  ],
};

const explainOnlySource: ContentSource = {
  loadIndex: async () => explainOnlyIndex,
  loadModuleContent: async (id) =>
    id === 'm03' ? explainOnlyContent : id === 'm01' ? content : null,
};

beforeEach(() => {
  // A brand-new browser profile per test (#14's prescribed environment).
  globalThis.indexedDB = new IDBFactory();
});

/** Browser Back and Forward, outside `Routes` so history is what moves. */
function HistoryControls() {
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => void navigate(-1)}>back</button>
      <button onClick={() => void navigate(1)}>forward</button>
    </>
  );
}

async function renderAt(
  path: string,
  progress?: IProgress,
  contentSource: ContentSource = source,
) {
  const curriculum = createCurriculum(contentSource);
  const activeProgress = progress ?? (await createProgress());
  const utils = render(
    <CurriculumProvider curriculum={curriculum}>
      <ProgressProvider progress={activeProgress}>
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
      </ProgressProvider>
    </CurriculumProvider>,
  );
  return { ...utils, progress: activeProgress };
}

describe('Module screen', () => {
  it('has one h1 and no skipped heading levels (#75)', async () => {
    const { container } = await renderAt('/modules/m01');
    await screen.findByRole('heading', { level: 2, name: 'Self-Check' });

    // Section labels are h2 while still rendering as the design system's 13px
    // uppercase label, and the Concept Page's own prose sits one level under
    // the label that introduces it (## → h3).
    expect(expectWellFormedOutline(container)).toEqual([
      'h1 Deep Modules & Information Hiding',
      'h2 Concept Page',
      'h3 The trade every module makes',
      'h2 Model Examples',
      'h2 Exercises',
      'h2 Self-Check',
    ]);
  });

  it('renders the Concept Page markdown as styled prose in the 66ch container', async () => {
    const { container } = await renderAt('/modules/m01');
    await screen.findByRole('heading', { level: 2, name: 'Self-Check' });

    // The markdown's own leading `# title` is stripped — the header h1 (#12)
    // already carries it, so the title renders exactly once on the page.
    expect(
      screen.getAllByText('Deep Modules & Information Hiding'),
    ).toHaveLength(1);
    // Later headings still shift one level down (## → h3), which is one
    // level under the `Concept Page` h2 that introduces them (#75).
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

  // #139: the packs' `*LLM first draft · human-edited once · frozen*` line
  // is authoring provenance, not learning content. It stays in the committed
  // markdown and reaches no part of the screen — neither the label row it
  // used to sit in (#30) nor, once that display went, the prose body.
  it('renders no provenance note anywhere on an authored Module (#139)', async () => {
    const { container } = await renderAt('/modules/m01');
    await screen.findByRole('heading', { level: 2, name: 'Self-Check' });

    expect(container.textContent ?? '').not.toContain('LLM first draft');
    expect(container.textContent ?? '').not.toContain('human-edited once');
    expect(container.querySelector('.module-concept-note')).toBeNull();
    expect(container.querySelector('.module-concept-heading')).toBeNull();

    // The label is the same plain section label the other sections carry.
    const label = screen.getByText('Concept Page');
    expect(label).toHaveClass('module-section-label');
    expect(label).not.toHaveClass('module-section-label-inline');

    // The body still opens on the pack's own first paragraph, not on a
    // blank where the stripped line was.
    const paragraphs = [
      ...(container.querySelectorAll('.module-concept p') ?? []),
    ];
    expect(paragraphs[0]?.textContent).toContain('Every module has a surface');
  });

  it('renders a pack with no provenance line in full (#139)', async () => {
    // Nothing to strip: the first paragraph is prose and must survive, with
    // the leading `# title` still dropped as always.
    const plain: ModuleContent = {
      ...content,
      conceptPageMarkdown: [
        '# Deep Modules & Information Hiding',
        '',
        'An opening paragraph with no note above it.',
        '',
        '## The trade every module makes',
        '',
        'A second paragraph.',
      ].join('\n'),
    };
    const { container } = await renderAt('/modules/m01', undefined, {
      loadIndex: async () => index,
      loadModuleContent: async (id) => (id === 'm01' ? plain : null),
    });
    await screen.findByText('Concept Page');

    const paragraphs = [...container.querySelectorAll('.module-concept p')];
    expect(paragraphs.map((p) => p.textContent)).toEqual([
      'An opening paragraph with no note above it.',
      'A second paragraph.',
    ]);
    // The title is still stripped — once on the page, from the header h1.
    expect(
      screen.getAllByText('Deep Modules & Information Hiding'),
    ).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 3, name: 'The trade every module makes' }),
    ).toBeInTheDocument();
  });

  it('renders every Model Example as a BEFORE/AFTER pair with its caption', async () => {
    const { container } = await renderAt('/modules/m01');
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

  // #77: every history entry used to read the same `Kata`, so a bookmark, a
  // tab and a screen reader all learned nothing about where they were.
  it('names the tab `Module 01 — <title> · Kata`, holding plain `Kata` while it loads', async () => {
    // The content arrives only when this is released, so the loading render
    // is observable rather than a race.
    let release = () => {};
    const arrived = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow: ContentSource = {
      loadIndex: async () => index,
      loadModuleContent: async (id) => {
        await arrived;
        return id === 'm01' ? content : null;
      },
    };
    document.title = 'Module 02 — Dependency Direction · Kata';

    await renderAt('/modules/m01', undefined, slow);

    // No flash of the Module the tab named a moment ago.
    expect(document.title).toBe('Kata');

    release();
    await screen.findByText('Concept Page');
    expect(document.title).toBe(
      'Module 01 — Deep Modules & Information Hiding · Kata',
    );
  });

  it('follows browser Back and Forward, not just a fresh load (#77)', async () => {
    const curriculum = createCurriculum(source);
    render(
      <CurriculumProvider curriculum={curriculum}>
        <ProgressProvider progress={await createProgress()}>
          {/* Two entries deep, sitting on the Module: the controls traverse
              history itself, which is what Back and Forward really do. */}
          <MemoryRouter initialEntries={['/', '/modules/m01']} initialIndex={1}>
            <HistoryControls />
            <App />
          </MemoryRouter>
        </ProgressProvider>
      </CurriculumProvider>,
    );
    const moduleTitle = 'Module 01 — Deep Modules & Information Hiding · Kata';
    // The title is named from an effect, which flushes after the DOM node the
    // query waits on — so the tab is asserted with waitFor, not read once.
    await screen.findByText('Concept Page');
    await waitFor(() => expect(document.title).toBe(moduleTitle));

    fireEvent.click(screen.getByRole('button', { name: 'back' }));
    await screen.findByRole('heading', {
      level: 1,
      name: 'Learn design by producing code.',
    });
    await waitFor(() => expect(document.title).toBe('Kata'));

    fireEvent.click(screen.getByRole('button', { name: 'forward' }));
    await screen.findByText('Concept Page');
    await waitFor(() => expect(document.title).toBe(moduleTitle));
  });

  it('deep-loads through the app routes identically', async () => {
    // Same entry the reloaded hash URL produces: App resolves /modules/m01.
    const curriculum = createCurriculum(source);
    render(
      <CurriculumProvider curriculum={curriculum}>
        <ProgressProvider progress={await createProgress()}>
          <MemoryRouter initialEntries={['/modules/m01']}>
            <App />
          </MemoryRouter>
        </ProgressProvider>
      </CurriculumProvider>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Deep Modules & Information Hiding' }),
    ).toBeInTheDocument();
  });

  it('shows the header: kicker, 44px title, ghost back button — and no tag (#12, #157)', async () => {
    const { container } = await renderAt('/modules/m01');

    expect(await screen.findByText('Module 01')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Deep Modules & Information Hiding' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Curriculum' })).toHaveClass(
      'btn-ghost',
    );
    // No status tag on the header at all (#157): the Library reports no state
    // back to the reader, and since #158 a ModuleSummary carries none to
    // report — there is no per-reader shape left for a tag to read.
    expect(container.querySelector('.module-header .tag')).toBeNull();
    expect(screen.queryByText('Ready to start')).not.toBeInTheDocument();
    expect(container.querySelector('.tag-accent')).toBeNull();
    expect(container.querySelector('.tag-neutral')).toBeNull();
    expect(container.textContent ?? '').not.toMatch(/Exit Gate passed/i);
  });

  it('changes nothing outside the Self-Check when answers are stored (#157)', async () => {
    // The old header tag flipped to `In progress` off exactly this draft
    // (#30). Answering is not a state the screen reports any more.
    const progress = await createProgress();
    await progress.saveSelfCheckAnswers('m01', { q1: 'a' });

    const { container } = await renderAt('/modules/m01', progress);
    await screen.findByRole('heading', { level: 2, name: 'Self-Check' });

    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
    expect(container.querySelector('.module-header .tag')).toBeNull();
    // The answer itself is restored, inside the panel and nowhere else.
    expect(screen.getAllByRole('radio')[0]!).toBeChecked();
  });

  it('returns to the Curriculum via the back button', async () => {
    await renderAt('/modules/m01');

    fireEvent.click(await screen.findByRole('link', { name: 'Curriculum' }));

    expect(await screen.findByText('curriculum probe')).toBeInTheDocument();
  });

  it('renders one card per brief — type tag, title, Smell line, arrow, no run status (#3)', async () => {
    const { container } = await renderAt('/modules/m01');
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
    await renderAt('/modules/m01');
    await screen.findByText('Exercises');

    // The whole card is the link; its title is inside it.
    fireEvent.click(screen.getByText('Deepen a shallow document store'));

    expect(await screen.findByText('exercise probe')).toBeInTheDocument();
  });

  // ── Explain-only Module (#161): Exercises are 0..n, so a Module can be
  // complete with none. It reads shorter — it does not report an absence.
  it('renders no Exercises section at all for a Module with zero Exercises (#161)', async () => {
    const { container } = await renderAt('/modules/m03', undefined, explainOnlySource);
    await screen.findByRole('heading', { level: 2, name: 'Self-Check' });

    // No heading, no empty-state placeholder, no cards: the word never
    // appears on the screen, and the outline simply skips it.
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Exercises' }),
    ).toBeNull();
    expect(container.querySelector('.module-pending-copy')).toBeNull();
    expect(container.querySelector('.module-exercises')).toBeNull();
    expect(container.querySelector('.module-exercise-card')).toBeNull();
    expect(container.textContent ?? '').not.toMatch(/Exercise/i);

    // What it does render: the Concept Page, the Model Examples, and the
    // Self-Check — the Module is complete, only shorter.
    expect(expectWellFormedOutline(container)).toEqual([
      'h1 Explain-only Module',
      'h2 Concept Page',
      'h3 Reading it is the whole Module',
      'h2 Model Examples',
      'h2 Self-Check',
    ]);
    expect(container.querySelectorAll('.module-example')).toHaveLength(2);
  });

  it('drops the divider that led into the Exercises section too (#161)', async () => {
    const { container } = await renderAt('/modules/m03', undefined, explainOnlySource);
    await screen.findByRole('heading', { level: 2, name: 'Model Examples' });

    // One rule only — between the Concept Page and the Model Examples. A
    // second would hang under the last example, ruling off nothing.
    expect(container.querySelectorAll('.module-rule')).toHaveLength(1);
  });

  it('exposes no navigable Exercise route from an explain-only Module (#161)', async () => {
    const { container } = await renderAt('/modules/m03', undefined, explainOnlySource);
    await screen.findByRole('heading', { level: 2, name: 'Self-Check' });

    const links = [...container.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/']);
  });

  it('still autosaves the Self-Check of a Module with no Exercises (#161)', async () => {
    const { progress } = await renderAt('/modules/m03', undefined, explainOnlySource);
    await screen.findByRole('heading', { level: 2, name: 'Self-Check' });

    fireEvent.click(screen.getAllByRole('radio')[0] as HTMLElement);

    await waitFor(async () => {
      expect(await progress.getSelfCheckAnswers('m03')).not.toBeNull();
    });
  });

  // ── Pending Module (#28): Module 2 is open like every other Module, but
  // its content pack is not authored — the placeholder state, never blank.
  it('renders the pending placeholder blocks with the prototype copy (#28)', async () => {
    await renderAt('/modules/m02');

    // Header stays fully real: kicker, title, ghost back.
    expect(await screen.findByText('Module 02')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Dependency Direction' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Curriculum' })).toHaveClass(
      'btn-ghost',
    );

    // The three placeholder blocks, wording per the prototype's pending
    // section (design/DevGym.dc.html § Module).
    expect(
      screen.getByText(
        /Concept Page not written yet — there is nothing to read in this Module\./,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Model Examples arrive with the Concept Page.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No Exercises yet — the first is generated from an Exercise Spec\./),
    ).toBeInTheDocument();
  });

  it('exposes no navigable Exercise routes on a pending Module (#28)', async () => {
    const { container } = await renderAt('/modules/m02');
    await screen.findByText('Exercises');

    // No cards, no links besides the back button — nothing navigates to an
    // Exercise, and no question renders anywhere.
    expect(container.querySelector('.module-exercise-card')).toBeNull();
    const links = [...container.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/']);
    expect(container.querySelector('form, input, button[type="submit"]')).toBeNull();
  });

  it('renders no aside on a pending Module — it carries no questions (#157)', async () => {
    const { container } = await renderAt('/modules/m02');
    await screen.findByText('Exercises');

    // A pending pack has no Self-Check, and the aside never held anything
    // else: no panel, no heading, no radios, no column at all.
    expect(container.querySelector('aside.module-aside')).toBeNull();
    expect(container.querySelector('.self-check')).toBeNull();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('uses no banned terms on the pending screen (#28)', async () => {
    const { container } = await renderAt('/modules/m02');
    await screen.findByText('Exercises');

    expect(container.textContent ?? '').not.toMatch(
      /lesson|course|level|quiz|flashcard|grade|score/i,
    );
  });

  // #139: the pending copy used to name the Generator and narrate the
  // authoring pipeline — a system term (docs/ubiquitous-language.md § System
  // terms) the learner has never heard of and cannot act on.
  it('names no part of the authoring pipeline on the pending screen (#139)', async () => {
    const { container } = await renderAt('/modules/m02');
    await screen.findByText('Exercises');

    const text = container.textContent ?? '';
    expect(text).not.toMatch(/generator|ICurriculum|IProgress|\bLLM\b|frozen/i);
    expect(text).not.toMatch(
      /streak|daily goal|days left|% complete|\bXP\b|\bjust\b|\bsimply\b|\beasy\b/i,
    );
    // The section is still filled, not blank, and the other two pending
    // lines are untouched.
    expect(
      container.querySelectorAll('.module-pending-copy'),
    ).toHaveLength(3);
  });

  it('falls back to the Curriculum for an unknown Module id', async () => {
    await renderAt('/modules/nope');

    expect(await screen.findByText('curriculum probe')).toBeInTheDocument();
  });

  // ── The Self-Check aside (#157): the Module's optional questions, in the
  // 350px column the gated model's panel used to hold.
  it('renders the three questions in the aside, unanswered and unsubmittable', async () => {
    const { container } = await renderAt('/modules/m01');
    await screen.findByRole('heading', { level: 2, name: 'Self-Check' });

    const aside = container.querySelector('aside.module-aside');
    expect(aside?.querySelector('.self-check')).toBeInTheDocument();
    expect(aside?.querySelectorAll('.self-check-item')).toHaveLength(3);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(6);
    for (const radio of radios) expect(radio).not.toBeChecked();

    // No submit control anywhere in the DOM — not in the aside, not outside.
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(container.querySelector('[type="submit"]')).toBeNull();
  });

  it('persists a pick without any button, and restores it on a revisit', async () => {
    const progress = await createProgress();
    const { unmount } = await renderAt('/modules/m01', progress);
    await screen.findByRole('heading', { level: 2, name: 'Self-Check' });

    fireEvent.click(screen.getAllByRole('radio')[1]!);
    expect((await progress.getSelfCheckAnswers('m01'))?.answers).toEqual({
      q1: 'b',
    });

    // A reload of the same Module, same browser: the pick comes back.
    unmount();
    await renderAt('/modules/m01', progress);
    await screen.findByRole('heading', { level: 2, name: 'Self-Check' });
    expect(screen.getAllByRole('radio')[1]!).toBeChecked();
  });

  it('answering changes nothing outside the Self-Check panel (#157)', async () => {
    const progress = await createProgress();
    const { container } = await renderAt('/modules/m01', progress);
    await screen.findByRole('heading', { level: 2, name: 'Self-Check' });

    const outside = () => {
      const clone = container.cloneNode(true) as HTMLElement;
      clone.querySelector('.self-check')?.remove();
      return clone.textContent ?? '';
    };
    const before = outside();

    for (const radio of screen.getAllByRole('radio')) fireEvent.click(radio);

    // Same screen, same text, same route: no state line, no status tag, no
    // banner. The only tags left are the Exercise cards' own type tags.
    expect(outside()).toBe(before);
    expect(container.querySelector('.module-header .tag')).toBeNull();
    expect(
      [...container.querySelectorAll('.tag')].map((tag) => tag.textContent),
    ).toEqual(['Refactor', 'Construct']);
    expect(container.textContent ?? '').not.toMatch(/passed|recorded/i);
  });

  it('has no schedule talk, no Test-Suites row (#3, #113)', async () => {
    const { container } = await renderAt('/modules/m01');
    await screen.findByText('Model Examples');

    // The read-once reassurance note about advancing was deleted (#113): it
    // carried no live data, was not an instruction, and guarded nothing.
    const text = container.textContent ?? '';
    // Nothing calendar-shaped anywhere on the screen.
    expect(text).not.toMatch(/timeline|streak|schedule|deadline|per week/i);
    // The captures' second row is historical (read-only decision, #3): no
    // suite status and no run-count text render anywhere.
    expect(text).not.toMatch(/test suites? green|suites green|runs?\b/i);
  });

  it('uses no banned terms (docs/ubiquitous-language.md § Banned)', async () => {
    const { container } = await renderAt('/modules/m01');
    await screen.findByText('Model Examples');

    const text = container.textContent ?? '';
    expect(text).not.toMatch(/lesson|course|level|quiz|flashcard|grade|score/i);
  });

  // design/issue-guide.md § UI copy ban list (#115) — the writing-style list,
  // separate from the domain vocabulary above. The Self-Check definition
  // (#157) is the only prose the aside carries, so the screen asserts
  // against it here.
  it('uses no word from the UI copy ban list (#115)', async () => {
    const { container } = await renderAt('/modules/m01');
    await screen.findByRole('heading', { level: 2, name: 'Self-Check' });

    const text = container.textContent ?? '';
    expect(text).not.toMatch(
      /streak|daily goal|days left|% complete|\bXP\b|\bjust\b|\bsimply\b|\beasy\b/i,
    );
  });

  // docs/ubiquitous-language.md § Removed terms: the gated-course vocabulary
  // this screen carried on every state until #157.
  it('names no removed term anywhere on the screen (#157)', async () => {
    const { container } = await renderAt('/modules/m01');
    await screen.findByRole('heading', { level: 2, name: 'Self-Check' });

    const text = container.textContent ?? '';
    expect(text).not.toMatch(
      /exit gate|behavioral checklist|checkpoint|unlock|locked|\bgate\b|submit/i,
    );
  });
});

/**
 * The repro from #69: online once (so the app shell is precached), offline
 * before this Module was ever read. The index is in the service worker cache
 * — so the Curriculum still renders — but the content JSON is not, so its
 * fetch rejects and `getModule` rejects with it.
 */
function offlineSource(failures = Number.POSITIVE_INFINITY): ContentSource {
  let attempts = 0;
  return {
    loadIndex: async () => index,
    loadModuleContent: async (id) => {
      attempts += 1;
      if (attempts <= failures) throw new TypeError('Failed to fetch');
      return id === 'm01' ? content : null;
    },
  };
}

describe('Module content that will not load (#69)', () => {
  beforeEach(() => {
    // The hook logs the failure for whoever is looking at the console; these
    // tests are about what the learner sees, so keep the run quiet.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('says the content is not available instead of rendering nothing', async () => {
    const { container } = await renderAt('/modules/m01', undefined, offlineSource());

    const notice = await screen.findByRole('alert');
    expect(
      screen.getByRole('heading', {
        name: "This Module's content is not available",
      }),
    ).toBeInTheDocument();
    // Names the file, the cause, and what to do — the #68 Notice pattern.
    expect(notice).toHaveTextContent('content/modules/m01.json');
    expect(notice).toHaveTextContent('not available offline');
    expect(notice).toHaveTextContent('Reconnect and try again');
    // The browser's own words for the failure.
    expect(notice).toHaveTextContent('TypeError: Failed to fetch');
    expect(notice).toHaveClass('app-notice');
    // Nothing pretends the Module loaded: no header, no aside.
    expect(container.querySelector('.module-header')).not.toBeInTheDocument();
    expect(container.querySelector('.module-aside')).not.toBeInTheDocument();
  });

  it('is a screen with an outline: the notice title is the h1 (#94)', async () => {
    const { container } = await renderAt('/modules/m01', undefined, offlineSource());
    await screen.findByRole('alert');

    // The failure state is the whole screen, so its title is the only
    // heading — and it has to be the h1, not the h2 it used to be.
    expect(expectWellFormedOutline(container)).toEqual([
      "h1 This Module's content is not available",
    ]);
    // Level on the tag, size on the class (#75): still the 16px card title.
    expect(container.querySelector('h1')).toHaveClass('app-notice-title');
  });

  it('keeps the Curriculum back link — never a dead end', async () => {
    await renderAt('/modules/m01', undefined, offlineSource());
    await screen.findByRole('alert');

    fireEvent.click(screen.getByRole('link', { name: 'Curriculum' }));

    expect(screen.getByText('curriculum probe')).toBeInTheDocument();
  });

  it('loads the Module on Try again once the fetch succeeds — no reload', async () => {
    await renderAt('/modules/m01', undefined, offlineSource(1));
    await screen.findByRole('alert');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    // Same mount, no navigation: the Module simply renders.
    expect(await screen.findByText('Concept Page')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('still renders a pending Module — a missing content file is not a failure', async () => {
    // m02 is pending: its content file 404s, which the content source turns
    // into the pending shape. That must never reach the unavailable surface.
    await renderAt('/modules/m02');

    expect(
      await screen.findByText(/Concept Page not written yet/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('still logs the failure for whoever is looking at the console', async () => {
    await renderAt('/modules/m01', undefined, offlineSource());
    await screen.findByRole('alert');

    expect(console.error).toHaveBeenCalledWith(
      'Failed to load Module m01',
      expect.any(TypeError),
    );
  });

  it('uses no banned terms (docs/ubiquitous-language.md § Banned)', async () => {
    const { container } = await renderAt('/modules/m01', undefined, offlineSource());
    await screen.findByRole('alert');

    expect(container.textContent ?? '').not.toMatch(
      /lesson|course|level|quiz|flashcard|grade|score/i,
    );
  });
});
