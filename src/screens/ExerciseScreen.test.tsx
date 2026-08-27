import { fireEvent, render, screen } from '@testing-library/react';
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
// real createProgress over fake-indexeddb still backs the render (#14's
// prescribed test environment), even though this screen neither reads nor
// writes it any more (#157).
const index: ModuleIndex = {
  schemaVersion: 2,
  categories: [
    { id: 'software-design', ordinal: 1, title: 'Software Design', description: 'Design fundamentals in C#.', language: 'csharp' },
  ],
  modules: [
    { id: 'm01', categoryId: 'software-design', ordinal: 1, title: 'Deep Modules & Information Hiding', description: 'Hide the most complexity behind the smallest surface.', pending: false },
    { id: 'm02', categoryId: 'software-design', ordinal: 2, title: 'Dependency Direction', description: 'Point dependencies at stable abstractions.', pending: false },
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
  selfCheckQuestions: [
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
  selfCheckQuestions: [
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
  const curriculum = createCurriculum(contentSource);
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

describe('Exercise screen', () => {
  it('has one h1 and no skipped heading levels (#75)', async () => {
    const { container } = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Practice material');

    // Three section labels at h2 — the aside's fourth went with the gated
    // model's questions (#157). "Practice material" is lower-case on
    // purpose and this assertion guards that: the other labels are domain
    // terms, it is not (#143, src/strings/en.ts).
    expect(expectWellFormedOutline(container)).toEqual([
      'h1 Deepen a shallow document store',
      'h2 Exercise Spec',
      'h2 Target Interface',
      'h2 Practice material',
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

  // #77: the tab names the brief, so a bookmark and a screen reader both
  // learn which Exercise this history entry is.
  it('names the tab `<exercise id> <title> · Kata`', async () => {
    // The brief arrives only when this is released, so the loading render is
    // observable rather than a race.
    let release = () => {};
    const arrived = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow: ContentSource = {
      loadIndex: async () => index,
      loadModuleContent: async (id) => {
        await arrived;
        return contentById[id] ?? null;
      },
    };
    document.title = 'Module 01 — Deep Modules & Information Hiding · Kata';

    await renderAt(
      '/modules/m01/exercises/m01-e1',
      undefined,
      undefined,
      slow,
    );

    // Nothing of the Module it came from survives into the loading render.
    expect(document.title).toBe('Kata');

    release();
    await screen.findByText('Exercise Spec');
    expect(document.title).toBe(
      'm01-e1 Deepen a shallow document store · Kata',
    );
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
    // Trimmed to the one instruction clause (#113): the `Immutable` tag
    // already says "don't touch it".
    expect(
      screen.getByText(/Wanting to change it is a signal to record and discuss/),
    ).toBeInTheDocument();
    const code = container.querySelector('pre.exercise-interface-code');
    expect(code?.textContent).toContain('public interface IDocumentStore');
    expect(code?.textContent).toContain(
      'void Save(string documentName, string contents);',
    );
  });

  it('keeps the whole screen display-only — no control of any kind (#3, #157)', async () => {
    const { container } = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Practice material');

    expect(container.querySelector('textarea')).not.toBeInTheDocument();
    expect(
      container.querySelector('[contenteditable]'),
    ).not.toBeInTheDocument();
    // The radio pairs moved to the Module screen's Self-Check (#157), so this
    // screen now carries no input and no button at all — only the two links.
    expect(container.querySelectorAll('input')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  // #136: the Target Interface definition — the first place the app says
  // what the term means, kept by clause (4) of the keeper test
  // (design/issue-guide.md § UI copy ban list, #133).
  it('defines the Target Interface under the heading, above the note (#136)', async () => {
    const { container } = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Target Interface');

    const definition = container.querySelector(
      '.exercise-interface-definition',
    );
    expect(definition?.textContent).toBe(
      'The Target Interface is the boundary you must end up with — the Test Suite is written against it, and you may not change it.',
    );

    // Heading, then definition, then the existing note, then the code.
    const heading = container.querySelector('.exercise-interface-heading');
    const note = container.querySelector('.exercise-interface-note');
    const code = container.querySelector('pre.exercise-interface-code');
    expect(definition?.compareDocumentPosition(heading as Node)).toBe(
      Node.DOCUMENT_POSITION_PRECEDING,
    );
    expect(definition?.compareDocumentPosition(note as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(definition?.compareDocumentPosition(code as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    // The `Immutable` tag and the note are both untouched.
    expect(screen.getByText('Immutable')).toHaveClass('tag-accent');
    expect(note?.textContent).toBe(
      'Wanting to change it is a signal to record and discuss — not an allowed move.',
    );

    // Static text only — no link, no disclosure, so no second way to reach
    // anything (the interaction-depth question, design/issue-guide.md).
    expect(definition?.querySelector('a, button, details, [role]')).toBeNull();
    // Always the full term, never "interface" alone (ground rule 1).
    expect(definition?.textContent).not.toMatch(/(?<!Target )\binterface\b/i);
  });

  it('leaves the Target Interface code display-only with the definition above it (#136)', async () => {
    const { container } = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Target Interface');

    // The definition is prose beside the block, never inside it: the C# stays
    // a <pre>, never a textarea, never editable.
    const code = container.querySelector('.exercise-interface-code');
    expect(code?.tagName).toBe('PRE');
    expect(code?.textContent).toContain('public interface IDocumentStore');
    expect(
      code?.querySelector('.exercise-interface-definition'),
    ).toBeNull();
    expect(container.querySelector('textarea')).not.toBeInTheDocument();
    expect(
      container.querySelector('[contenteditable]'),
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

  it('states the .NET SDK prerequisite and the tests/ working directory (#141)', async () => {
    const { container } = await renderAt('/modules/m01/exercises/m01-e2');
    await screen.findByText('Practice material');

    const note = container.querySelector('.exercise-folder-note');
    const text = note?.textContent ?? '';

    // The two facts that decide whether the Test Suite runs at all, both
    // readable BEFORE cloning.
    expect(text).toContain('.NET SDK installed on your own machine');
    expect(text).toContain("Exercise folder's tests/ directory");
    // The instruction the note already carried survives the extension.
    expect(text).toContain('Clone or copy the folder');
    expect(text).toContain('review its Test Suite before starting');

    // Still one inline <code>, still the command itself — no terminal, no
    // copy control, no results area: Kata never runs anything.
    const codes = note?.querySelectorAll('code') ?? [];
    expect(codes).toHaveLength(1);
    expect(codes[0]?.textContent).toBe('dotnet test');
    expect(
      note?.closest('section')?.querySelector('button, textarea'),
    ).toBeFalsy();
  });

  it('keeps the prerequisite copy out of the pending state (#141)', async () => {
    const { container } = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Practice material');

    // folderUrl === null renders the pending note ALONE — no link, no
    // <code>, and none of the committed-folder instructions.
    expect(screen.getByText(/folder is not committed yet/)).toBeInTheDocument();
    expect(container.querySelector('.exercise-folder-note')).toBeNull();
    expect(screen.queryByText(/\.NET SDK/)).not.toBeInTheDocument();
    expect(screen.queryByText(/tests\/ directory/)).not.toBeInTheDocument();
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
    const curriculum = createCurriculum(source);
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

  // #157: the aside is gone — the gate banner with it, and the questions with
  // it. There is no state this screen can be in that renders either.
  it('renders no gate banner and no aside in any state', async () => {
    const progress = await createProgress();
    // The strongest state the old screen had: every question answered for
    // this Module.
    await progress.saveSelfCheckAnswers('m01', { q1: 'a', q2: 'a', q3: 'a' });

    const { container } = await renderAt(
      '/modules/m01/exercises/m01-e1',
      progress,
    );
    await screen.findByText('Practice material');

    expect(container.querySelector('aside')).toBeNull();
    expect(container.querySelector('.exercise-gate-banner')).toBeNull();
    expect(container.textContent ?? '').not.toMatch(
      /exit gate|checkpoint|passed|unlocked/i,
    );
  });

  it('carries none of the Module\'s questions — the Self-Check is one place (#157)', async () => {
    const { container } = await renderAt('/modules/m01/exercises/m01-e2');
    await screen.findByText('Practice material');

    // The interaction-depth question (design/issue-guide.md): the Self-Check
    // is reachable from the Module screen and nowhere else.
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryAllByRole('radiogroup')).toHaveLength(0);
    expect(container.querySelector('.self-check')).toBeNull();
    for (const prompt of ['p1', 'p2', 'p3']) {
      expect(screen.queryByText(prompt)).not.toBeInTheDocument();
    }
  });

  it('names no removed term anywhere on the screen (#157)', async () => {
    const { container } = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Practice material');

    // docs/ubiquitous-language.md § Removed terms + the vocabulary ban.
    expect(container.textContent ?? '').not.toMatch(
      /exit gate|behavioral checklist|checkpoint|unlock|locked|\bgate\b|submit/i,
    );
  });

  it('uses no banned terms (docs/ubiquitous-language.md § Banned)', async () => {
    const { container } = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Practice material');

    const text = container.textContent ?? '';
    expect(text).not.toMatch(/lesson|course|level|quiz|flashcard|grade|score/i);
  });

  // design/issue-guide.md § UI copy ban list (#115) — the writing-style list,
  // separate from the domain vocabulary above. The Target Interface
  // definition (#136) is the prose this screen carries, so it asserts
  // against the list here.
  it('uses no word from the UI copy ban list (#115)', async () => {
    const { container } = await renderAt('/modules/m01/exercises/m01-e1');
    await screen.findByText('Practice material');

    const text = container.textContent ?? '';
    expect(text).not.toMatch(
      /streak|daily goal|days left|% complete|\bXP\b|\bjust\b|\bsimply\b|\beasy\b/i,
    );
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

  it('is a screen with an outline: the notice title is the h1 (#94)', async () => {
    const { container } = await renderAt(
      '/modules/m01/exercises/m01-e1',
      undefined,
      undefined,
      offlineSource(),
    );
    await screen.findByRole('alert');

    // Same surface, same rule as the Module screen's failure state.
    expect(expectWellFormedOutline(container)).toEqual([
      "h1 This Module's content is not available",
    ]);
    expect(container.querySelector('h1')).toHaveClass('app-notice-title');
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
