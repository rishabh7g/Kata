/**
 * The canonical strings contract (#112) — the ONE list of UI-copy keys the
 * shell may render.
 *
 * The owner's rule: "I like the way in the Rung app all the keys are stored
 * separately, and it will help in the future if we want to do the
 * localization or internationalization of the app." A missing key is a BUILD
 * FAILURE (`tools/strings-check.ts`), not a fallback — that is only safe
 * because there is no fallback copy anywhere in the shell (`shellPurity.test.ts`
 * proves it). A key that slipped through missing would be a blank screen for
 * the learner, not an English word.
 *
 * It lives HERE, in the app, and the build tool imports it — never the
 * reverse. A `tools/` module the app bundle imports is how a second copy of
 * the list gets born, which is the one thing this file exists to prevent
 * (shape copied from `~/dev/shidi`'s `src/course/stringsKeys.ts`, #112).
 *
 * Two tables, welded together by the type system: `STRINGS_KEYS` is the
 * list, and `STRINGS_PLACEHOLDERS` is `Record<StringsKey, …>`, so a key added
 * to one without the other fails `tsc`.
 *
 * Keys are DOT-PATHS into a nested object: `module.sectionLabel.exercises` is
 * the path to `{"module":{"sectionLabel":{"exercises":…}}}`, which is how
 * `src/strings/en.ts` is written. The checker and the runtime loader both
 * flatten before comparing.
 *
 * **Not every English word in the app is a key.** Section labels, kickers on
 * icon-only affordances, and code-adjacent tokens the design calls furniture
 * stay out — see `src/shellPurity.test.ts` for the exact rule this list is
 * checked against. The product name "Kata" itself is not a key either: like
 * the reference app's own `brand.ts`, a product name is not translatable
 * prose, and it stays the one place it already lived —
 * `src/app/useDocumentTitle.ts`'s `APP_TITLE`.
 */

/* ------------------------------------------------------------------ the list */

/**
 * Every key of a complete pack, grouped by the screen or shell surface that
 * reads it, in the order those surfaces appear in the app: the failure
 * notices any screen can raise, the shared status tags, then Curriculum,
 * Module, its Self-Check, Exercise, and Progress Backup.
 */
export const STRINGS_KEYS = [
  // The app's one failure surface (Notice.tsx), raised by two callers.
  'notice.progressUnavailable.title',
  'notice.progressUnavailable.body1',
  'notice.progressUnavailable.body2',
  'notice.moduleUnavailable.title',
  'notice.moduleUnavailable.body1Before',
  'notice.moduleUnavailable.body1After',
  'notice.moduleUnavailable.body2',
  'notice.moduleUnavailable.retry',

  // The back link every drill-down screen offers to the Curriculum. The nav's
  // live Checkpoint count went with the lock chain (#156): the Library never
  // measures the reader, so permanent chrome has nothing to count.
  'shell.backToCurriculum',

  // The Curriculum row tags — the only status vocabulary left. `gatePassed`
  // and the Checkpoint date line went with the Module header tag (#157):
  // both named a removed term, and the Library measures no reader.
  'status.inProgress',
  'status.readyToStart',

  // Curriculum screen. `curriculum.kicker` ("Curriculum — fixed order,
  // foundations down") and `curriculum.intro` ("Five Modules. Advance by
  // passing each Exit Gate…") were removed on the read-once copy pass
  // (#113) — both were pure explainer, read once and skimmed past forever
  // after, and neither carried live data, instructed a step, or guarded a
  // destructive action.
  'curriculum.title',
  // The orientation block (#134): what a Module is and the read-then-do
  // order, where the C# gets written, and where progress lives. Restored
  // under the keeper test's fourth clause — a first-use definition of a term
  // the UI then uses as a label ("Module" heads every row below it).
  'curriculum.orientation.module',
  'curriculum.orientation.ownIde',
  'curriculum.orientation.browserOnly',
  // `curriculum.row.locked` — the reason an inert row was inert — went with
  // the rows' lock states (#156): every row is a link, so there is no reason
  // left to give.

  // Module screen.
  'module.ordinalLabel',
  'module.tabTitle',
  'module.sectionLabel.conceptPage',
  'module.sectionLabel.modelExamples',
  'module.sectionLabel.exercises',
  'module.pending.conceptPage',
  'module.pending.modelExamples',
  'module.pending.exercises',
  'module.example.before',
  'module.example.after',
  'module.exercise.tagRefactor',
  'module.exercise.tagConstruct',

  // The Module's Self-Check (#157) — its heading and the one clause that
  // says what a Self-Check is, kept by the keeper test's fourth clause. The
  // whole `gate.*` block went with the Exit Gate: no poster, no condition
  // row, no pending note and no banner, because nothing is passed. So did
  // `checklist.submitLabel` / `checklist.submittedLine` / `checklist.meta`
  // and the self-report note — there is no submission to label, time or
  // scope.
  'selfCheck.heading',
  'selfCheck.definition',

  // Exercise screen.
  'exercise.kicker',
  'exercise.tagRefactorType',
  'exercise.tagConstructType',
  'exercise.sectionLabel.spec',
  'exercise.spec.concept',
  'exercise.spec.smell',
  'exercise.spec.sizeBudget',
  'exercise.spec.sizeBudgetValue',
  'exercise.sectionLabel.targetInterface',
  'exercise.targetInterface.immutableTag',
  // What a Target Interface is (#136) — the first-use definition of a term
  // the section heading, the Spec grid and the `Immutable` tag all label,
  // kept by the keeper test's fourth clause.
  'exercise.targetInterface.definition',
  'exercise.targetInterface.note',
  'exercise.sectionLabel.practiceMaterial',
  'exercise.practiceMaterial.pending',
  'exercise.practiceMaterial.linkLabel',
  'exercise.practiceMaterial.noteBefore',
  'exercise.practiceMaterial.noteAfter',

  // Progress Backup.
  'backup.exportLabel',
  'backup.importLabel',
  'backup.fileInputLabel',
  'backup.note',
  'backup.confirmDialogLabel',
  'backup.confirmSummary',
  'backup.confirmReplace',
  'backup.confirmCancel',
  'backup.checkpointNoun',
  'backup.checklistNoun',
  'backup.importReplacedAnnouncement',
  'backup.importParseError',
  'backup.importFailedError',
] as const;

