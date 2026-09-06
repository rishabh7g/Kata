import { useEffect, useState } from 'react';
import { useProgress } from '../app/ProgressContext';
import type { SelfCheckQuestion } from '../curriculum';
import type { SelfCheckAnswers } from '../progress';
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
 */
export function SelfCheck({
  moduleId,
  questions,
}: {
  moduleId: string;
  questions: readonly SelfCheckQuestion[];
}) {
  const progress = useProgress();
  // undefined = the stored answers are still loading; render nothing rather
  // than flash three empty questions over answers that exist.
  const [picks, setPicks] = useState<SelfCheckAnswers | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setPicks(undefined);
    progress
      .getSelfCheckAnswers(moduleId)
      .then((stored) => {
        if (!cancelled) setPicks(stored?.answers ?? {});
      })
      .catch((error: unknown) => {
        // IndexedDB refusing to open is the only real cause; nothing sensible
        // to render, and every read surface on the screen still works.
        console.error(`Failed to load Self-Check answers for ${moduleId}`, error);
      });
    return () => {
      cancelled = true;
    };
  }, [progress, moduleId]);

  // No questions, no panel: no heading and no definition either.
  if (questions.length === 0) return null;
  if (picks === undefined) return null;

  return (
    <section className="self-check" aria-label={copy.selfCheck.heading}>
      <h2 className="module-section-label">{copy.selfCheck.heading}</h2>
      {/* What a Self-Check is: without it the reader meets a new term as a
          bare label, and nothing else says the questions are optional. */}
      <p className="text-muted self-check-definition">
        {copy.selfCheck.definition}
      </p>
      {questions.map((question) => {
        // The prompt is the group's label, not loose text beside it, so
        // focusing any option announces the question and the option's
        // position among the 2–4.
        const promptId = `self-check-${moduleId}-${question.id}-prompt`;
        // The slot exists from first render, empty until a pick fills it: a
        // live region has to be in the DOM before its content changes to be
        // announced. A question with no explanation gets no slot at all.
        const explanationId = `self-check-${moduleId}-${question.id}-explanation`;
        const hasExplanation = question.explanation !== undefined;
        const answer = picks[question.id];
        return (
          <div className="self-check-item" key={question.id}>
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
                <label className="radio" key={option.value}>
                  <input
                    type="radio"
                    name={`self-check-${moduleId}-${question.id}`}
                    value={option.value}
                    checked={answer === option.value}
                    onChange={() => {
                      const next = { ...picks, [question.id]: option.value };
                      setPicks(next);
                      // Fire-and-forget: an answer gates nothing, so a lost
                      // write costs at most re-picking a radio.
                      progress
                        .saveSelfCheckAnswers(moduleId, next)
                        .catch((error: unknown) => {
                          console.error(
                            `Failed to save the Self-Check answer for ${moduleId}`,
                            error,
                          );
                        });
                    }}
                  />
                  <span className="dot" />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            {hasExplanation && (
              <p
                className="text-muted self-check-explanation"
                id={explanationId}
                aria-live="polite"
              >
                {answer === undefined ? '' : question.explanation}
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}
