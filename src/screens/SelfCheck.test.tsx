// The Self-Check panel, rendered against a fake IProgress. The HTML it
// produces is pinned byte-for-byte: the panel's markup carries the a11y
// wiring (radiogroup, labelledby, describedby, live region), and a change to
// any of it is a behaviour change, not a refactor.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProgressProvider } from '../app/ProgressContext';
import type { SelfCheckQuestion } from '../curriculum';
import type { IProgress, ModuleSelfCheck, SelfCheckAnswers } from '../progress';
import { SelfCheck } from './SelfCheck';

// React's act() refuses to run outside an environment that declares itself.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const questions: readonly SelfCheckQuestion[] = [
  {
    id: 'q1',
    prompt: 'How many seams did you count?',
    options: [
      { value: 'one', label: 'One' },
      { value: 'two', label: 'Two' },
    ],
    explanation: 'There are two.',
  },
  {
    id: 'q2',
    prompt: 'Did you run it?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  },
];

/** An in-memory IProgress that remembers what was saved and when. */
function fakeProgress(stored: SelfCheckAnswers | null) {
  const saves: SelfCheckAnswers[] = [];
  const progress: IProgress = {
    async saveSelfCheckAnswers(_moduleId, answers) {
      saves.push(answers);
    },
    async getSelfCheckAnswers(moduleId): Promise<ModuleSelfCheck | null> {
      if (stored === null) return null;
      return { moduleId, answers: stored, savedAt: '2026-01-01T00:00:00.000Z' };
    },
  };
  return { progress, saves };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function render(progress: IProgress, moduleId = 'm01') {
  await act(async () => {
    root.render(
      <ProgressProvider progress={progress}>
        <SelfCheck moduleId={moduleId} questions={questions} />
      </ProgressProvider>,
    );
  });
}

function radio(question: string, value: string): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(
    `input[name="self-check-m01-${question}"][value="${value}"]`,
  );
  if (input === null) throw new Error(`no radio ${question}=${value}`);
  return input;
}

function input(question: string, value: string, checked: readonly string[]) {
  const isChecked = checked.includes(`${question}=${value}`) ? ' checked=""' : '';
  return `<input type="radio" value="${value}"${isChecked} name="self-check-m01-${question}">`;
}

function option(question: string, value: string, label: string, checked: readonly string[]) {
  return `<label class="radio">${input(question, value, checked)}<span class="dot"></span><span>${label}</span></label>`;
}

/** The whole panel's markup: `checked` lists the picked radios as `q=value`. */
function panel(checked: readonly string[], explanation: string) {
  return (
    '<section class="self-check" aria-label="Self-Check">' +
    '<h2 class="module-section-label">Self-Check</h2>' +
    '<p class="text-muted self-check-definition">' +
    "The Self-Check is this Module's optional questions — answer them as you read, and each answer is saved in this browser as you pick it." +
    '</p>' +
    '<div class="self-check-item">' +
    '<div class="self-check-prompt" id="self-check-m01-q1-prompt">How many seams did you count?</div>' +
    '<div class="self-check-options" role="radiogroup" aria-labelledby="self-check-m01-q1-prompt" aria-describedby="self-check-m01-q1-explanation">' +
    option('q1', 'one', 'One', checked) +
    option('q1', 'two', 'Two', checked) +
    '</div>' +
    `<p class="text-muted self-check-explanation" id="self-check-m01-q1-explanation" aria-live="polite">${explanation}</p>` +
    '</div>' +
    '<div class="self-check-item">' +
    '<div class="self-check-prompt" id="self-check-m01-q2-prompt">Did you run it?</div>' +
    '<div class="self-check-options" role="radiogroup" aria-labelledby="self-check-m01-q2-prompt">' +
    option('q2', 'yes', 'Yes', checked) +
    option('q2', 'no', 'No', checked) +
    '</div></div>' +
    '</section>'
  );
}

describe('SelfCheck', () => {
  it('renders every question unanswered, with an empty explanation slot', async () => {
    await render(fakeProgress(null).progress);
    expect(container.innerHTML).toBe(panel([], ''));
    expect(radio('q1', 'one').checked).toBe(false);
    expect(radio('q1', 'two').checked).toBe(false);
  });

  it('restores stored picks and reveals the explanation for an answered question', async () => {
    await render(fakeProgress({ q1: 'two' }).progress);
    expect(container.innerHTML).toBe(panel(['q1=two'], 'There are two.'));
    expect(radio('q1', 'two').checked).toBe(true);
    expect(radio('q2', 'yes').checked).toBe(false);
  });

  it('autosaves a pick through IProgress, merged with the picks already made', async () => {
    const { progress, saves } = fakeProgress({ q2: 'yes' });
    await render(progress);
    expect(container.innerHTML).toBe(panel(['q2=yes'], ''));
    await act(async () => radio('q1', 'one').click());
    expect(saves).toEqual([{ q2: 'yes', q1: 'one' }]);
    // A pick updates the input's checked property, not its attribute, so the
    // markup still carries only the initial-render checked="" — the property
    // is asserted below.
    expect(container.innerHTML).toBe(panel(['q2=yes'], 'There are two.'));
    expect(radio('q1', 'one').checked).toBe(true);
    expect(radio('q2', 'yes').checked).toBe(true);
  });

  it('renders nothing for a Module with no questions', async () => {
    await act(async () => {
      root.render(
        <ProgressProvider progress={fakeProgress(null).progress}>
          <SelfCheck moduleId="m01" questions={[]} />
        </ProgressProvider>,
      );
    });
    expect(container.innerHTML).toBe('');
  });
});
