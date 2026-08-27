/**
 * Kata's one shipped pack today (#112). Authored nested, exactly the shape
 * `tools/strings-check.ts` and `src/strings/strings.ts` flatten on `.` —
 * `{"module":{"sectionLabel":{"exercises":…}}}` is read as
 * `module.sectionLabel.exercises`, matching `stringsKeys.ts`'s dot-paths.
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
    readyToStart: 'Ready to start',
  },

  // A Category's practice language, as a reader would name it (#163) — read
  // through `LANGUAGE_LABEL_KEY` in src/strings/language.ts, never by
  // hand-mapping the `CategoryLanguage` value at a call site.
  language: {
    csharp: 'C#',
    python: 'Python',
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

  selfCheck: {
    heading: 'Self-Check',
    // What a Self-Check is (#157) — the keeper test's fourth clause
    // (design/issue-guide.md § UI copy ban list): the heading above it uses
    // the term as a label, and nothing else on the screen says the questions
    // are optional or that an answer is kept rather than sent. Wording from
    // docs/ubiquitous-language.md § Self-Check; one clause, and no state
    // language — answering changes nothing but the answer.
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
    confirmSummary: '{selfChecks} — replace current progress?',
    confirmReplace: 'Replace progress',
    confirmCancel: 'Cancel',
    selfCheckNoun: 'Self-Check',
    importReplacedAnnouncement: 'Progress replaced — {selfChecks} imported.',
    importParseError: 'Not a Kata progress file — {reason}. Current progress is unchanged.',
    importFailedError: 'Import failed — {reason}. Current progress is unchanged.',
  },
};

export default en;
