import { useEffect, useState } from 'react';
import { useProgress } from '../app/ProgressContext';
import type { ChecklistQuestion } from '../curriculum';
import type { PartialChecklistAnswers } from '../progress';
import { useStrings } from '../strings/strings';

/**
 * The Self-Check panel — a Module's optional questions, answered in place
 * while reading (docs/ubiquitous-language.md § Self-Check, #157).
 *
 * It is the same three questions the Behavioral Checklist used to carry, with
 * the purpose flipped: nothing is sent, nothing is judged, nothing is
 * recorded but the answers themselves. So there is no submit control, no
 * submitted state, no completeness rule and no state text — picking an option
 * writes it and changes nothing else on the screen.
 *
 * Per Module, not per Exercise: it lives on the Module screen, beside the
 * prose it belongs to, and is the only place these questions are reachable
 * (the interaction-depth question, design/issue-guide.md).
 *
 * Every write still goes through IProgress: picking an option autosaves the
 * draft (`saveChecklistDraft`), and the picks restore from it on the next
 * visit. The contract's names still say "checklist" — renaming them is #159's.
 */
export function SelfCheck({
  moduleId,
  questions,
}: {
  moduleId: string;
  questions: readonly ChecklistQuestion[];
}) {
  const s = useStrings();
  const progress = useProgress();
  // undefined = the stored answers are still loading; render nothing rather
  // than flash three empty questions over answers that exist.
  const [picks, setPicks] = useState<PartialChecklistAnswers | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;
    setPicks(undefined);
    progress
      .getChecklistDraft(moduleId)
      .then((draft) => {
        if (!cancelled) setPicks(draft?.answers ?? {});
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
        // The prompt is the pair's label, not loose text beside it (#72):
        // `role="radiogroup"` + `aria-labelledby` names the group after the
        // question, so focusing either option announces the question,
        // "group", and "1 of 2".
        const promptId = `self-check-${moduleId}-${question.id}-prompt`;
        return (
          <div className="self-check-item" key={question.id}>
            <div className="self-check-prompt" id={promptId}>
              {question.prompt}
            </div>
            <div
              className="self-check-options"
              role="radiogroup"
              aria-labelledby={promptId}
            >
              {question.options.map((option) => (
                <label className="radio" key={option.value}>
                  <input
                    type="radio"
                    name={`self-check-${moduleId}-${question.id}`}
                    value={option.value}
                    checked={picks[question.id] === option.value}
                    onChange={() => {
                      const next = { ...picks, [question.id]: option.value };
                      setPicks(next);
                      // Autosave, fire-and-forget: an answer is never a
                      // condition for anything, so a lost write costs at most
                      // re-picking a radio.
                      progress
                        .saveChecklistDraft(moduleId, next)
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
          </div>
        );
      })}
    </section>
  );
}
