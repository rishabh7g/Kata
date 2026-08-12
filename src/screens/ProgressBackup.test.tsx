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
// must visibly move the rows' lock chain, not just the stores.
const index: ModuleIndex = {
  schemaVersion: 1,
  modules: [
    { id: 'm01', ordinal: 1, title: 'Deep Modules & Information Hiding', description: 'Hide the most complexity behind the smallest surface.', pending: false },
    { id: 'm02', ordinal: 2, title: 'Dependency Direction', description: 'Point dependencies at stable abstractions.', pending: true },
    { id: 'm03', ordinal: 3, title: 'Testing at Boundaries + TDD loop', description: 'Test the Target Interface, not the internals.', pending: true },
    { id: 'm04', ordinal: 4, title: 'Naming & Ubiquitous Language', description: 'Names drawn from the Ubiquitous Language.', pending: true },
    { id: 'm05', ordinal: 5, title: 'Error Design', description: 'Define errors out of existence.', pending: true },
  ],
};

const source: ContentSource = {
  loadIndex: async () => index,
  loadModuleContent: async () => null,
};

// A backup of a learner who passed Module 1 — the issue's round-trip fixture.
const m01Passed: ProgressState = {
  schemaVersion: 1,
  checkpoints: [{ moduleId: 'm01', passedAt: '2026-06-12T09:41:00.000Z' }],
  submittedChecklists: [
    {
      moduleId: 'm01',
      answers: { q1: 'yes', q2: 'no', q3: 'yes' },
      submittedAt: '2026-06-12T09:41:00.000Z',
    },
  ],
  checklistDrafts: [],
};

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderScreen(initial?: ProgressState): Promise<IProgress> {
  const progress = await createProgress();
  if (initial) await progress.importState(initial);
  const curriculum = createCurriculum(source, progress);
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
    const progress = await renderScreen(m01Passed);
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
    const progress = await renderScreen(); // fresh profile, nothing passed
    expect(screen.queryByText('Exit Gate passed')).not.toBeInTheDocument();

    pickFile(serializeProgressState(m01Passed));

    // The confirm step always appears before any overwrite.
    const summary = await screen.findByText(
      '1 Checkpoint, 1 checklist — replace current progress?',
    );
    expect(summary).toBeInTheDocument();
    expect(await progress.exportState()).toEqual({
      schemaVersion: 1,
      checkpoints: [],
      submittedChecklists: [],
      checklistDrafts: [],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Replace progress' }));

    // Lossless round-trip into the stores…
    await waitFor(async () => {
      expect(await progress.exportState()).toEqual(m01Passed);
    });
    // …and visible without a reload: row 01 passed with the Checkpoint's own
    // date, and the lock chain unlocks row 02.
    expect(await screen.findByText('Exit Gate passed')).toBeInTheDocument();
    expect(screen.getByText('Checkpoint · 12 Jun 2026')).toBeInTheDocument();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/modules/m01', '/modules/m02']);
  });

  it('cancel leaves current progress untouched', async () => {
    const progress = await renderScreen(m01Passed);
    const before = await progress.exportState();

    pickFile(
      serializeProgressState({
        schemaVersion: 1,
        checkpoints: [],
        submittedChecklists: [],
        checklistDrafts: [],
      }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(
      screen.queryByText(/replace current progress\?/),
    ).not.toBeInTheDocument();
    expect(await progress.exportState()).toEqual(before);
    expect(screen.getByText('Exit Gate passed')).toBeInTheDocument();
  });

  it('a garbage file shows a clear error and changes nothing', async () => {
    const progress = await renderScreen(m01Passed);
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
    expect(await progress.exportState()).toEqual({
      schemaVersion: 1,
      checkpoints: [],
      submittedChecklists: [],
      checklistDrafts: [],
    });
  });

  // #76: this file used to import, and the row then read `Checkpoint ·
  // Invalid Date`. The parse names the bad field, and nothing is written.
  it('an unparseable Checkpoint date is rejected before the confirm', async () => {
    const progress = await renderScreen();

    pickFile(
      '{"schemaVersion":1,"checkpoints":[{"moduleId":"m01","passedAt":"banana"}],"submittedChecklists":[],"checklistDrafts":[]}',
    );

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(
      "Not a Kata progress file — checkpoints[0]: 'passedAt' is not an ISO date. Current progress is unchanged.",
    );
    expect(
      screen.queryByText(/replace current progress\?/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
    expect(await progress.exportState()).toEqual({
      schemaVersion: 1,
      checkpoints: [],
      submittedChecklists: [],
      checklistDrafts: [],
    });
  });

  it('a rejected pick clears once a valid file is picked after it', async () => {
    await renderScreen();

    pickFile('nope');
    await screen.findByRole('alert');

    pickFile(serializeProgressState(m01Passed));
    await screen.findByText('1 Checkpoint, 1 checklist — replace current progress?');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Progress backup — copy', () => {
  it('uses no banned terms (docs/ubiquitous-language.md § Banned)', async () => {
    await renderScreen();

    const footer = document.querySelector('.curriculum-backup');
    const text = footer?.textContent ?? '';
    expect(text).not.toBe('');
    expect(text).not.toMatch(/lesson|course|level|quiz|flashcard|grade|score/i);
  });
});
