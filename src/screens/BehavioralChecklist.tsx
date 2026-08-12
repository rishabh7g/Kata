import { useEffect, useState } from 'react';
import { useProgress } from '../app/ProgressContext';
import type { ChecklistQuestion } from '../curriculum';
import type {
  IProgress,
  PartialChecklistAnswers,
  SubmittedChecklist,
} from '../progress';

/**
 * The Behavioral Checklist panel — the whole Exit Gate, and the only write
 * surface in the app (design/README.md § Screens › 3 › Behavioral Checklist,
 * § Interactions › Checklist flow).
 *
 * Per Module, not per Exercise: both of a Module's Exercise screens render
 * the same three questions and the same state, keyed by `moduleId`. Every
 * write goes through IProgress (#14) — answering a radio pair autosaves a
 * draft (`saveChecklistDraft`), submit (`submitChecklist`) stores the
 * submission and the Module's one Checkpoint atomically, and the panel flips
 * to the read-only submitted state without a reload. No free-text field:
 * three radio pairs are the entire form.
 *
 * `onSubmitted` fires once the stored submission is confirmed — the Exercise
 * screen re-reads the gate off it so the banner appears without a reload (#19).
 */
export function BehavioralChecklist({
  moduleId,
  moduleOrdinal,
  questions,
  onSubmitted,
}: {
  moduleId: string;
  moduleOrdinal: number;
  questions: readonly ChecklistQuestion[];
  onSubmitted?: () => void;
}) {
  const progress = useProgress();
  // undefined = still loading; null = not submitted yet (form state).
  const [submitted, setSubmitted] = useState<
    SubmittedChecklist | null | undefined
  >(undefined);
  const [picks, setPicks] = useState<PartialChecklistAnswers>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSubmitted(undefined);
    setPicks({});
    loadChecklistState(progress, moduleId)
      .then(({ submitted: existing, draft }) => {
        if (cancelled) return;
        setPicks(draft);
        setSubmitted(existing);
      })
      .catch((error: unknown) => {
        // IndexedDB refusing to open is the only real cause; nothing
        // sensible to render, and the read surfaces still work.
        console.error(`Failed to load checklist state for ${moduleId}`, error);
      });
    return () => {
      cancelled = true;
    };
  }, [progress, moduleId]);

  // Pending Modules carry no questions — and no reachable Exercise screen.
  if (questions.length === 0) return null;
  // Still loading: render nothing rather than flash the wrong state.
  if (submitted === undefined) return null;

  return (
    <section aria-label="Behavioral Checklist">
      <div className="exercise-checklist-heading">
        <h6 className="exercise-section-label-inline">Behavioral Checklist</h6>
        <span className="text-muted exercise-checklist-meta">
          Module {String(moduleOrdinal).padStart(2, '0')} gate · behaviorally
          answerable only — never opinion
        </span>
      </div>
      {submitted !== null ? (
        <SubmittedPanel submitted={submitted} questions={questions} />
      ) : (
        <ChecklistForm
          moduleId={moduleId}
          questions={questions}
          picks={picks}
          submitting={submitting}
          onPick={(questionId, value) => {
            const next = { ...picks, [questionId]: value };
            setPicks(next);
            // Autosave, fire-and-forget: never a gate input, so a lost draft
            // costs at most re-picking a radio (#14).
            progress.saveChecklistDraft(moduleId, next).catch((error: unknown) => {
              console.error(`Failed to autosave draft for ${moduleId}`, error);
            });
          }}
          onSubmit={() => {
            const answers = completeAnswers(questions, picks);
            if (answers === null) return; // button is disabled anyway
            setSubmitting(true);
            progress
              .submitChecklist(moduleId, answers)
              // Re-read rather than trust local state: submitChecklist is
              // idempotent, so this shows the stored submission either way.
              .then(() => progress.getSubmittedChecklist(moduleId))
              .then((stored) => {
                setSubmitted(stored);
                onSubmitted?.();
              })
              .catch((error: unknown) => {
                console.error(`Failed to submit checklist for ${moduleId}`, error);
              })
              .finally(() => setSubmitting(false));
          }}
        />
      )}
    </section>
  );
}

