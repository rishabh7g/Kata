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
