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
    // Trimmed to the value (#113): "Module NN gate" carries live data; the
    // rest was prose wrapped around it.
    meta: 'Module {ordinal} gate',
    submitLabel: 'Submit Behavioral Checklist',
    // Trimmed (#113): the first sentence is the only instruction on the
    // step and survives; the second was an explainer.
    note: 'Answer all three checks to submit.',
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
