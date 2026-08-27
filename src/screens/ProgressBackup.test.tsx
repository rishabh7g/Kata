import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CurriculumProvider } from '../app/CurriculumContext';
import { ProgressProvider } from '../app/ProgressContext';
import type { ContentSource, ModuleIndex } from '../curriculum';
import { createCurriculum } from '../curriculum';
import type { IProgress, ProgressState } from '../progress';
import { createProgress, serializeProgressState } from '../progress';
import { CurriculumScreen } from './CurriculumScreen';

// The backup footer lives on the Curriculum screen, so the fixture is the
// same full wiring as CurriculumScreen.test.tsx: real createProgress over
// fake-indexeddb, real createCurriculum over an in-memory index — the import
// must visibly move the rows, not just the store. Since #156 the rows show
// one thing about the reader, the outline `In progress` tag over saved
// Self-Check answers, so that tag is what a landed import is read by.
const index: ModuleIndex = {
  schemaVersion: 2,
  categories: [
    { id: 'software-design', ordinal: 1, title: 'Software Design', description: 'Design fundamentals in C#.', language: 'csharp' },
  ],
  modules: [
    { id: 'm01', categoryId: 'software-design', ordinal: 1, title: 'Deep Modules & Information Hiding', description: 'Hide the most complexity behind the smallest surface.', pending: false },
    { id: 'm02', categoryId: 'software-design', ordinal: 2, title: 'Dependency Direction', description: 'Point dependencies at stable abstractions.', pending: true },
    { id: 'm03', categoryId: 'software-design', ordinal: 3, title: 'Testing at Boundaries + TDD loop', description: 'Test the Target Interface, not the internals.', pending: true },
    { id: 'm04', categoryId: 'software-design', ordinal: 4, title: 'Naming & Ubiquitous Language', description: 'Names drawn from the Ubiquitous Language.', pending: true },
    { id: 'm05', categoryId: 'software-design', ordinal: 5, title: 'Error Design', description: 'Define errors out of existence.', pending: true },
  ],
};

const source: ContentSource = {
  loadIndex: async () => index,
  loadModuleContent: async () => null,
};

// A backup of a reader partway through — the issue's round-trip fixture. A
// v2 file holds one thing: the reader's Self-Check answers, per Module
// (#159), and those answers are what the rows render (#156).
const savedProgress: ProgressState = {
  schemaVersion: 2,
  selfCheckAnswers: [
    { moduleId: 'm02', answers: { q1: 'a' }, savedAt: '2026-06-13T10:00:00.000Z' },
  ],
};

/** The fresh-profile export, the "changed nothing" comparison value. */
const EMPTY: ProgressState = { schemaVersion: 2, selfCheckAnswers: [] };

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderScreen(initial?: ProgressState): Promise<IProgress> {
  const progress = await createProgress();
  if (initial) await progress.importState(initial);
  const curriculum = createCurriculum(source);
  render(
    <CurriculumProvider curriculum={curriculum}>
      <ProgressProvider progress={progress}>
        <MemoryRouter>
          <Routes>
            <Route path="/" element={<CurriculumScreen />} />
          </Routes>
        </MemoryRouter>
      </ProgressProvider>
    </CurriculumProvider>,
  );
  await screen.findByText('01');
  return progress;
}

function pickFile(text: string, name = 'kata-progress.json') {
  const input = screen.getByLabelText('Progress file');
  const file = new File([text], name, { type: 'application/json' });
  fireEvent.change(input, { target: { files: [file] } });
}

describe('Progress backup — export', () => {
  it('downloads kata-progress.json holding exactly exportState', async () => {
    const progress = await renderScreen(savedProgress);
    let exported: Blob | null = null;
    let download = '';
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn((blob: Blob) => {
        exported = blob;
        return 'blob:kata-progress';
      }),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      function (this: HTMLAnchorElement) {
        download = this.download;
      },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Export progress' }));

    await waitFor(() => expect(exported).not.toBeNull());
    expect(download).toBe('kata-progress.json');
    // The file is the export, verbatim — only the documented fields.
    const written = await (exported as unknown as Blob).text();
    expect(written).toBe(serializeProgressState(await progress.exportState()));
    vi.unstubAllGlobals();
  });
});

