/**
 * Every word the shell renders, in one object.
 *
 * Screens import `copy` and read it by property, so a key that does not exist
 * is a `tsc` error at the call site and a key nothing reads is dead code a
 * reader can see. A second locale is a second object of this shape.
 *
 * Authored content — Concept Pages, Model Examples, Exercise briefs,
 * Self-Check questions — is not here. That comes from the content files.
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
    // The one fact nothing else on the screen says. That a Module is one
    // concept the rows themselves show, and where progress lives is said by
    // the notice that raises when the browser refuses to store it.
    orientation:
      'You write and run the code in your own IDE — Kata never runs or sees your code.',
  },

  module: {
    ordinalLabel: 'Module {ordinal}',
    tabTitle: 'Module {ordinal} — {title}',
    sectionLabel: {
      conceptPage: 'Concept Page',
      modelExamples: 'Model Examples',
      exercises: 'Exercises',
    },
    // What is missing, in the reader's terms, when a content pack is not
    // authored yet. The section is the pending Module's only content, so
    // without it the section renders blank.
    pending: {
      conceptPage:
        'Concept Page not written yet — there is nothing to read in this Module.',
      modelExamples: 'Model Examples arrive with the Concept Page.',
      exercises:
        'No Exercises yet — the first is generated from an Exercise Spec.',
    },
    example: {
      before: 'Before',
      after: 'After',
    },
    exercise: {
      tagRefactor: 'Refactor',
      tagConstruct: 'Construct',
    },
  },

  selfCheck: {
    heading: 'Self-Check',
    // The first place the app says what a Self-Check is: the heading above it
    // uses the term as a label, and nothing else on the screen says the
    // questions are optional or that an answer is kept rather than sent.
    definition:
      "The Self-Check is this Module's optional questions — answer them as you read, and each answer is saved in this browser as you pick it.",
  },

  exercise: {
    kicker: 'Exercise {id} · Module {ordinal}',
    tagRefactorType: 'Refactor-type',
    tagConstructType: 'Construct-type',
    sectionLabel: {
      spec: 'Exercise Spec',
      targetInterface: 'Target Interface',
      // Lower-case, unlike the labels around it. Title case marks a domain
      // term (docs/ubiquitous-language.md); this section has no term of its
      // own — what it hands over is an Exercise folder and its Test Suite.
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
      note: 'Wanting to change it is a signal to record and discuss — not an allowed move.',
    },
    practiceMaterial: {
      pending:
        "This Exercise's folder is not committed yet — the GitHub link appears here once it is.",
      linkLabel: "Open this Exercise's folder on GitHub",
      // The only instruction on this step: the toolchain is the reader's to
      // install, and the command only works from the folder's tests/
      // directory. Both follow the Module's Category language.
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