async function loadChecklistState(
  progress: IProgress,
  moduleId: string,
): Promise<{
  submitted: SubmittedChecklist | null;
  draft: PartialChecklistAnswers;
}> {
  const submitted = await progress.getSubmittedChecklist(moduleId);
  if (submitted !== null) return { submitted, draft: {} };
  const draft = await progress.getChecklistDraft(moduleId);
  return { submitted: null, draft: draft?.answers ?? {} };
}

/** The complete ChecklistAnswers, or null while any pair is unanswered. */
function completeAnswers(
  questions: readonly ChecklistQuestion[],
  picks: PartialChecklistAnswers,
): Record<string, string> | null {
  const answers: Record<string, string> = {};
  for (const question of questions) {
    const value = picks[question.id];
    if (value === undefined) return null;
    answers[question.id] = value;
  }
  return answers;
}

/**
 * The form state: three radio pairs (`.radio` from design/styles.css), the
 * one primary action in the view, disabled until all three are answered.
 */
function ChecklistForm({
  moduleId,
  questions,
  picks,
  submitting,
  onPick,
  onSubmit,
}: {
  moduleId: string;
  questions: readonly ChecklistQuestion[];
  picks: PartialChecklistAnswers;
  submitting: boolean;
  onPick: (questionId: string, value: string) => void;
  onSubmit: () => void;
}) {
  const complete = completeAnswers(questions, picks) !== null;
  return (
    <div>
      {questions.map((question) => (
        <div className="exercise-checklist-item" key={question.id}>
          <div className="exercise-checklist-prompt">{question.prompt}</div>
          <div className="exercise-checklist-options">
            {question.options.map((option) => (
              <label className="radio" key={option.value}>
                <input
                  type="radio"
                  name={`checklist-${moduleId}-${question.id}`}
                  value={option.value}
                  checked={picks[question.id] === option.value}
                  onChange={() => onPick(question.id, option.value)}
                />
                <span className="dot" />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-primary exercise-checklist-submit"
        disabled={!complete || submitting}
        onClick={onSubmit}
      >
        Submit Behavioral Checklist
      </button>
      <p className="text-muted exercise-checklist-note">
        Answer all three checks to submit. Opinion checks are banned — the
        smell you can't see is what you're learning to see.
      </p>
    </div>
  );
}

/**
 * The read-only submitted state (design/README.md § Screens › 3): 2px-bordered
 * panel, check + `Submitted · time` (14px/800), then question/answer rows
 * (1px rules, answers at 600 weight). Nothing here is editable — a Module
 * never gets a second submission.
 */
function SubmittedPanel({
  submitted,
  questions,
}: {
  submitted: SubmittedChecklist;
  questions: readonly ChecklistQuestion[];
}) {
  return (
    <div className="exercise-checklist-panel">
      <div className="exercise-checklist-submitted-line">
        <SubmittedCheckIcon />
        <span>Submitted · {formatSubmittedAt(submitted.submittedAt)}</span>
      </div>
      {questions.map((question) => (
        <div className="exercise-checklist-row" key={question.id}>
          <div className="text-muted exercise-checklist-row-question">
            {question.prompt}
          </div>
          <div className="exercise-checklist-row-answer">
            {answerLabel(question, submitted.answers[question.id])}
          </div>
        </div>
      ))}
    </div>
  );
}

/** The stored value's radio label; the raw value if it ever mismatches. */
function answerLabel(
  question: ChecklistQuestion,
  value: string | undefined,
): string {
  if (value === undefined) return '—';
  return (
    question.options.find((option) => option.value === value)?.label ?? value
  );
}

/** '2026-08-12T09:41:00.000Z' → '12 Aug 2026, 09:41' (local time). */
function formatSubmittedAt(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const time = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${day}, ${time}`;
}

// Icon copied from the design reference (design/DevGym.dc.html § Exercise
// checklist): the 16px, 2.5-stroke check.

function SubmittedCheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
