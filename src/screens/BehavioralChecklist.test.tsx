import { fireEvent, render, screen, within } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProgressProvider } from '../app/ProgressContext';
import type { ChecklistQuestion } from '../curriculum';
import type { IProgress } from '../progress';
import { createProgress } from '../progress';
import { BehavioralChecklist } from './BehavioralChecklist';

// The panel on its own, over the real createProgress against fake-indexeddb
// (#14's prescribed test environment) — the Exercise screen's own wiring is
// covered by ExerciseScreen.test.tsx. Prompts here are the real shape: one
// long sentence ending in a question, two opposed options.
const questions: readonly ChecklistQuestion[] = [
  {
    id: 'q1',
    prompt:
      'Count everything a caller must know to use your module. Is the count 3 or fewer?',
    options: [
      { value: 'yes', label: 'Yes — 3 or fewer' },
      { value: 'no', label: 'No — more than 3' },
    ],
  },
  {
    id: 'q2',
    prompt: 'Grep your callers for leaked decisions. Did the search come back empty?',
    options: [
      { value: 'yes', label: 'Yes — nothing leaked into callers' },
      { value: 'no', label: 'No — at least one hit' },
    ],
  },
  {
    id: 'q3',
    prompt: 'Change one hidden decision. Did every caller compile untouched?',
    options: [
      { value: 'yes', label: 'Yes — no caller changed' },
      { value: 'no', label: 'No — at least one caller had to change' },
    ],
  },
];

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

async function renderChecklist() {
  const progress = await createProgress();
  const utils = render(
    <ProgressProvider progress={progress}>
      <BehavioralChecklist
        moduleId="m01"
        moduleOrdinal={1}
        questions={questions}
      />
    </ProgressProvider>,
  );
  // The panel loads its stored state before it renders anything.
  await screen.findByRole('button', { name: 'Submit Behavioral Checklist' });
  return { ...utils, progress };
}

