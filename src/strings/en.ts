/**
 * Kata's one shipped pack today (#112). Authored nested, exactly the shape
 * `tools/strings-check.ts` and `src/strings/strings.ts` flatten on `.` —
 * `{"gate":{"condition":{"notSubmitted":…}}}` is read as
 * `gate.condition.notSubmitted`, matching `stringsKeys.ts`'s dot-paths.
 *
 * Adding a second pack (a future locale) is adding a sibling file in this
 * shape and pointing `src/strings/strings.ts` at it — no change to any
 * screen, which reads copy only through `useStrings()`.
 */
const en = {
  notice: {
    progressUnavailable: {
      title: 'Kata cannot open its progress database',
      body1:
        "Kata keeps your Checkpoints and Behavioral Checklist answers in this browser and nowhere else, and this browser will not let it open that storage. Site data is blocked for {origin}, or this window is a private or hardened mode that blocks it.",
      body2:
        'Allow site data for {origin} and reload the page. Checkpoints already recorded are untouched — they are still in the browser that recorded them.',
    },
    moduleUnavailable: {
      title: "This Module's content is not available",
      body1Before: 'Kata reads this Module from',
      body1After:
        ', fetched the moment you open it, and that request failed. A Module is stored for offline use as it is read — so one you have not opened online yet is not available offline.',
      body2:
        'Reconnect and try again. Nothing is lost: your Checkpoints and Behavioral Checklist answers live in this browser, not in the file that failed to load.',
      retry: 'Try again',
    },
  },

  shell: {
    backToCurriculum: 'Curriculum',
    checkpointCount: 'Checkpoints {passed} / {total}',
  },

  status: {
    gatePassed: 'Exit Gate passed',
    inProgress: 'In progress',
    readyToStart: 'Ready to start',
  },

  gate: {
    checkpointLine: 'Checkpoint · {date}',
    label: 'Exit Gate',
    // The two definitions the gate panel carries (#135), each the first
    // place the UI explains a word it then uses as a label — the keeper
    // test's fourth clause (design/issue-guide.md § UI copy ban list).
    // Wording from docs/ubiquitous-language.md: the Exit Gate is the
    // Module's pass condition, a Checkpoint the recorded passage through
    // one. One clause each; nothing about who judges the code (#137 owns
    // the self-report wording).
    definition:
      "The Exit Gate is this Module's pass condition — passing it unlocks the next Module.",
    checkpointDefinition:
      'A Checkpoint is a recorded passage through an Exit Gate, counted in the nav.',
    passedLine: 'Passed.',
    nextModuleLine: 'Module {ordinal} — {title} unlocked.',
    allModulesPassedLine: 'All five Modules passed — the Curriculum is complete.',
    pendingNote:
      'The Behavioral Checklist arrives with the Concept Page — nothing to submit yet.',
    condition: {
      title: 'Behavioral Checklist submitted',
      submitted: 'Submitted',
      notSubmitted: 'Not yet submitted',
    },
    exercisePassedLine: 'Exit Gate passed — Checkpoint recorded.',
  },

  curriculum: {
    title: 'Learn design by producing code.',
    // The orientation block (#134): three first-use definitions, each the
    // first place the UI explains a word it then uses as a label — the
    // keeper test's fourth clause (design/issue-guide.md).
    orientation: {
      module: 'A Module is one concept: read it, then do its Exercises.',
      ownIde:
        'You write and run the C# in your own IDE. Kata never runs or sees your code.',
      browserOnly: 'Your progress is stored in this browser only.',
    },
    row: {
      locked: "Locked — pass the previous Module's Exit Gate to unlock it.",
    },
  },

  module: {
    ordinalLabel: 'Module {ordinal}',
    tabTitle: 'Module {ordinal} — {title}',
    sectionLabel: {
      conceptPage: 'Concept Page',
      modelExamples: 'Model Examples',
      exercises: 'Exercises',
    },
    pending: {
      conceptPage:
        'Concept Page pending — drafted by the Generator once this Module unlocks; one human edit, then frozen.',
      modelExamples: 'Model Examples arrive with the Concept Page.',
      exercises: 'No Exercises yet — the first is generated from an Exercise Spec.',
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

  exercise: {
    kicker: 'Exercise {id} · Module {ordinal}',
    tagRefactorType: 'Refactor-type',
    tagConstructType: 'Construct-type',
    sectionLabel: {
      spec: 'Exercise Spec',
      targetInterface: 'Target Interface',
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
      // The first place the app says what a Target Interface IS (#136) —
      // the keeper test's fourth clause (design/issue-guide.md § UI copy
      // ban list, #133): the section heading, the Spec grid and the
      // `Immutable` tag all label it before anything defines it. Wording
      // from docs/ubiquitous-language.md; one clause, and the full term
      // every time, never "interface" alone (issue-guide ground rule 1).
      definition:
        'The Target Interface is the boundary you must end up with — the Test Suite is written against it, and you may not change it.',
      // Trimmed (#113): the `Immutable` tag already says "don't touch it";
      // this keeps only the one instruction clause.
      note: 'Wanting to change it is a signal to record and discuss — not an allowed move.',
    },
    practiceMaterial: {
      pending:
        "This Exercise's folder is not committed yet — the GitHub link appears here once it is.",
      linkLabel: "Open this Exercise's folder on GitHub",
      noteBefore: 'Clone or copy the folder, review its Test Suite before starting, and run',
      noteAfter: 'in your own IDE.',
    },
  },

  checklist: {
    heading: 'Behavioral Checklist',
    // What the checklist IS, said once under its heading (#136) — the
    // keeper test's fourth clause: the heading, the Module gate's condition
    // row and the submit button all use the term as a label first. Wording
    // from docs/ubiquitous-language.md: the Exit Gate's one condition,
    // self-assessed. One clause; #137 owns what a "No" answer means.
    definition:
      "The Behavioral Checklist is the Module's one Exit Gate condition, self-assessed.",
    // Trimmed to the value (#113): "Module NN gate" carries live data; the
    // rest was prose wrapped around it.
    meta: 'Module {ordinal} gate',
    submitLabel: 'Submit Behavioral Checklist',
    // The only instruction on the step — the keeper test's second clause,
    // which is why the first sentence survived the copy pass (#113).
    //
    // Extended (#137) to close the app's biggest comprehension gap: three
    // yes/no questions with a Submit button read as a test that can be
    // failed, and no answer is read as a condition anywhere — submitting
    // alone is the Exit Gate (docs/design.md § Pedagogy). So the note says
    // what submitting does and what a "No" means; `checklist.definition`
    // (#136) above the checks says what the checklist IS, and neither
    // repeats the other. "back to the code" is the learner's own IDE:
    // Kata never runs, reads or judges it.
    note:
      'Answer all three checks to submit, and answer them honestly — this is a self-report on your own work. Submitting records the Checkpoint whatever you answer, so a "No" is a signal to go back to the code, not a blocker.',
    submittedLine: 'Submitted · {time}',
  },

  backup: {
    exportLabel: 'Export progress',
    importLabel: 'Import progress',
    fileInputLabel: 'Progress file',
    // Trimmed to the value (#113): {fileName} is live data, and "Import
    // replaces…" guards the destructive action; the framing sentence
    // around them ("Backup as a file: export downloads…") went.
    note: "{fileName}. Import replaces current progress with a file's contents.",
    confirmDialogLabel: 'Confirm import',
    confirmSummary: '{checkpoints}, {checklists} — replace current progress?',
    confirmReplace: 'Replace progress',
    confirmCancel: 'Cancel',
    checkpointNoun: 'Checkpoint',
    checklistNoun: 'checklist',
    importReplacedAnnouncement: 'Progress replaced — {checkpoints}, {checklists} imported.',
    importParseError: 'Not a Kata progress file — {reason}. Current progress is unchanged.',
    importFailedError: 'Import failed — {reason}. Current progress is unchanged.',
  },
};

export default en;
