import { fireEvent, render, screen, within } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProgressProvider } from '../app/ProgressContext';
import type { SelfCheckQuestion } from '../curriculum';
import type { IProgress } from '../progress';
import { createProgress } from '../progress';
import { SelfCheck } from './SelfCheck';

// The panel on its own, over the real createProgress against fake-indexeddb
// (#14's prescribed test environment) — the Module screen's own wiring is
// covered by ModuleScreen.test.tsx. Prompts here are the real shape: one
// long sentence ending in a question, two opposed options. None of them
// authors an `explanation` — that is what makes this set the evidence a
// question without one reveals nothing at all (#162).
const questions: readonly SelfCheckQuestion[] = [
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

const DEFINITION =
  "The Self-Check is this Module's optional questions — answer them as you read, and each answer is saved in this browser as you pick it.";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

/** The panel with whatever question set a state needs, un-awaited. */
function renderWith(
  questionSet: readonly SelfCheckQuestion[],
  progress: IProgress,
) {
  return render(
    <ProgressProvider progress={progress}>
      <SelfCheck moduleId="m01" questions={questionSet} />
    </ProgressProvider>,
  );
}

async function renderSelfCheck(progress?: IProgress) {
  const activeProgress = progress ?? (await createProgress());
  const utils = renderWith(questions, activeProgress);
  // The panel loads its stored answers before it renders anything.
  await screen.findByRole('heading', { level: 2, name: 'Self-Check' });
  return { ...utils, progress: activeProgress };
}

describe('the Self-Check panel (#157)', () => {
  it('renders all three questions unanswered, with no submit control anywhere', async () => {
    const { container } = await renderSelfCheck();

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(6);
    for (const radio of radios) expect(radio).not.toBeChecked();

    // Nothing to press: no submit, no button of any kind, no form.
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(container.querySelector('form, [type="submit"]')).toBeNull();
    expect(container.textContent ?? '').not.toMatch(/submit/i);

    // No question here authors an explanation, so no slot exists to reveal
    // one into and no group is described by anything (#162).
    expect(container.querySelectorAll('.self-check-explanation')).toHaveLength(0);
    expect(container.querySelector('[aria-describedby]')).toBeNull();
  });

  it('states what a Self-Check is, once, under the heading (#157)', async () => {
    const { container } = await renderSelfCheck();

    const definitions = [
      ...container.querySelectorAll('.self-check-definition'),
    ].map((line) => line.textContent);
    expect(definitions).toEqual([DEFINITION]);

    // Under the heading and above the first question: the panel reads
    // definition first, questions second.
    const heading = container.querySelector('h2');
    const definition = container.querySelector('.self-check-definition');
    const firstItem = container.querySelector('.self-check-item');
    expect(definition?.compareDocumentPosition(heading as Node)).toBe(
      Node.DOCUMENT_POSITION_PRECEDING,
    );
    expect(definition?.compareDocumentPosition(firstItem as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    // Static text only — no link, no disclosure, so no second way to reach
    // anything (the interaction-depth question, design/issue-guide.md).
    expect(definition?.querySelector('a, button, details, [role]')).toBeNull();
  });

  it('autosaves a pick immediately — no button, and the store holds the answer', async () => {
    const { progress } = await renderSelfCheck();

    fireEvent.click(
      within(
        screen.getByRole('radiogroup', { name: questions[1]!.prompt }),
      ).getAllByRole('radio')[1]!,
    );

    const stored = await progress.getSelfCheckAnswers('m01');
    expect(stored?.answers).toEqual({ q2: 'no' });
  });

  it('restores the stored answers on a revisit, leaving the rest unanswered', async () => {
    const progress = await createProgress();
    await progress.saveSelfCheckAnswers('m01', { q1: 'yes', q3: 'no' });

    await renderSelfCheck(progress);

    expect(
      screen.getByRole('radio', { name: 'Yes — 3 or fewer' }),
    ).toBeChecked();
    expect(
      screen.getByRole('radio', {
        name: 'No — at least one caller had to change',
      }),
    ).toBeChecked();
    // The untouched question stays unanswered — nothing is inferred.
    for (const option of questions[1]!.options) {
      expect(screen.getByRole('radio', { name: option.label })).not.toBeChecked();
    }
  });

  it('lets an answer be changed, and stores the change', async () => {
    const { progress } = await renderSelfCheck();
    const group = screen.getByRole('radiogroup', { name: questions[0]!.prompt });

    fireEvent.click(within(group).getAllByRole('radio')[0]!);
    fireEvent.click(within(group).getAllByRole('radio')[1]!);

    expect(within(group).getAllByRole('radio')[1]!).toBeChecked();
    expect((await progress.getSelfCheckAnswers('m01'))?.answers).toEqual({
      q1: 'no',
    });
  });

  it('renders nothing at all while the stored answers are still loading', () => {
    const pending: IProgress = {
      ...({} as IProgress),
      getSelfCheckAnswers: () => new Promise(() => {}),
    };
    const { container } = renderWith(questions, pending);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a Module with no questions', async () => {
    const { container } = renderWith([], await createProgress());

    expect(container).toBeEmptyDOMElement();
  });

  it('says nothing about a removed term, and carries no banned word', async () => {
    const { container } = await renderSelfCheck();

    const text = container.textContent ?? '';
    // docs/ubiquitous-language.md § Removed terms + § Banned, and the UI copy
    // ban list (design/issue-guide.md).
    expect(text).not.toMatch(
      /exit gate|behavioral checklist|checkpoint|unlock|locked|\bgate\b|submit/i,
    );
    expect(text).not.toMatch(/lesson|course|level|quiz|flashcard|grade|score/i);
    expect(text).not.toMatch(
      /streak|daily goal|days left|% complete|\bXP\b|\bjust\b|\bsimply\b|\beasy\b/i,
    );
  });
});

/**
 * The radio grouping (#72) — kept exactly as the gated model had it: the
 * questions are the same three, and an option is never announced alone.
 */
describe('Self-Check radio grouping (#72)', () => {
  it('names each question its own group, so an option is never announced alone', async () => {
    await renderSelfCheck();

    expect(screen.getAllByRole('radiogroup')).toHaveLength(3);
    for (const question of questions) {
      expect(
        screen.getByRole('radiogroup', { name: question.prompt }),
      ).toBeInTheDocument();
    }
  });

  it("puts exactly that question's own options inside its group", async () => {
    await renderSelfCheck();

    for (const question of questions) {
      const group = screen.getByRole('radiogroup', { name: question.prompt });
      const options = within(group).getAllByRole('radio');
      expect(options.map((option) => option.getAttribute('value'))).toEqual([
        'yes',
        'no',
      ]);
      // Each radio's own accessible name stays its option label, so a
      // screen reader says "<prompt>, group, <label>, 1 of 2".
      for (const option of question.options) {
        expect(
          within(group).getByRole('radio', { name: option.label }),
        ).toBeInTheDocument();
      }
    }
  });

  it('leaves no radio outside a group', async () => {
    const { container } = await renderSelfCheck();

    const all = screen.getAllByRole('radio');
    expect(all).toHaveLength(6);
    for (const radio of all) {
      expect(radio.closest('[role="radiogroup"]')).not.toBeNull();
    }
    expect(container.querySelectorAll('[role="radiogroup"]')).toHaveLength(3);
  });

  it('labels the group with the visible prompt element, not a duplicate string', async () => {
    const { container } = await renderSelfCheck();

    const items = [...container.querySelectorAll('.self-check-item')];
    expect(items).toHaveLength(3);
    for (const [index, item] of items.entries()) {
      const prompt = item.querySelector('.self-check-prompt');
      const group = item.querySelector('[role="radiogroup"]');
      expect(prompt?.textContent).toBe(questions[index]!.prompt);
      expect(prompt?.id).toBeTruthy();
      expect(group?.getAttribute('aria-labelledby')).toBe(prompt?.id);
      // The prompt stays a visible div, not a label of its own.
      expect(prompt?.tagName).toBe('DIV');
      expect(group).toHaveClass('self-check-options');
    }
  });

  it('keeps one tab stop and one arrow-key ring per question: a shared name per pair, unique across questions', async () => {
    await renderSelfCheck();

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
    // One name inside a pair (arrow keys move within the question), and three
    // distinct names across them (Tab reaches each question once).
    expect(namesPerGroup.map((names) => names.length)).toEqual([1, 1, 1]);
    expect(new Set(namesPerGroup.flat()).size).toBe(3);
  });

  it('keeps the .radio markup the focus ring hangs off', async () => {
    const { container } = await renderSelfCheck();

    for (const label of container.querySelectorAll('label.radio')) {
      // `.radio input:focus-visible + .dot` — the input must stay the dot's
      // immediate previous sibling or the 2px accent ring disappears.
      const input = label.querySelector('input[type="radio"]');
      expect(input?.nextElementSibling).toHaveClass('dot');
    }
  });
});

/**
 * 2–4 options and the explanation revealed after answering (#162).
 *
 * The load-bearing property is negative: whichever option the reader picks,
 * the panel renders the SAME thing. Kata never judges an answer, so there is
 * no correctness signal anywhere in the DOM — not in the text, not in a
 * class, not in an ARIA attribute.
 */
const RECALL_EXPLANATION =
  'The count is the size of the surface a caller has to hold in their head. Whatever number you picked, it is the one you can watch move as the design changes.';

const explained: readonly SelfCheckQuestion[] = [
  {
    id: 'q1',
    prompt: 'How many things must a caller know before they can use your module?',
    options: [
      { value: 'one', label: 'One' },
      { value: 'two', label: 'Two' },
      { value: 'three', label: 'Three' },
      { value: 'more', label: 'More than three' },
    ],
    explanation: RECALL_EXPLANATION,
  },
  {
    id: 'q2',
    prompt: 'Did the search for leaked decisions come back empty?',
    options: [
      { value: 'yes', label: 'Yes — nothing leaked' },
      { value: 'no', label: 'No — at least one hit' },
    ],
  },
];

async function renderExplained(progress?: IProgress) {
  const activeProgress = progress ?? (await createProgress());
  const utils = renderWith(explained, activeProgress);
  await screen.findByRole('heading', { level: 2, name: 'Self-Check' });
  return { ...utils, progress: activeProgress };
}

/** The one explanation slot of the four-option question. */
function explanationSlot(container: HTMLElement) {
  const item = container.querySelectorAll('.self-check-item')[0];
  return item?.querySelector('.self-check-explanation') ?? null;
}

describe('Self-Check options and explanations (#162)', () => {
  it('renders four radios for a four-option question, and autosaves a pick as before', async () => {
    const { progress } = await renderExplained();
    const group = screen.getByRole('radiogroup', { name: explained[0]!.prompt });

    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(4);
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual([
      'one',
      'two',
      'three',
      'more',
    ]);

    fireEvent.click(radios[3]!);

    expect(radios[3]!).toBeChecked();
    expect((await progress.getSelfCheckAnswers('m01'))?.answers).toEqual({
      q1: 'more',
    });
  });

  it('reveals the explanation once an option is picked, and nothing before', async () => {
    const { container } = await renderExplained();

    // The slot is in the DOM from first render — a live region has to be
    // there before its content changes — and says nothing yet.
    const slot = explanationSlot(container);
    expect(slot).not.toBeNull();
    expect(slot).toBeEmptyDOMElement();
    expect(container.textContent ?? '').not.toContain(RECALL_EXPLANATION);

    fireEvent.click(
      within(
        screen.getByRole('radiogroup', { name: explained[0]!.prompt }),
      ).getAllByRole('radio')[0]!,
    );

    expect(explanationSlot(container)).toHaveTextContent(RECALL_EXPLANATION);
  });

  it('reveals nothing for a question that authors no explanation', async () => {
    const { container } = await renderExplained();
    const group = screen.getByRole('radiogroup', { name: explained[1]!.prompt });

    fireEvent.click(within(group).getAllByRole('radio')[0]!);

    const item = container.querySelectorAll('.self-check-item')[1];
    expect(item?.querySelector('.self-check-explanation')).toBeNull();
    expect(group.getAttribute('aria-describedby')).toBeNull();
    // Answering it adds no node at all beyond the checked radio.
    expect(container.querySelectorAll('.self-check-explanation')).toHaveLength(1);
  });

  it('renders the identical panel whichever option was picked — no correctness anywhere', async () => {
    const { container } = await renderExplained();
    const group = screen.getByRole('radiogroup', { name: explained[0]!.prompt });
    const radios = within(group).getAllByRole('radio');

    const rendered = radios.map((radio) => {
      fireEvent.click(radio);
      return container.textContent ?? '';
    });

    // Every option produces the same text, character for character: the
    // explanation teaches, it never marks a pick right or wrong.
    expect(new Set(rendered).size).toBe(1);
    expect(rendered[0]).toContain(RECALL_EXPLANATION);

    // And nothing else in the DOM carries a verdict either.
    const marked = [...container.querySelectorAll('*')].filter(
      (node) =>
        node.hasAttribute('aria-invalid') ||
        /correct|wrong|pass|fail|right/i.test(node.getAttribute('class') ?? ''),
    );
    expect(marked).toEqual([]);
    expect(container.textContent ?? '').not.toMatch(
      /correct|incorrect|\bwrong\b|\bright answer\b|well done|try again/i,
    );
  });

  it('shows the explanation for a restored answer on the next visit', async () => {
    const progress = await createProgress();
    await progress.saveSelfCheckAnswers('m01', { q1: 'two' });

    const { container } = await renderExplained(progress);

    expect(screen.getByRole('radio', { name: 'Two' })).toBeChecked();
    expect(explanationSlot(container)).toHaveTextContent(RECALL_EXPLANATION);
  });

  it('describes the question group with its explanation, in a polite live region', async () => {
    const { container } = await renderExplained();
    const group = screen.getByRole('radiogroup', { name: explained[0]!.prompt });
    const slot = explanationSlot(container);

    expect(slot?.id).toBeTruthy();
    expect(group.getAttribute('aria-describedby')).toBe(slot?.id);
    expect(slot?.getAttribute('aria-live')).toBe('polite');
    // A paragraph after the options, not a control of its own.
    expect(slot?.tagName).toBe('P');
    expect(slot?.querySelector('a, button, input, [role]')).toBeNull();
    expect(
      group.compareDocumentPosition(slot as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