/** A dot-path into a strings pack — the union of the canonical list. */
export type StringsKey = (typeof STRINGS_KEYS)[number];

/* ---------------------------------------------------------- the placeholders */

/**
 * The `{brace}` placeholders each value must carry — the same in every pack,
 * because the shell interpolates the same runtime values whatever the
 * language. Exhaustive by construction: `Record<StringsKey, …>` means a new
 * key needs a row here, even an empty one, so "did anyone decide about
 * placeholders?" is never an open question.
 */
export const STRINGS_PLACEHOLDERS: Readonly<Record<StringsKey, readonly string[]>> = {
  'notice.progressUnavailable.title': [],
  /** The site's origin, so the learner knows exactly what to allow. */
  'notice.progressUnavailable.body1': ['{origin}'],
  'notice.progressUnavailable.body2': ['{origin}'],
  'notice.moduleUnavailable.title': [],
  'notice.moduleUnavailable.body1Before': [],
  'notice.moduleUnavailable.body1After': [],
  'notice.moduleUnavailable.body2': [],
  'notice.moduleUnavailable.retry': [],

  'shell.backToCurriculum': [],

  'status.inProgress': [],
  'status.readyToStart': [],

  'curriculum.title': [],
  'curriculum.orientation.module': [],
  'curriculum.orientation.ownIde': [],
  'curriculum.orientation.browserOnly': [],

  /** The zero-padded ordinal — `Module {ordinal}` reads `Module 03`. */
  'module.ordinalLabel': ['{ordinal}'],
  /** The tab title while a Module is open — its own copy, not `document.title`. */
  'module.tabTitle': ['{ordinal}', '{title}'],
  'module.sectionLabel.conceptPage': [],
  'module.sectionLabel.modelExamples': [],
  'module.sectionLabel.exercises': [],
  'module.pending.conceptPage': [],
  'module.pending.modelExamples': [],
  'module.pending.exercises': [],
  'module.example.before': [],
  'module.example.after': [],
  'module.exercise.tagRefactor': [],
  'module.exercise.tagConstruct': [],

  'selfCheck.heading': [],
  'selfCheck.definition': [],

  /** The brief's own id and its Module's ordinal. */
  'exercise.kicker': ['{id}', '{ordinal}'],
  'exercise.tagRefactorType': [],
  'exercise.tagConstructType': [],
  'exercise.sectionLabel.spec': [],
  'exercise.spec.concept': [],
  'exercise.spec.smell': [],
  'exercise.spec.sizeBudget': [],
  /** The brief's LOC budget. */
  'exercise.spec.sizeBudgetValue': ['{loc}'],
  'exercise.sectionLabel.targetInterface': [],
  'exercise.targetInterface.immutableTag': [],
  'exercise.targetInterface.definition': [],
  'exercise.targetInterface.note': [],
  'exercise.sectionLabel.practiceMaterial': [],
  'exercise.practiceMaterial.pending': [],
  'exercise.practiceMaterial.linkLabel': [],
  'exercise.practiceMaterial.noteBefore': [],
  'exercise.practiceMaterial.noteAfter': [],

  'backup.exportLabel': [],
  'backup.importLabel': [],
  'backup.fileInputLabel': [],
  /** The fixed backup file name (`kata-progress.json`). */
  'backup.note': ['{fileName}'],
  'backup.confirmDialogLabel': [],
  /** Two already-pluralized counts: "3 Checkpoints", "1 checklist". */
  'backup.confirmSummary': ['{checkpoints}', '{checklists}'],
  'backup.confirmReplace': [],
  'backup.confirmCancel': [],
  'backup.checkpointNoun': [],
  'backup.checklistNoun': [],
  'backup.importReplacedAnnouncement': ['{checkpoints}', '{checklists}'],
  /** The parse/validation failure reason, from the thrown error. */
  'backup.importParseError': ['{reason}'],
  'backup.importFailedError': ['{reason}'],
};