describe('Behavioral Checklist radio grouping (#72)', () => {
  it('names each check its own group, so an option is never announced alone', async () => {
    await renderChecklist();

    // One group per check, in the authored order …
    expect(screen.getAllByRole('radiogroup')).toHaveLength(3);
    // … and each group's accessible name IS its prompt — the point of #72.
    for (const question of questions) {
      expect(
        screen.getByRole('radiogroup', { name: question.prompt }),
      ).toBeInTheDocument();
    }
  });

  it("puts exactly that check's two options inside its group", async () => {
    await renderChecklist();

    for (const question of questions) {
      const group = screen.getByRole('radiogroup', { name: question.prompt });
      const options = within(group).getAllByRole('radio');
      expect(options.map((option) => option.getAttribute('value'))).toEqual([
        'yes',
        'no',
      ]);
      // Each radio's own accessible name stays its option label, so a
      // screen reader says "<prompt>, group, <label>, 1 of 2".
      expect(
        options.map((option) =>
          within(group).getByRole('radio', {
            name: question.options.find((o) => o.value === option.getAttribute('value'))!.label,
          }),
        ),
      ).toHaveLength(2);
    }
  });

  it('leaves no radio outside a group', async () => {
    const { container } = await renderChecklist();

    const all = screen.getAllByRole('radio');
    expect(all).toHaveLength(6);
    for (const radio of all) {
      expect(radio.closest('[role="radiogroup"]')).not.toBeNull();
    }
    expect(container.querySelectorAll('[role="radiogroup"]')).toHaveLength(3);
  });

  it('labels the group with the visible prompt element, not a duplicate string', async () => {
    const { container } = await renderChecklist();

    const items = [...container.querySelectorAll('.exercise-checklist-item')];
    expect(items).toHaveLength(3);
    for (const [index, item] of items.entries()) {
      const prompt = item.querySelector('.exercise-checklist-prompt');
      const group = item.querySelector('[role="radiogroup"]');
      expect(prompt?.textContent).toBe(questions[index]!.prompt);
      expect(prompt?.id).toBeTruthy();
      expect(group?.getAttribute('aria-labelledby')).toBe(prompt?.id);
      // The prompt stays the same visible div in the same place: the layout
      // of design/screens/05-state.png is unchanged.
      expect(prompt?.tagName).toBe('DIV');
      expect(group).toHaveClass('exercise-checklist-options');
    }
  });

  it('keeps one tab stop and one arrow-key ring per check: a shared name per pair, unique across checks', async () => {
    await renderChecklist();

    const namesPerGroup = questions.map((question) => {
      const group = screen.getByRole('radiogroup', { name: question.prompt });
      return [
        ...new Set(
          within(group)
            .getAllByRole('radio')
            .map((radio) => radio.getAttribute('name')),
        ),
      ];
    });
    // One name inside a pair (arrow keys move within the check), and three
    // distinct names across the checks (Tab reaches each check once).
    expect(namesPerGroup.map((names) => names.length)).toEqual([1, 1, 1]);
    expect(new Set(namesPerGroup.flat()).size).toBe(3);
  });

  it('keeps the .radio markup the focus ring hangs off', async () => {
    const { container } = await renderChecklist();

    for (const label of container.querySelectorAll('label.radio')) {
      // `.radio input:focus-visible + .dot` — the input must stay the dot's
      // immediate previous sibling or the 2px accent ring disappears.
      const input = label.querySelector('input[type="radio"]');
      expect(input?.nextElementSibling).toHaveClass('dot');
    }
  });

  it('still submits, and the read-only panel keeps its plain question/answer rows', async () => {
    const { container } = await renderChecklist();

    for (const question of questions) {
      const group = screen.getByRole('radiogroup', { name: question.prompt });
      fireEvent.click(within(group).getAllByRole('radio')[0]!);
    }
    fireEvent.click(
      screen.getByRole('button', { name: 'Submit Behavioral Checklist' }),
    );

    expect(await screen.findByText(/Submitted ·/)).toBeInTheDocument();
    // Nothing grouped survives into the submitted state — it has no controls.
    expect(container.querySelectorAll('[role="radiogroup"]')).toHaveLength(0);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    const rows = [...container.querySelectorAll('.exercise-checklist-row')];
    expect(
      rows.map((row) => [
        row.querySelector('.exercise-checklist-row-question')?.textContent,
        row.querySelector('.exercise-checklist-row-answer')?.textContent,
      ]),
    ).toEqual([
      [questions[0]!.prompt, 'Yes — 3 or fewer'],
      [questions[1]!.prompt, 'Yes — nothing leaked into callers'],
      [questions[2]!.prompt, 'Yes — no caller changed'],
    ]);
  });
});

/**
 * The panel's own definition (#136) — one clause under the heading, and which
 * panel states carry it. The Exercise screen's placement is covered in
 * ExerciseScreen.test.tsx; this is the state matrix at the component level.
 */
