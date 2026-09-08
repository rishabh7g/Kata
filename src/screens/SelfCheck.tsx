import { useState } from 'react';
import { useProgress } from '../app/ProgressContext';
import { useAsyncValue } from './useAsyncValue';
import type {
  SelfCheckOption as SelfCheckOptionData,
  SelfCheckQuestion,
  SelfCheckQuestionId,
} from '../curriculum';
import type { IProgress, SelfCheckAnswers } from '../progress';
import { copy } from '../strings/copy';

/**
 * The Self-Check panel — a Module's optional questions, answered in place
 * while reading.
 *
 * Nothing is sent and nothing is judged, so there is no submit control, no
 * sent state and no completeness rule: picking an option autosaves it through
 * IProgress and changes nothing else on the screen. Those answers are the
 * only data Kata persists.
 *
 * A question may carry an `explanation`. Any pick reveals it and it is the
 * same text whichever option was picked — it teaches what the question was
 * pointing at, and never marks a pick right or wrong.
 *
 * Mounted keyed by `moduleId` (ModuleScreen), so the picks made this session
 * belong to one Module and never carry over to the next.
 */
export function SelfCheck({
  moduleId,
  questions,
}: {
  moduleId: string;
  questions: readonly SelfCheckQuestion[];
}) {
  const progress = useProgress();
  // null = the stored answers are still loading; render nothing rather than
  // flash three empty questions over answers that exist.
  const stored = useAsyncValue(
    () => loadStoredPicks(progress, moduleId),
    [progress, moduleId],
    `Failed to load Self-Check answers for ${moduleId}`,
  );
  // The picks made since the load, over the stored ones.
  const [sessionPicks, setSessionPicks] = useState<SelfCheckAnswers>({});

  // No questions, no panel: no heading and no definition either.
  if (questions.length === 0) return null;
  if (stored === null) return null;
  const picks: SelfCheckAnswers = { ...stored, ...sessionPicks };

  function recordPick(questionId: SelfCheckQuestionId, value: string) {
    const next = { ...picks, [questionId]: value };
    setSessionPicks((session) => ({ ...session, [questionId]: value }));
    // Fire-and-forget: an answer gates nothing, so a lost write costs at most
    // re-picking a radio.
    progress.saveSelfCheckAnswers(moduleId, next).catch((error: unknown) => {
      console.error(`Failed to save the Self-Check answer for ${moduleId}`, error);
    });
  }

  return (
    <section className="self-check" aria-label={copy.selfCheck.heading}>
      <h2 className="module-section-label">{copy.selfCheck.heading}</h2>
      {/* What a Self-Check is: without it the reader meets a new term as a
          bare label, and nothing else says the questions are optional. */}
      <p className="text-muted self-check-definition">{copy.selfCheck.definition}</p>
      {questions.map((question) => (
        <SelfCheckItem
          key={question.id}
          moduleId={moduleId}
          question={question}
          answer={picks[question.id]}
          onPick={recordPick}
        />
      ))}
    </section>
  );
}

/**
 * The Module's stored answers, or an empty map for a Module with no record.
 * IndexedDB refusing to open is the only real failure, and every read surface
 * on the screen still works without the panel.
 */
async function loadStoredPicks(progress: IProgress, moduleId: string): Promise<SelfCheckAnswers> {
  const record = await progress.getSelfCheckAnswers(moduleId);
  return record?.answers ?? {};
}

/** One question: its prompt labelling its radios, and its explanation slot. */
function SelfCheckItem({
  moduleId,
  question,
  answer,
  onPick,
}: {
  moduleId: string;
  question: SelfCheckQuestion;
  answer: string | undefined;
  onPick: (questionId: SelfCheckQuestionId, value: string) => void;
}) {
  // The prompt is the group's label, not loose text beside it, so focusing
  // any option announces the question and the option's position among the
  // 2–4.
  const promptId = `self-check-${moduleId}-${question.id}-prompt`;
  // The slot exists from first render, empty until a pick fills it: a live
  // region has to be in the DOM before its content changes to be announced.
  // A question with no explanation gets no slot at all.
  const explanationId = `self-check-${moduleId}-${question.id}-explanation`;
  const hasExplanation = question.explanation !== undefined;
  return (
    <div className="self-check-item">
      <div className="self-check-prompt" id={promptId}>
        {question.prompt}
      </div>
      <div
        className="self-check-options"
        role="radiogroup"
        aria-labelledby={promptId}
        aria-describedby={hasExplanation ? explanationId : undefined}
      >
        {question.options.map((option) => (
          <SelfCheckOption
            key={option.value}
            name={`self-check-${moduleId}-${question.id}`}
            option={option}
            checked={answer === option.value}
            onPick={() => onPick(question.id, option.value)}
          />
        ))}
      </div>
      {hasExplanation && (
        <p className="text-muted self-check-explanation" id={explanationId} aria-live="polite">
          {answer === undefined ? '' : question.explanation}
        </p>
      )}
    </div>
  );
}

/** One radio in a question's group. */
function SelfCheckOption({
  name,
  option,
  checked,
  onPick,
}: {
  name: string;
  option: SelfCheckOptionData;
  checked: boolean;
  onPick: () => void;
}) {
  return (
    <label className="radio">
      <input type="radio" name={name} value={option.value} checked={checked} onChange={onPick} />
      <span className="dot" />
      <span>{option.label}</span>
    </label>
  );
}
