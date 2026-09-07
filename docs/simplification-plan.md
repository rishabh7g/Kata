# Kata — the simplification plan

The rung pass (rung #386–#408, September 2026) cut a nine-course app to what a learner
touches. This plan applies the same method to Kata. It is a plan, not a record: every
number below is the baseline measured on 2026-09-06 at `6cc7eec`, and every target is
what a batch is expected to leave behind.

## The method, carried over from rung

- **Measure first, at 360px.** Every screen issue opens with the screen's height in
  viewports and the y of the thing the reader came for, and closes with the same two
  numbers after. A claim without a measurement is a taste.
- **Said once.** A fact appears on a screen once. A rule appears in the code once. A
  comment that repeats the code, or the issue that removed something, is a second copy.
- **Lead with the action.** What the reader came to do sits above the fold at 360px.
- **No machinery on screen.** Nothing renders that the reader cannot act on.
- **No vestiges.** Nothing describes, styles, tests or guards a thing that no longer
  exists. `git log` keeps the history; the tree keeps the present.
- **Keep the contract tests, cut the render tests.** A test earns its place by catching
  a bug the build cannot. A test that re-asserts the stylesheet or the JSX is the build
  said twice. The trade is stated in the PR body, not hidden: rendering regressions will
  reach `main`, and the repo's own rule (verify on the running instance before closing)
  is the check that replaces them.
- **A rule the build cannot see decays on the next PR.** A rule worth keeping is encoded
  in `tsc` or the content validator, never in a comment.
- **Scoping.** One issue per surface, one PR per issue, squash-merge. A batch is a
  contiguous issue range whose last issue is always the docs. Each PR body carries the
  before and after numbers.

## Where Kata stands

The product is already small: three screens, four routes, three runtime dependencies,
one persisted record type. The last twenty commits did the product-level cut (the
Library reframe, the Self-Check, `IProgress` v2, the token and brand sweeps). What is
left is the weight *around* the product, and one screen fault.

Baseline:

- 240 tracked files, 29,207 lines. `src/` non-test code is 3,246 lines, of which
  **1,042 are comment lines (32%)**, citing 362 issue numbers.
- Tests: 30 files, 396 cases, 12.4 s. Of those, 135 cases (2,647 lines) render screens
  in jsdom, 48 cases (827 lines) regex the stylesheet, 37 cases (684 lines) spawn shell
  scripts.
- `design/`: 27 files, 6,431 lines. The build reads three of them: `styles.css`,
  `tokens.json`, `fonts/archivo-latin.woff2`.
- `scripts/`: 27 files, 3,481 lines. CI runs one of them, `validate-content.mjs`.
- Strings: 120 keys in one English pack, every key referenced, checked by a 189-line
  tool at build time.
- Build: 1.4 s. Bundle 82 KiB gzip.
- Screens at 360 × 740, built app:
  - Curriculum: **4.79 screens**; first Module row at **y = 690**, the fold is 740;
    backup footer at y = 3282.
  - Module m01: **13.2 screens**; Self-Check at **y = 8841**, below the Exercises at
    8133, while its own copy says "answer them as you read".
  - Module ai03: **17.6 screens**, 2,689 words on screen.
  - Exercise m01-e1: 2.0 screens. Fine.
- Vestiges: `pending` is a required index field, a `ModuleDetail` field and a branch in
  three sections of the Module screen, and no Module is pending. Every pack opens with
  a `# title` and a provenance line that two runtime regexes strip before render.

## What Kata does not have, so this plan does not touch

No settings screen, no sessions or phases, no state migrations, no payload ceilings, no
multi-locale bundles. Do not add any of them, and do not add a linter, a formatter, an
e2e suite, or Python Exercises to the Agentic AI Category. Each would be machinery.

## The batches, in order

Tests go first, as they did in rung: the screen work should not drag 135 render cases
behind it.

### Batch C — Tests: keep what the build cannot check

- Keep: `curriculum.test.ts`, `progress.test.ts`, `sw.test.ts`,
  `service-worker-plugin.test.ts`, `validate-content` (already in CI),
  `http-content-source.test.ts`.
- Cut: the five screen test files, the eight `src/styles/*.test.ts` stylesheet scans,
  `harness.test.ts` (goes with Batch D), `fonts.test.ts`, `shellPurity.test.ts`,
  `manifest.test.ts`, `App.test.tsx`, `bootstrap.test.tsx`, `StandaloneZoomLock.test.tsx`,
  `language.test.ts`, `register.test.ts`.
- Replace the stylesheet scans with one hand-run measurement script (Playwright against
  `vite preview`, the one this plan's numbers came from) committed under `tools/`, run
  and quoted in every screen PR. Reported, never gated.
- Target: ~6 files, under 100 cases, under 3 s.

### Batch A — Screens, measured at 360px

- **A1 Curriculum leads with the rows.** The rows are the screen. Cut the slogan-as-title
  ("Learn design by producing code.") to the one word the nav already says or drop the
  `h1`. Cut the three-line orientation block to one line or none: "stored in this browser
  only" is said again by the backup note and the progress-unavailable notice. Drop the
  `Ready to start` tag: it is "no answers saved" printed eleven times; keep `In progress`
  alone. Target: first row above y = 300, under 3 screens.
- **A2 Module: the Self-Check sits where the copy says it is.** On a phone the aside
  lands after the Exercises, twelve screens down. Place it after the Concept Page and
  before the Model Examples in source order, and let the 1024px grid keep it beside the
  prose. Drop the `Concept Page` section label over the prose: the prose is the page.
  Remove the `pending` state end to end: schema, `contract.ts`, `ModuleDetail`, the
  three `module.pending.*` strings and the three branches. Target: Self-Check within
  one screen of the end of the prose.
- **A3 Exercise: one statement of "do not change it".** The `Immutable` tag, the
  definition and the note say it three times; keep the tag and the definition. One
  `Refactor` / `Construct` string pair, not two (`module.exercise.tag*` and
  `exercise.tag*Type`). One `ArrowRightIcon`. One load/error/redirect guard shared by the
  Module and Exercise screens.
- **A4 The backup footer.** 219 lines of `alertdialog`, focus return, Escape handling
  and a live region protect eleven records of radio picks, which the component's own
  comment says cost "at most re-picking a radio" to lose. Recommendation: delete
  export/import entirely, and with it `backup.ts`, `ProgressBackup.tsx`, their tests, 13
  strings and the two `IProgress` methods. Fallback if the owner keeps it: two buttons
  and a native `window.confirm`, ~60 lines. This one is the owner's call.

### Batch B — Code said once

- **B1 Comments describe the present.** Rule: a comment says what the code does now,
  not what it replaced or which issue changed it. Delete every sentence naming a removed
  thing (Checkpoint, Exit Gate, gate panel, Workbench, DevGym, "used to", "no longer",
  "historical", "the prototype's"). Issue numbers go to `git blame`. Target: comment
  lines under 10% of code.
- **B2 One implementation, no seam.** Inline `ContentSource` into `curriculum.ts` (one
  HTTP implementation, fakes only in tests). Drop the `createProgress(databaseName?)`
  parameter. Delete `src/progress/contract.ts` (a re-export shim).
- **B3 The strings layer for one locale.** `stringsKeys.ts`, `strings.ts`, `en.ts`,
  `tools/strings-check.ts` and its test are ~700 lines and a build step guarding one
  English pack against itself. Collapse to one typed `copy.ts` object; `tsc` is the
  check; the build step and the shell-purity scan go. A second locale, if it ever comes,
  is a second object.
- **B4 The contract lives in one place.** The `ICurriculum` / `IProgress` block exists
  in `docs/engineering.md` § 2, `src/curriculum/contract.ts` ("verbatim copy") and the
  shim. `contract.ts` is the source; the doc links to it.

### Batch D — Tooling: delete what nothing runs

- Every Module is authored and the Agentic AI Category is explain-only by design, so the
  authoring generators have no next customer. Delete `draft-concept.mjs`,
  `draft-exercise.mjs`, `scripts/lib/`, `scripts/fixtures/`, their tests, `smoke.sh`
  (693 lines, 23 exit codes, five of them one-per-Module), `build-exercises.sh`,
  `test-scoped.sh`, `scripts/README.md`.
- Keep `validate-content.mjs` (the content gate) and `generate-icons.mjs` (committed
  output). Keep `build-exercises.sh`, run by hand: it is the one check the Exercise folders have.
- Move `sizeBudgetLoc ≤ 300` from the deleted generator into `validate-content.mjs`, as a
  report line, not a failure.

### Batch E — `design/` keeps the three files the build reads

- Delete `support.js` and `brand/support.js` (byte-identical, 1,911 lines each), `_ds/`,
  `DevGym.dc.html`, `brand/*.dc.html`, `assets/devgym-mark.svg`, `screens/*.png`
  (documented as pre-reframe and historical), `issue-guide.md` (fold its keeper test into
  `docs/design.md` in four lines).
- Move `design/styles.css` beside `src/styles/app.css`: one stylesheet directory.
- `tokens.json`: after Batch C its only readers are `app.css` comments, `index.html`'s
  theme colour and `generate-icons.mjs`. Fold the consumed values into CSS custom
  properties and delete the file, or trim it to the keys with a reader. Delete is the
  recommendation.
- `design/README.md` becomes a page about what remains, or is folded into
  `docs/design.md`.

### Batch G — Content said once

- Strip the `# title` and the provenance line from all eleven packs. Provenance moves to
  a `provenance` string field the schema allows and no screen reads. Delete
  `stripLeadingTitle` and `stripConceptNote`.
- `validate-content.mjs` reports words per Concept Page. Reported, never gated. The six
  Agentic AI pages run 1,110–2,163 words against 788–1,019 for Software Design; whether
  that is a ceiling is the owner's editorial call after reading, not the validator's.

### Batch F — Docs, last, and the last issue of every batch

- `README.md`: § Naming collapses to one sentence once the historical files are gone;
  § Status drops "being brought to it one issue at a time"; the start-here table lists
  what exists.
- `docs/engineering.md` (612 lines): delete § 5 authoring workflow, § 7 build order and
  § 9 superseded decisions (git has them); § 2 links to `contract.ts`.
- `docs/ubiquitous-language.md`: delete § Removed terms.
- The screen descriptions exist in `design/README.md` and `docs/engineering.md`; keep one.
- Retake nothing: after Batch E there are no screenshots to keep current.

## Targets

- Lines: 29,207 → under 12,000.
- Test files 30 → ~6; cases 396 → under 100; run 12.4 s → under 3 s.
- `src/` comment lines 32% → under 10%; issue references in `src/` 362 → 0.
- `design/` 27 files → 4. `scripts/` 27 files → 2.
- Strings: 120 keys through a checker → one typed object, no build step.
- Curriculum at 360: first row above y = 300, under 3 screens.
- Module at 360: Self-Check within one screen of the prose it asks about.
- Build stays under 2 s; bundle stays under 85 KiB gzip.

## Owner decisions this plan needed

All three were settled as recommended and are implemented:

- The backup footer is deleted (#215). The reader's answers now live in one
  browser with no way out; the fallback, two buttons behind a native confirm,
  is about 60 lines if it is ever wanted.
- The strings layer is one typed object (#218).
- There is no word ceiling. `validate-content.mjs` reports words per Concept
  Page and gates nothing (#223).

## What the plan got wrong

Recorded here rather than quietly fixed, because a plan is only useful if its
misses are visible:

- **Batch order.** B3 ran before Batch A. With a canonical key list, a
  placeholder table and a pack to keep in step, every copy change in the screen
  issues would have been three edits instead of one.
- **build-exercises.sh.** Batch D proposed deleting it because
  the Exercises workflow "builds and collects the folders already". That
  workflow only delegated to this script (and has since been removed); the
  script is the only check the committed practice material has, and it stayed.
- **The Curriculum's y=300 target** (#212) was not met and was the wrong test.
  What sits above the first row is the nav, the title, one line, and a Category
  heading — and a Category heading is content. The fold is what mattered, and
  the first row moved from y=690 to y=374 against a 740px fold.
- **The 10% comment target** (#216) was not met either: 29% became 25%. Every
  issue reference and every mention of a removed thing is gone, which was the
  actual rule; what remains explains decisions the code cannot state itself,
  and deleting it to reach a ratio would have been the wrong trade.
- **sizeBudgetLoc** did not need moving into the validator: the schema already
  caps it at 300.