describe('the Behavioral Checklist definition (#136)', () => {
  const DEFINITION =
    "The Behavioral Checklist is the Module's one Exit Gate condition, self-assessed.";

  /** The panel with whatever question set a state needs, un-awaited. */
  function renderWith(questionSet: readonly ChecklistQuestion[], progress: IProgress) {
    return render(
      <ProgressProvider progress={progress}>
        <BehavioralChecklist
          moduleId="m01"
          moduleOrdinal={1}
          questions={questionSet}
        />
      </ProgressProvider>,
    );
  }

  it('states what the checklist is, once, in the form state', async () => {
    const { container } = await renderChecklist();

    const definitions = container.querySelectorAll(
      '.exercise-checklist-definition',
    );
    expect(definitions).toHaveLength(1);
    expect(definitions[0]?.textContent).toBe(DEFINITION);
    // One clause: a single sentence, no second full stop.
    expect(DEFINITION.match(/\./g)).toHaveLength(1);
  });

  it('renders nothing at all while the stored state is still loading', async () => {
    const progress = await createProgress();
    const { container } = renderWith(questions, progress);

    // The load has not resolved yet: no panel, so no definition to flash
    // before the state is known.
    expect(container.textContent).toBe('');
    expect(
      container.querySelector('.exercise-checklist-definition'),
    ).toBeNull();

    await screen.findByRole('button', { name: 'Submit Behavioral Checklist' });
    expect(
      container.querySelector('.exercise-checklist-definition'),
    ).not.toBeNull();
  });

  it('renders nothing for a pending Module — no questions, no definition', async () => {
    const progress = await createProgress();
    const { container } = renderWith([], progress);

    await Promise.resolve();
    expect(container.textContent).toBe('');
    expect(
      container.querySelector('.exercise-checklist-definition'),
    ).toBeNull();
  });

  it('drops the definition on the submitted panel', async () => {
    const { container } = await renderChecklist();

    for (const question of questions) {
      const group = screen.getByRole('radiogroup', { name: question.prompt });
      fireEvent.click(within(group).getAllByRole('radio')[0]!);
    }
    fireEvent.click(
      screen.getByRole('button', { name: 'Submit Behavioral Checklist' }),
    );
    await screen.findByText(/Submitted ·/);

    expect(
      container.querySelector('.exercise-checklist-definition'),
    ).toBeNull();
    expect(container.textContent).not.toContain(DEFINITION);
  });
});

/**
 * What submitting does, and what a "No" means (#137) — the panel's note, and
 * the behaviour it now describes.
 *
 * The note is the only instruction on the step (keeper test clause 2). It is
 * also the only place the app says the gate is self-reported: no answer value
 * is a condition anywhere, so "No" three times still passes. These tests pin
 * the copy AND that behaviour together — if a later change ever made an
 * answer block submission, the last two would fail and the note would be a
 * lie.
 */
