/**
 * The canonical key list for the shell's copy bundle (#240).
 *
 * `src/strings/copy.ts` is the pack — the words. This is the contract — which
 * words have to exist and which `{placeholders}` each one carries. Keeping the
 * two apart is the whole point: a bundle compared only against itself agrees
 * with itself no matter what has been added, emptied or misspelt, which is
 * exactly the state claude-setup#50 measured here (an unread key and an emptied
 * `curriculum.orientation` both passed the entire gate).
 *
 * It lives HERE, beside the pack, and `tools/strings-check.ts` imports FROM it —
 * never the reverse. A list that lived in `tools/` and was imported by the app
 * is how a second copy of it gets born.
 *
 * Keys are DOT-PATHS into the nested pack (`module.sectionLabel.exercises`), so
 * the pack keeps reading like a document rather than a flat table. Components
 * still reach the value by property access — `copy.module.sectionLabel.exercises`
 * — so `tsc` keeps catching a key that is read and then deleted. This list
 * catches the three things `tsc` cannot see: a key nothing reads yet, a value
 * emptied to `''`, and a placeholder that stopped matching.
 *
 * Two tables welded together by the type system: `COPY_KEYS` is the list, and
 * `COPY_PLACEHOLDERS` is `Record<CopyKey, readonly string[]>`, so a key added to
 * one and not the other is a `tsc` error before any check runs.
 *
 * Authored content — Modules, Exercises, Concept Pages — is deliberately not
 * here. It comes from `public/content/` and is validated against `schemas/` by
 * `scripts/validate-content.mjs` (the CONTENT stage), which is the same category
 * of thing done in the right place for it.
 */

/* ------------------------------------------------------------------ the list */

export const COPY_KEYS = [
  // ProgressUnavailable — the app instead of the app.
  'notice.progressUnavailable.title',
  'notice.progressUnavailable.body1',
  'notice.progressUnavailable.body2',

  // ModuleUnavailable.
  'notice.moduleUnavailable.title',
  'notice.moduleUnavailable.body1Before',
  'notice.moduleUnavailable.body1After',
  'notice.moduleUnavailable.body2',
  'notice.moduleUnavailable.retry',

  // AppShell.
  'shell.backToCurriculum',

  // Shared across screens.
  'status.inProgress',
  'language.csharp',
  'language.python',

  // Curriculum screen.
  'curriculum.title',
  'curriculum.orientation',

  // Module screen.
  'module.ordinalLabel',
  'module.tabTitle',
  'module.sectionLabel.modelExamples',
  'module.sectionLabel.exercises',
  'module.example.before',
  'module.example.after',

  // Self-Check, on the Module screen.
  'selfCheck.heading',
  'selfCheck.definition',

  // Exercise screen.
  'exercise.kicker',
  'exercise.tagRefactor',
  'exercise.tagConstruct',
  'exercise.sectionLabel.spec',
  'exercise.sectionLabel.targetInterface',
  'exercise.sectionLabel.practiceMaterial',
  'exercise.spec.concept',
  'exercise.spec.smell',
  'exercise.spec.sizeBudget',
  'exercise.spec.sizeBudgetValue',
  'exercise.targetInterface.immutableTag',
  'exercise.targetInterface.definition',
  'exercise.practiceMaterial.pending',
  'exercise.practiceMaterial.linkLabel',
  'exercise.practiceMaterial.noteBefore',
  'exercise.practiceMaterial.noteAfter',
] as const;

export type CopyKey = (typeof COPY_KEYS)[number];

/* ---------------------------------------------------------- the placeholders */

/**
 * The bare names inside each value's `{placeholders}` — what `interpolate` will
 * be asked to fill. Empty for the values that carry none, listed rather than
 * omitted so that adding a key here without deciding its placeholders is not
 * possible.
 */
export const COPY_PLACEHOLDERS: Readonly<Record<CopyKey, readonly string[]>> = {
  'notice.progressUnavailable.title': [],
  'notice.progressUnavailable.body1': ['origin'],
  'notice.progressUnavailable.body2': ['origin'],

  'notice.moduleUnavailable.title': [],
  'notice.moduleUnavailable.body1Before': [],
  'notice.moduleUnavailable.body1After': [],
  'notice.moduleUnavailable.body2': [],
  'notice.moduleUnavailable.retry': [],

  'shell.backToCurriculum': [],

  'status.inProgress': [],
  'language.csharp': [],
  'language.python': [],

  'curriculum.title': [],
  'curriculum.orientation': [],

  'module.ordinalLabel': ['ordinal'],
  'module.tabTitle': ['ordinal', 'title'],
  'module.sectionLabel.modelExamples': [],
  'module.sectionLabel.exercises': [],
  'module.example.before': [],
  'module.example.after': [],

  'selfCheck.heading': [],
  'selfCheck.definition': [],

  'exercise.kicker': ['id', 'ordinal'],
  'exercise.tagRefactor': [],
  'exercise.tagConstruct': [],
  'exercise.sectionLabel.spec': [],
  'exercise.sectionLabel.targetInterface': [],
  'exercise.sectionLabel.practiceMaterial': [],
  'exercise.spec.concept': [],
  'exercise.spec.smell': [],
  'exercise.spec.sizeBudget': [],
  'exercise.spec.sizeBudgetValue': ['loc'],
  'exercise.targetInterface.immutableTag': [],
  'exercise.targetInterface.definition': [],
  'exercise.practiceMaterial.pending': [],
  'exercise.practiceMaterial.linkLabel': [],
  'exercise.practiceMaterial.noteBefore': ['language'],
  'exercise.practiceMaterial.noteAfter': [],
};
