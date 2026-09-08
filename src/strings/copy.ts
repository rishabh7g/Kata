/**
 * Every word the shell renders, in one object. A key that does not exist is a
 * `tsc` error at the call site; a key nothing reads is visible dead code. A
 * second locale would be a second object of this shape.
 *
 * Authored content is not here — that comes from the content files.
 */
export const copy = {
  notice: {
    progressUnavailable: {
      title: 'Kata cannot open its progress database',
      body1:
        'Kata keeps your Self-Check answers in this browser and nowhere else, and this browser will not let it open that storage. Site data is blocked for {origin}, or this window is a private or hardened mode that blocks it.',
      body2:
        'Allow site data for {origin} and reload the page. Answers already saved are untouched — they are still in the browser that saved them.',
    },
    moduleUnavailable: {
      title: "This Module's content is not available",
      body1Before: 'Kata reads this Module from',
      body1After:
        ', fetched the moment you open it, and that request failed. A Module is stored for offline use as it is read — so one you have not opened online yet is not available offline.',
      body2:
        'Reconnect and try again. Nothing is lost: your Self-Check answers live in this browser, not in the file that failed to load.',
      retry: 'Try again',
    },
  },

  shell: {
    backToCurriculum: 'Curriculum',
  },

  status: {
    inProgress: 'In progress',
  },

  /** A Category's practice language, as a reader would name it. */
  language: {
    csharp: 'C#',
    python: 'Python',
  },

  curriculum: {
    title: 'Curriculum',
    // The one fact the rows cannot show for themselves.
    orientation: 'You write and run the code in your own IDE — Kata never runs or sees your code.',
  },

  module: {
    ordinalLabel: 'Module {ordinal}',
    tabTitle: 'Module {ordinal} — {title}',
    sectionLabel: {
      modelExamples: 'Model Examples',
      exercises: 'Exercises',
    },
    example: {
      before: 'Before',
      after: 'After',
    },
  },

  selfCheck: {
    heading: 'Self-Check',
    // The heading uses the term as a label; this is where it is defined.
    definition:
      "The Self-Check is this Module's optional questions — answer them as you read, and each answer is saved in this browser as you pick it.",
  },

  exercise: {
    kicker: 'Exercise {id} · Module {ordinal}',
    /** One pair for both surfaces: the Module's card and this screen's tag. */
    tagRefactor: 'Refactor',
    tagConstruct: 'Construct',
    sectionLabel: {
      spec: 'Exercise Spec',
      targetInterface: 'Target Interface',
      // Lower-case on purpose: title case marks a domain term, and this
      // section has none of its own.
      practiceMaterial: 'Practice material',
    },
    spec: {
      concept: 'Concept',
      smell: 'Smell',
      sizeBudget: 'Size budget',
      sizeBudgetValue: '≤ {loc} LOC',
    },
    targetInterface: {
      immutableTag: 'Immutable',
      definition:
        'The Target Interface is the boundary you must end up with — the Test Suite is written against it, and you may not change it.',
    },
    practiceMaterial: {
      pending:
        "This Exercise's folder is not committed yet — the GitHub link appears here once it is.",
      linkLabel: "Open this Exercise's folder on GitHub",
      // The toolchain is the reader's to install, and the command only works
      // from the folder's tests/ directory.
      noteBefore:
        "Clone or copy the folder and review its Test Suite before starting. Running the Test Suite needs the {language} toolchain installed on your own machine — from the Exercise folder's tests/ directory, run",
      noteAfter: 'in your own IDE.',
    },
  },
} as const;

/** `{origin}` and friends. Non-greedy by construction: braces cannot nest. */
const PLACEHOLDER = /\{([^{}]*)\}/g;

/**
 * Fills a value's `{placeholders}`. A placeholder with no value is left
 * verbatim and warned, never blanked: `{ordinal}` on screen is ugly and
 * fixable, while a silent gap reads as finished copy that has lost its data.
 */
export function interpolate(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(PLACEHOLDER, (placeholder, name: string) => {
    const value = values[name];
    if (value === undefined) {
      console.warn(`copy: no value for ${placeholder} — rendering it verbatim`);
      return placeholder;
    }
    return String(value);
  });
}