describe('the Behavioral Checklist note (#137)', () => {
  const NOTE =
    'Answer all three checks to submit, and answer them honestly — this is a self-report on your own work. Submitting records the Checkpoint whatever you answer, so a "No" is a signal to go back to the code, not a blocker.';

  /** Picks the option at `optionIndex` in every check, in order. */
  function answerAll(optionIndex: number) {
    for (const question of questions) {
      const group = screen.getByRole('radiogroup', { name: question.prompt });
      fireEvent.click(within(group).getAllByRole('radio')[optionIndex]!);
    }
  }

  it('says what submitting does and what a "No" means, under the submit button', async () => {
    const { container } = await renderChecklist();

    const notes = container.querySelectorAll('.exercise-checklist-note');
    expect(notes).toHaveLength(1);
    expect(notes[0]?.textContent).toBe(NOTE);

    // Still the instruction it has always been …
    expect(NOTE).toContain('Answer all three checks to submit');
    // … plus the three things #137 adds: honest self-report, the Checkpoint
    // is recorded whatever the answers are, and "No" sends you back to the
    // code rather than blocking you.
    expect(NOTE).toContain('answer them honestly');
    expect(NOTE).toContain('self-report');
    expect(NOTE).toContain('Submitting records the Checkpoint whatever you answer');
    expect(NOTE).toContain('a "No" is a signal to go back to the code, not a blocker');

    // Below the one primary action, so it is read with the decision to
    // submit and not before the checks (#16's layout).
    const submit = container.querySelector('.exercise-checklist-submit');
    expect(notes[0]?.compareDocumentPosition(submit as Node)).toBe(
      Node.DOCUMENT_POSITION_PRECEDING,
    );
    // Static prose: nothing focusable, no live data, so no second way to
    // reach anything (the interaction-depth question).
    expect(notes[0]?.querySelector('a, button, details, [role]')).toBeNull();
    expect(notes[0]?.textContent).not.toMatch(/\d/);
  });

  it('does not restate the definition above the checks — the two say different things', async () => {
    const { container } = await renderChecklist();

    const definition = container.querySelector(
      '.exercise-checklist-definition',
    );
    expect(definition?.textContent).toBe(
      "The Behavioral Checklist is the Module's one Exit Gate condition, self-assessed.",
    );
    // The definition says what it IS; the note says what submitting does.
    expect(NOTE).not.toContain('self-assessed');
    expect(definition?.textContent).not.toContain('Submitting records');
  });

  it('uses no word from the UI copy ban list and never implies Kata judges the code', async () => {
    const { container } = await renderChecklist();

    const text = container.textContent ?? '';
    expect(text).not.toMatch(
      /streak|daily goal|days left|% complete|\bXP\b|\bjust\b|\bsimply\b|\beasy\b/i,
    );
    // Kata is read-only: it never runs, checks or grades anything.
    expect(NOTE).not.toMatch(/\bwe\b|\bKata\b|check(s|ed|ing)? your code|grade|score|pass(es|ed)? you/i);
  });

  it('keeps submit disabled until all three pairs have an answer — unchanged', async () => {
    await renderChecklist();

    const submit = screen.getByRole('button', {
      name: 'Submit Behavioral Checklist',
    });
    expect(submit).toBeDisabled();
    // "No" everywhere — the answers never gate, but the count still does.
    for (const [index, question] of questions.entries()) {
      const group = screen.getByRole('radiogroup', { name: question.prompt });
      fireEvent.click(within(group).getAllByRole('radio')[1]!);
      if (index < questions.length - 1) {
        expect(submit).toBeDisabled(); // 1 and 2 answered
      } else {
        expect(submit).toBeEnabled(); // all three answered
      }
    }
  });

  it('records the Checkpoint on three "No" answers, exactly as it does on three "Yes"', async () => {
    const { progress } = await renderChecklist();
    expect(await progress.getCheckpoint('m01')).toBeNull();

    // "No" is the second option in every pair of this fixture.
    answerAll(1);
    fireEvent.click(
      screen.getByRole('button', { name: 'Submit Behavioral Checklist' }),
    );
    await screen.findByText(/Submitted ·/);

    // The gate is submission alone (docs/design.md § Pedagogy): the answers
    // are stored, and none of them is read as a condition.
    const checkpoint = await progress.getCheckpoint('m01');
    expect(checkpoint).not.toBeNull();
    expect(checkpoint?.moduleId).toBe('m01');
    expect((await progress.getGateStatus('m01')).passed).toBe(true);
    expect((await progress.getSubmittedChecklist('m01'))?.answers).toEqual({
      q1: 'no',
      q2: 'no',
      q3: 'no',
    });
  });

  it('drops the note on the submitted panel — the instruction is spent', async () => {
    const { container } = await renderChecklist();

    answerAll(1);
    fireEvent.click(
      screen.getByRole('button', { name: 'Submit Behavioral Checklist' }),
    );
    await screen.findByText(/Submitted ·/);

    expect(container.querySelector('.exercise-checklist-note')).toBeNull();
    expect(container.textContent).not.toContain(NOTE);
    // The submitted panel itself is untouched: check + line, three rows.
    const panel = container.querySelector('.exercise-checklist-panel');
    expect(panel?.querySelectorAll('.exercise-checklist-row')).toHaveLength(3);
  });

  it('renders nothing for a pending Module — no questions, no note', async () => {
    const progress = await createProgress();
    const { container } = render(
      <ProgressProvider progress={progress}>
        <BehavioralChecklist moduleId="m01" moduleOrdinal={1} questions={[]} />
      </ProgressProvider>,
    );

    await Promise.resolve();
    expect(container.textContent).toBe('');
    expect(container.querySelector('.exercise-checklist-note')).toBeNull();
  });
});

