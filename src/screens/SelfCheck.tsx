import { useEffect, useState } from 'react';
import { useProgress } from '../app/ProgressContext';
import type { SelfCheckQuestion } from '../curriculum';
import type { SelfCheckAnswers } from '../progress';
import { useStrings } from '../strings/strings';

/**
 * The Self-Check panel — a Module's optional questions, answered in place
 * while reading (docs/ubiquitous-language.md § Self-Check, #157).
 *
 * It is the same three questions the gated model asked, with the purpose
 * flipped: nothing is sent, nothing is judged, nothing is recorded but the
 * answers themselves. So there is no control to send them, no sent state, no
 * completeness rule and no state text — picking an option writes it and
 * changes nothing else on the screen.
 *
 * Per Module, not per Exercise: it lives on the Module screen, beside the
 * prose it belongs to, and is the only place these questions are reachable
 * (the interaction-depth question, design/issue-guide.md).
 *
 * Every write still goes through IProgress: picking an option autosaves the
 * Module's answers (`saveSelfCheckAnswers`), and the picks restore from them
 * on the next visit — the only data Kata persists at all (#159).
 *
 * A question may carry an authored `explanation` (#162). Picking any option
 * reveals it, and it is the SAME text whichever option was picked: it teaches
 * what the question was pointing at and never marks the pick right or wrong,
 * because Kata judges nothing. A question without one reveals nothing.
 */
export function SelfCheck({
  moduleId,
  questions,
}: {
  moduleId: string;
  questions: readonly SelfCheckQuestion[];
}) {
  const s = useStrings();
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

  // A Module whose content pack is not authored yet carries no questions —
  // no heading, no definition, nothing at all.
  if (questions.length === 0) return null;
  if (picks === undefined) return null;

  return (
    <section className="self-check" aria-label={s['selfCheck.heading']}>
      <h2 className="module-section-label">{s['selfCheck.heading']}</h2>
      {/* What a Self-Check is (#157) — one clause, under the heading that
          uses the term as a label and above the questions it describes. That
          is clause (4) of the keeper test (design/issue-guide.md § UI copy
          ban list): without it the reader meets a new term as a bare label,
          and nothing else on the screen says the questions are optional. */}
      <p className="text-muted self-check-definition">
        {s['selfCheck.definition']}
      </p>
      {questions.map((question) => {
        // The prompt is the group's label, not loose text beside it (#72):
        // `role="radiogroup"` + `aria-labelledby` names the group after the
        // question, so focusing any option announces the question, "group",
        // and its position among the question's 2–4 options (#162).
        const promptId = `self-check-${moduleId}-${question.id}-prompt`;
        // The explanation slot exists from first render whenever the question
        // authored one, empty until a pick fills it: a live region has to be
        // in the DOM BEFORE its content changes to be announced at all. That
        // also makes `aria-describedby` a stable reference. A question with no
        // explanation gets no slot, no id, and no description.
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
                      // Autosave, fire-and-forget: an answer is never a
                      // condition for anything, so a lost write costs at most
                      // re-picking a radio.
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