describe('Progress backup — import', () => {
  it('confirm summary, then replace: the imported state shows on the rows', async () => {
    const progress = await renderScreen(); // fresh profile, nothing saved
    expect(screen.queryByText('In progress')).not.toBeInTheDocument();

    pickFile(serializeProgressState(savedProgress));

    // The confirm step always appears before any overwrite.
    const summary = await screen.findByText(
      '1 Self-Check — replace current progress?',
    );
    expect(summary).toBeInTheDocument();
    expect(await progress.exportState()).toEqual(EMPTY);

    fireEvent.click(screen.getByRole('button', { name: 'Replace progress' }));

    // Lossless round-trip into the stores…
    await waitFor(async () => {
      expect(await progress.exportState()).toEqual(savedProgress);
    });
    // …and visible without a reload: row 02 picks up the imported answers'
    // outline tag. Every row was a link before the import and still is — the
    // Library never opens or closes one (#156).
    expect(await screen.findByText('In progress')).toBeInTheDocument();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      '/modules/m01',
      '/modules/m02',
      '/modules/m03',
      '/modules/m04',
      '/modules/m05',
    ]);
  });

  it('cancel leaves current progress untouched', async () => {
    const progress = await renderScreen(savedProgress);
    const before = await progress.exportState();

    pickFile(serializeProgressState(EMPTY));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(
      screen.queryByText(/replace current progress\?/),
    ).not.toBeInTheDocument();
    expect(await progress.exportState()).toEqual(before);
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  it('a garbage file shows a clear error and changes nothing', async () => {
    const progress = await renderScreen(savedProgress);
    const before = await progress.exportState();

    pickFile('this is not json', 'garbage.json');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Not a Kata progress file/);
    expect(alert.textContent).toMatch(/unchanged/);
    expect(
      screen.queryByText(/replace current progress\?/),
    ).not.toBeInTheDocument();
    expect(await progress.exportState()).toEqual(before);
  });

  it('foreign JSON (valid JSON, wrong shape) is rejected the same way', async () => {
    const progress = await renderScreen();

    pickFile('{"name":"Kata","version":3}');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Not a Kata progress file/);
    expect(await progress.exportState()).toEqual(EMPTY);
  });

  // The gated model's export (#159): the same file name, a shape the Library
  // has no store for. The unknown-schemaVersion path rejects it like any
  // other foreign JSON, and nothing is written.
  it('a v1 file is rejected with the schema-version reason', async () => {
    const progress = await renderScreen(savedProgress);
    const before = await progress.exportState();

    pickFile(
      '{"schemaVersion":1,"checkpoints":[],"submittedChecklists":[],"checklistDrafts":[]}',
    );

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(
      'Not a Kata progress file — unknown schemaVersion 1 (expected 2). Current progress is unchanged.',
    );
    expect(
      screen.queryByText(/replace current progress\?/),
    ).not.toBeInTheDocument();
    expect(await progress.exportState()).toEqual(before);
  });

  // #76: this file used to import, and the row then read an `Invalid Date`.
  // The parse names the bad field, and nothing is written.
  it('an unparseable saved-at date is rejected before the confirm', async () => {
    const progress = await renderScreen();

    pickFile(
      '{"schemaVersion":2,"selfCheckAnswers":[{"moduleId":"m01","answers":{},"savedAt":"banana"}]}',
    );

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(
      "Not a Kata progress file — selfCheckAnswers[0]: 'savedAt' is not an ISO date. Current progress is unchanged.",
    );
    expect(
      screen.queryByText(/replace current progress\?/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
    expect(await progress.exportState()).toEqual(EMPTY);
  });

  it('a rejected pick clears once a valid file is picked after it', async () => {
    await renderScreen();

    pickFile('nope');
    await screen.findByRole('alert');

    pickFile(serializeProgressState(savedProgress));
    await screen.findByText('1 Self-Check — replace current progress?');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// #78: the confirm claimed role="alertdialog" while behaving like a
// paragraph — no focus, no Escape, no way back to where you were.
describe('Progress backup — the confirm is the dialog it claims to be', () => {
  function importButton() {
    return screen.getByRole('button', { name: 'Import progress' });
  }

  function confirmDialog() {
    return screen.getByRole('alertdialog', { name: 'Confirm import' });
  }

  it('moves focus into the confirm as it opens, with the summary as its description', async () => {
    await renderScreen();
    importButton().focus();

    pickFile(serializeProgressState(savedProgress));

    const dialog = await screen.findByRole('alertdialog', {
      name: 'Confirm import',
    });
    await waitFor(() => expect(dialog).toHaveFocus());
    // The question being asked is read out with the dialog's own name.
    const describedBy = dialog.getAttribute('aria-describedby');
    expect(document.getElementById(describedBy ?? '')?.textContent).toBe(
      '1 Self-Check — replace current progress?',
    );
  });

  it('Escape cancels: nothing is written and focus is back on Import progress', async () => {
    const progress = await renderScreen();
    const before = await progress.exportState();
    importButton().focus();
    pickFile(serializeProgressState(savedProgress));
    await waitFor(() => expect(confirmDialog()).toHaveFocus());

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() =>
      expect(
        screen.queryByRole('alertdialog', { name: 'Confirm import' }),
      ).not.toBeInTheDocument(),
    );
    expect(importButton()).toHaveFocus();
    expect(await progress.exportState()).toEqual(before);
    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
  });

  it('Cancel does the same — dismissed, unchanged, focus returned', async () => {
    const progress = await renderScreen();
    const before = await progress.exportState();
    pickFile(serializeProgressState(savedProgress));
    await screen.findByRole('alertdialog', { name: 'Confirm import' });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(
      screen.queryByRole('alertdialog', { name: 'Confirm import' }),
    ).not.toBeInTheDocument();
    expect(importButton()).toHaveFocus();
    expect(await progress.exportState()).toEqual(before);
  });

  it('Escape does nothing once no confirm is open', async () => {
    const progress = await renderScreen(savedProgress);
    const before = await progress.exportState();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(await progress.exportState()).toEqual(before);
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  it('Replace imports, then says so and hands focus back — never to <body>', async () => {
    const progress = await renderScreen();
    pickFile(serializeProgressState(savedProgress));
    await screen.findByRole('alertdialog', { name: 'Confirm import' });

    fireEvent.click(screen.getByRole('button', { name: 'Replace progress' }));

    // The import itself, and the re-navigation that re-reads the rows.
    await waitFor(async () => {
      expect(await progress.exportState()).toEqual(savedProgress);
    });
    expect(await screen.findByText('In progress')).toBeInTheDocument();
    // The button that opened the confirm is where focus lands, and the live
    // region is what says the replace happened (#73's announcer).
    await waitFor(() => expect(importButton()).toHaveFocus());
    expect(screen.getByRole('status').textContent).toBe(
      'Progress replaced — 1 Self-Check imported.',
    );
  });

  it('says nothing on load — the live region only announces what arrives', async () => {
    await renderScreen(savedProgress);

    expect(screen.getByRole('status').textContent).toBe('');
  });
});

describe('Progress backup — copy', () => {
  function noteText(): string {
    return document.querySelector('.curriculum-backup-note')?.textContent ?? '';
  }

  it('uses no banned terms (docs/ubiquitous-language.md § Banned)', async () => {
    await renderScreen();

    const footer = document.querySelector('.curriculum-backup');
    const text = footer?.textContent ?? '';
    expect(text).not.toBe('');
    expect(text).not.toMatch(/lesson|course|level|quiz|flashcard|grade|score/i);
  });

  // design/issue-guide.md § UI copy ban list (#115) — the writing-style list,
  // asserted on the footer now that the note carries a second sentence (#142).
  it('uses no word from the UI copy ban list (#115)', async () => {
    await renderScreen();

    const text = document.querySelector('.curriculum-backup')?.textContent ?? '';
    expect(text).not.toMatch(
      /streak|daily goal|days left|% complete|\bXP\b|\bjust\b|\bsimply\b|\beasy\b/i,
    );
  });

  // #142: a no-accounts app that never says where progress lives costs the
  // learner everything the first time they clear site data. The note names
  // the file, says what the file is FOR, and still guards the import.
  it('the idle note names the export file, why it matters, and what import does', async () => {
    await renderScreen();

    expect(noteText()).toBe(NOTE);
  });

  // The header's orientation block already states the fact on this same
  // screen (curriculum.orientation.browserOnly, #134). The footer carries the
  // consequence instead, so the screen says it once and acts on it once.
  it('does not restate the header orientation line', async () => {
    await renderScreen();

    expect(
      screen.getByText('Your progress is stored in this browser only.'),
    ).toBeInTheDocument();
    expect(noteText()).not.toMatch(/stored in this browser only/i);
  });

  // Empty IndexedDB and a full one read the same: the note carries no counts,
  // only the confirm does.
  it('reads the same with progress stored as with none', async () => {
    await renderScreen(savedProgress);

    expect(noteText()).toBe(NOTE);
    expect(noteText()).not.toMatch(/\d/);
  });

  // Clause (3) guards the destructive action, and the guard is one question.
  // The browser-only consequence is not repeated inside the confirm.
  it('the confirm asks its one question and adds no second warning', async () => {
    await renderScreen();

    pickFile(serializeProgressState(savedProgress));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toBe(
      '1 Self-Check — replace current progress?Replace progressCancel',
    );
    expect(noteText()).toMatch(/only copy of your progress/);
  });

  // The error states own the "nothing changed" reassurance; the note beside
  // them keeps saying what the file is for, unchanged by the failure.
  it('stays put through the invalid-file state', async () => {
    await renderScreen();

    pickFile('this is not json', 'garbage.json');

    expect((await screen.findByRole('alert')).textContent).toMatch(
      /Not a Kata progress file/,
    );
    expect(noteText()).toBe(NOTE);
  });

  it('stays put through a failed import', async () => {
    const progress = await renderScreen();
    vi.spyOn(progress, 'importState').mockRejectedValue(
      new Error('quota exceeded'),
    );

    pickFile(serializeProgressState(savedProgress));
    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByRole('button', { name: 'Replace progress' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Import failed — quota exceeded. Current progress is unchanged.',
    );
    expect(noteText()).toBe(NOTE);
  });
});

/** The footer's whole note, with {fileName} filled in — no counts, ever. */
const NOTE =
  'kata-progress.json is the only copy of your progress that exists outside this browser. ' +
  "Import replaces current progress with a file's contents.";
