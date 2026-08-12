import { fireEvent, render, screen } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { CurriculumProvider } from '../app/CurriculumContext';
import { ProgressProvider } from '../app/ProgressContext';
import type {
  Checkpoint,
  ContentSource,
  ModuleContent,
  ModuleIndex,
  ModuleSummary,
} from '../curriculum';
import { createCurriculum } from '../curriculum';
import type { GateStatus, IProgress } from '../progress';
import { createProgress } from '../progress';
import { ExitGateAside, ModuleScreen } from './ModuleScreen';

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

beforeEach(() => {
  // A brand-new browser profile per test (#14's prescribed environment).
  globalThis.indexedDB = new IDBFactory();
});

async function renderAt(
  path: string,
  checkpoints: readonly Checkpoint[] = [],
  progress?: IProgress,
  contentSource: ContentSource = source,
) {
  const curriculum = createCurriculum(contentSource, {
    listCheckpoints: async () => checkpoints,
  });
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

/** A real IProgress with Module 1's Behavioral Checklist already submitted. */
async function passedProgress(): Promise<IProgress> {
  const progress = await createProgress();
  await progress.submitChecklist('m01', { q1: 'a', q2: 'b', q3: 'a' });
  return progress;
}

/** A GateStatus fixture for driving ExitGateAside states directly. */
function gateFixture(overrides: Partial<GateStatus> = {}): GateStatus {
  return {
    moduleId: 'm01',
    passed: false,
    checklistSubmittedAt: null,
    checkpointAt: null,
    ...overrides,
  };
}

const nextSummary: ModuleSummary = {
  id: 'm02',
  ordinal: 2,
  title: 'Dependency Direction',
  description: 'Point dependencies at stable abstractions.',
  pending: true,
  unlocked: true,
  checkpointAt: null,
};

describe('Module screen', () => {
  it('renders the Concept Page markdown as styled prose in the 66ch container', async () => {
    const { container } = await renderAt('/modules/m01');
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

  it('lifts the draft/edited/frozen note into the Concept Page label row (#30)', async () => {
    const { container } = await renderAt('/modules/m01');

    // Beside the h6 on one baseline (screens/02–03, prototype § Module) —
    // not as the first prose paragraph.
    const note = await screen.findByText(
      'LLM first draft · human-edited once · frozen',
    );
    expect(note).toHaveClass('module-concept-note');
    expect(note.closest('.module-concept-heading')).toBeInTheDocument();
    expect(
      container.querySelector('.module-concept')?.textContent ?? '',
    ).not.toContain('LLM first draft');
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

  it('deep-loads through the app routes identically', async () => {
    // Same entry the reloaded hash URL produces: App resolves /modules/m01.
    const curriculum = createCurriculum(source, {
      listCheckpoints: async () => [],
    });
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

  it('shows the header: kicker, 44px title, status tag, ghost back button (#12)', async () => {
    await renderAt('/modules/m01');

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
    await renderAt('/modules/m01', [
      { moduleId: 'm01', passedAt: '2026-06-12T09:41:00.000Z' },
    ]);

    expect(await screen.findByText('Exit Gate passed')).toHaveClass(
      'tag-accent',
    );
    expect(screen.queryByText('Ready to start')).not.toBeInTheDocument();
  });

  it('flips the header tag to the outline In progress while a draft exists (#30)', async () => {
    // The same rule as the Curriculum row (#18): a saved checklist draft is
    // the started state (screens/03-state.png, prototype statusFor).
    const progress = await createProgress();
    await progress.saveChecklistDraft('m01', { q1: 'a' });

    await renderAt('/modules/m01', [], progress);

    expect(await screen.findByText('In progress')).toHaveClass('tag-outline');
    expect(screen.queryByText('Ready to start')).not.toBeInTheDocument();
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

  // ── Pending Module (#28): Module 1 passed, Module 2 unlocked but its
  // content pack not authored — the placeholder state, never broken/blank.
  it('renders the pending placeholder blocks with the prototype copy (#28)', async () => {
    await renderAt('/modules/m02', [
      { moduleId: 'm01', passedAt: '2026-06-12T09:41:00.000Z' },
    ]);

    // Header stays fully real: kicker, title, neutral tag, ghost back.
    expect(await screen.findByText('Module 02')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Dependency Direction' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Ready to start')).toHaveClass('tag-neutral');
    expect(screen.getByRole('link', { name: 'Curriculum' })).toHaveClass(
      'btn-ghost',
    );

    // The three placeholder blocks, wording per the prototype's pending
    // section (design/DevGym.dc.html § Module).
    expect(
      screen.getByText(
        /Concept Page pending — drafted by the Generator once this Module unlocks; one human edit, then frozen\./,
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
    // Exercise, and no checklist form renders anywhere.
    expect(container.querySelector('.module-exercise-card')).toBeNull();
    const links = [...container.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/']);
    expect(container.querySelector('form, input, button[type="submit"]')).toBeNull();
  });

  it('shows the pending note in the aside — no condition row, no submit (#28)', async () => {
    const { container } = await renderAt('/modules/m02');
    await screen.findByText('Exit Gate');

    // Same 2px-bordered panel, but its only content is the pending note.
    const aside = container.querySelector('aside.module-aside');
    expect(aside?.querySelector('.module-gate-panel')).toBeInTheDocument();
    expect(
      screen.getByText(
        /The Behavioral Checklist arrives with the Concept Page — nothing to submit yet\./,
      ),
    ).toBeInTheDocument();

    // A checklist that does not exist yet cannot be invited: no condition
    // row, no unmet square, no submitted/not-submitted status, no poster.
    expect(aside?.querySelector('.module-gate-condition')).toBeNull();
    expect(aside?.querySelector('.module-gate-box')).toBeNull();
    expect(aside?.textContent).not.toMatch(/submitted/i);
    expect(aside?.querySelector('.module-gate-poster')).toBeNull();
  });

  it('uses no banned terms on the pending screen (#28)', async () => {
    const { container } = await renderAt('/modules/m02');
    await screen.findByText('Exit Gate');

    expect(container.textContent ?? '').not.toMatch(
      /lesson|course|level|quiz|flashcard|grade|score/i,
    );
  });

  it('falls back to the Curriculum for an unknown Module id', async () => {
    await renderAt('/modules/nope');

    expect(await screen.findByText('curriculum probe')).toBeInTheDocument();
  });

  it('shows the Exit Gate aside with exactly one unmet condition row (#13)', async () => {
    const { container } = await renderAt('/modules/m01');
    await screen.findByText('Exit Gate');

    // The sticky aside sits in the reserved 350px column (sticky offset via
    // .module-aside — tokens.json layout.asideStickyTop; CSS, not asserted).
    const aside = container.querySelector('aside.module-aside');
    expect(aside).toBeInTheDocument();
    expect(aside?.querySelector('.module-gate-panel')).toBeInTheDocument();

    // Exactly ONE condition row: the checklist. Nothing submitted yet, so
    // it renders unmet — the empty ink-outline square, no check icon.
    const rows = [...(aside?.querySelectorAll('.module-gate-condition') ?? [])];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain('Behavioral Checklist submitted');
    expect(rows[0]?.textContent).toContain('Not yet submitted');
    expect(rows[0]?.querySelector('.module-gate-box')).toBeInTheDocument();
    expect(rows[0]?.querySelector('svg')).not.toBeInTheDocument();
  });

  it('styles the met condition state (fixture: submitted but not passed)', () => {
    // Unreachable through IProgress — submitting IS passing — but the row's
    // met styling stays covered in case the gate ever gains a condition.
    const { container } = render(
      <ExitGateAside
        gate={gateFixture({ checklistSubmittedAt: '2026-08-12T09:41:00.000Z' })}
        nextModule={nextSummary}
      />,
    );

    const row = container.querySelector('.module-gate-condition');
    // The check icon replaces the empty square; the row text flips too.
    expect(row?.querySelector('svg.module-gate-check')).toBeInTheDocument();
    expect(row?.querySelector('.module-gate-box')).not.toBeInTheDocument();
    expect(row?.textContent).toContain('Behavioral Checklist submitted');
    expect(row?.textContent).toContain('Submitted');
    expect(row?.textContent).not.toContain('Not yet submitted');
  });

  it('shows the accent poster after Module 1’s checklist is submitted (#17)', async () => {
    const { container } = await renderAt(
      '/modules/m01',
      [],
      await passedProgress(),
    );
    await screen.findByText('Passed.');

    // The poster replaces the bordered condition panel entirely.
    const poster = container.querySelector('.module-gate-poster');
    expect(poster).toBeInTheDocument();
    expect(container.querySelector('.module-gate-panel')).not.toBeInTheDocument();
    expect(screen.queryByText('Not yet submitted')).not.toBeInTheDocument();

    // Bg-colored type on the accent field: the poster's own classes carry the
    // colors (app.css .module-gate-poster / -label / -passed), never ink.
    expect(poster?.querySelector('h6')).toHaveClass('module-gate-poster-label');
    expect(screen.getByText('Passed.')).toHaveClass('module-gate-passed');

    // The real Checkpoint date, in the Curriculum row format (12 Aug 2026).
    expect(screen.getByText(/^Checkpoint · \d{1,2} [A-Z][a-z]{2} \d{4}$/)).toHaveClass(
      'module-gate-checkpoint',
    );
    // The next Module is named by ordinal and title.
    expect(
      screen.getByText('Module 02 — Dependency Direction unlocked.'),
    ).toBeInTheDocument();

    // The header tag flips with the live gate, not the stubbed Checkpoint
    // seam (#18): accent Exit Gate passed, no banned terms anywhere.
    expect(screen.getByText('Exit Gate passed')).toHaveClass('tag-accent');
    expect(screen.queryByText('Ready to start')).not.toBeInTheDocument();
    expect(container.textContent ?? '').not.toMatch(
      /lesson|course|level|quiz|flashcard|grade|score/i,
    );
  });

  it('shows the Module 5 closing line when no Module follows (fixture)', () => {
    const { container } = render(
      <ExitGateAside
        gate={gateFixture({
          moduleId: 'm05',
          passed: true,
          checklistSubmittedAt: '2026-08-12T09:41:00.000Z',
          checkpointAt: '2026-08-12T09:41:00.000Z',
        })}
        nextModule={null}
      />,
    );

    expect(container.querySelector('.module-gate-poster')).toBeInTheDocument();
    expect(screen.getByText('Passed.')).toBeInTheDocument();
    expect(
      screen.getByText('All five Modules passed — the Curriculum is complete.'),
    ).toBeInTheDocument();
    // Nothing follows Module 5: no next-Module line.
    expect(container.textContent ?? '').not.toMatch(/unlocked\./);
  });

  it('renders the Checkpoint note; no schedule talk, no Test-Suites row (#3)', async () => {
    const { container } = await renderAt('/modules/m01');
    await screen.findByText('Exit Gate');

    expect(
      screen.getByText(/Checkpoint-based — advance when the gate is passed/),
    ).toBeInTheDocument();

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
});

/**
 * The repro from #69: online once (so the app shell is precached), offline
 * before this Module was ever read. The index is in the service worker cache
 * — the nav still counts Checkpoints — but the content JSON is not, so its
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
    const { container } = await renderAt('/modules/m01', [], undefined, offlineSource());

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
    // Nothing pretends the Module loaded: no header, no Exit Gate aside.
    expect(container.querySelector('.module-header')).not.toBeInTheDocument();
    expect(container.querySelector('.module-aside')).not.toBeInTheDocument();
  });

  it('keeps the Curriculum back link — never a dead end', async () => {
    await renderAt('/modules/m01', [], undefined, offlineSource());
    await screen.findByRole('alert');

    fireEvent.click(screen.getByRole('link', { name: 'Curriculum' }));

    expect(screen.getByText('curriculum probe')).toBeInTheDocument();
  });

  it('loads the Module on Try again once the fetch succeeds — no reload', async () => {
    await renderAt('/modules/m01', [], undefined, offlineSource(1));
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
      await screen.findByText(/Concept Page pending/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('still logs the failure for whoever is looking at the console', async () => {
    await renderAt('/modules/m01', [], undefined, offlineSource());
    await screen.findByRole('alert');

    expect(console.error).toHaveBeenCalledWith(
      'Failed to load Module m01',
      expect.any(TypeError),
    );
  });

  it('uses no banned terms (docs/ubiquitous-language.md § Banned)', async () => {
    const { container } = await renderAt('/modules/m01', [], undefined, offlineSource());
    await screen.findByRole('alert');

    expect(container.textContent ?? '').not.toMatch(
      /lesson|course|level|quiz|flashcard|grade|score/i,
    );
  });
});
