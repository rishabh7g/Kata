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
      // What is missing, in the learner's terms (#139). The old line named
      // the Generator and walked through drafting, one human edit and
      // freezing — the authoring pipeline (docs/ubiquitous-language.md
      // § System terms), which a learner has never heard of and cannot act
      // on. This says only what is true on screen: the section is the
      // pending Module's only Concept Page content, so without it the
      // section renders blank (keeper test clause 2, design/issue-guide.md).
      conceptPage:
        'Concept Page not written yet — there is nothing to read in this Module.',
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
      // Deliberately lower-case, unlike every label around it (#143). Title
      // case is a signal in this app, not decoration: Concept Page, Model
      // Examples, Exercises, Exercise Spec and Target Interface are all
      // domain terms in docs/ubiquitous-language.md, and the capitals are
      // what say "these words are used exactly". This section has no term of
      // its own — what it hands over is an Exercise folder and its Test
      // Suite, both already named — and the docs use the phrase as plain
      // description wherever it appears (ubiquitous-language.md § Test Suite,
      // docs/design.md § Pedagogy, design/README.md's "practice-material
      // link"). Capitalising it would either invent a term for something
      // that already has two names, or spend the signal on prose. It stays
      // lower-case: a decision, not an oversight.
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
      // The only instruction on this step (#141) — the keeper test's second
      // clause (design/issue-guide.md § UI copy ban list): nothing else on
      // the screen tells the learner how to get the Test Suite running, and
      // the two facts that decide whether it runs at all lived nowhere the
      // learner could read them BEFORE cloning. The .NET SDK is theirs to
      // install (Kata never runs anything, so a missing SDK is silence with
      // no explanation on screen), and `dotnet test` only works from the
      // Exercise folder's `tests/` directory — a fact that until now
      // appeared solely in the cloned folder's own README, one step too
      // late. Split around the one inline `<code>` the note carries;
      // `tests/` stays prose so the shell keeps exactly one allowed literal
      // (`src/shellPurity.test.ts` § ALLOWED_LITERALS).
      noteBefore:
        "Clone or copy the folder and review its Test Suite before starting. Running the Test Suite needs the .NET SDK installed on your own machine — from the Exercise folder's tests/ directory, run",
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
    // The line that says WHOSE gate this is (#138). It already carried live
    // data — the owning Module's ordinal — which is clause (1) of the keeper
    // test (design/issue-guide.md § UI copy ban list), and why the copy pass
    // (#113) trimmed it to "Module NN gate" instead of deleting it.
    //
    // The scope clause rides on that same live datum rather than shipping a
    // fourth string in one panel: the panel is keyed by `moduleId`, so both
    // of a Module's Exercise screens render this identical line, and a
    // learner reading it on `m01-e1` would otherwise take the gate for that
    // Exercise's own. Submitting from either Exercise passes Module 01
    // outright, so the ordinal without its scope is a half-told fact.
    //
    // Distinct from its two siblings and repeating neither: `definition`
    // (#136) says what the Behavioral Checklist IS, `note` (#137) says what
    // submitting does and what a "No" means, and this says which Module the
    // Exit Gate belongs to and how far it reaches.
    meta:
      'Module {ordinal} Exit Gate — covers every Exercise in the Module, not the one on screen.',
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
    //
    // Extended (#142) with the reason Export exists at all. The header's
    // orientation block already states the fact — "Your progress is stored
    // in this browser only" (curriculum.orientation.browserOnly, #134) — on
    // this same screen, so restating it here would be the third telling
    // (notice.progressUnavailable.body1 is the second). What the footer adds
    // is the consequence next to the button that acts on it: the file is the
    // only copy that exists anywhere else. The confirm stays a single
    // question; a warning read at the moment of replacing is later than the
    // learner can use it.
    note:
      "{fileName} is the only copy of your progress that exists outside this browser. Import replaces current progress with a file's contents.",
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