/**
 * The panel's meta line (#138) — which Module's Exit Gate this is, and that
 * it covers every Exercise in that Module rather than the Exercise the
 * learner happens to be on.
 *
 * The panel is keyed by `moduleId` (deliberate), so submitting from `m01-e1`
 * passes Module 01 outright and `m01-e2` may never be opened. The line is
 * where that fact is said; the placement on the screen and the both-Exercises
 * proof are in ExerciseScreen.test.tsx. This is the state matrix and the
 * ordinal formatting at the component level.
 */
describe('the Behavioral Checklist gate scope line (#138)', () => {
  const meta = (ordinal: string) =>
    `Module ${ordinal} Exit Gate — covers every Exercise in the Module, not the one on screen.`;

  /** The panel with whatever ordinal or question set a state needs. */
  function renderWith(
    progress: IProgress,
    moduleOrdinal = 1,
    questionSet: readonly ChecklistQuestion[] = questions,
  ) {
    return render(
      <ProgressProvider progress={progress}>
        <BehavioralChecklist
          moduleId="m01"
          moduleOrdinal={moduleOrdinal}
          questions={questionSet}
        />
      </ProgressProvider>,
    );
  }

  it('names the Module and the gate\'s reach in the form state', async () => {
    const { container } = await renderChecklist();

    const line = container.querySelector('.exercise-checklist-meta');
    expect(line?.textContent).toBe(meta('01'));
    // Beside the heading, inside the heading block.
    expect(
      container.querySelector('.exercise-checklist-heading .exercise-checklist-meta'),
    ).not.toBeNull();
  });

  it('keeps the line on the submitted panel — the gate it scopes is passed, not gone', async () => {
    const { container } = await renderChecklist();

    for (const question of questions) {
      const group = screen.getByRole('radiogroup', { name: question.prompt });
      fireEvent.click(within(group).getAllByRole('radio')[0]!);
    }
    fireEvent.click(
      screen.getByRole('button', { name: 'Submit Behavioral Checklist' }),
    );
    await screen.findByText(/Submitted ·/);

    expect(
      container.querySelector('.exercise-checklist-meta')?.textContent,
    ).toBe(meta('01'));
  });

  it('renders nothing at all while the stored state is still loading', async () => {
    const progress = await createProgress();
    const { container } = renderWith(progress);

    expect(container.querySelector('.exercise-checklist-meta')).toBeNull();

    await screen.findByRole('button', { name: 'Submit Behavioral Checklist' });
    expect(
      container.querySelector('.exercise-checklist-meta'),
    ).not.toBeNull();
  });

  it('renders nothing for a pending Module — no questions, no gate to scope', async () => {
    const progress = await createProgress();
    const { container } = renderWith(progress, 1, []);

    await Promise.resolve();
    expect(container.textContent).toBe('');
    expect(container.querySelector('.exercise-checklist-meta')).toBeNull();
  });

  it('zero-pads the ordinal — "Module 05", never "Module 5"', async () => {
    const progress = await createProgress();
    const { container } = renderWith(progress, 5);
    await screen.findByRole('button', { name: 'Submit Behavioral Checklist' });

    expect(
      container.querySelector('.exercise-checklist-meta')?.textContent,
    ).toBe(meta('05'));
  });

  it('says nothing about the learner\'s code, and carries no banned word', async () => {
    const { container } = await renderChecklist();
    const line = container.querySelector('.exercise-checklist-meta')
      ?.textContent as string;

    for (const banned of [
      'streak',
      'daily goal',
      'days left',
      '% complete',
      'XP',
      'score',
      'just',
      'simply',
      'easy',
    ]) {
      expect(line.toLowerCase()).not.toContain(banned.toLowerCase());
    }
    // Its two siblings say what the checklist IS (#136) and what submitting
    // does (#137); this one says only whose gate it is and how far it goes.
    expect(line).not.toContain('self-assessed');
    expect(line).not.toContain('Submitting records');
  });
});
