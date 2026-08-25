# Writing GitHub issues for the Kata design

Issues are the contract between this design package and the code. Keep them small, behavioral, and written in the project's exact vocabulary.

## Ground rules
1. **Ubiquitous language, always.** Module, Concept Page, Model Example, Exercise, Smell, Target Interface, Test Suite, Exit Gate, Behavioral Checklist, Checkpoint, Exercise Spec, Curriculum — exactly as defined in `docs/ubiquitous-language.md`. Test Suite is a live term: it stopped being a gate condition, not the point of the practice — the learner runs it in their own IDE and the app never sees the result. Banned in titles and bodies: *lesson, course, level, quiz, flashcard, grade, score*, plus everything in `docs/ubiquitous-language.md` § Removed terms. Say **Target Interface** (domain) or C# `interface` (code) — never "interface" alone.
2. **One issue = one verifiable slice.** A screen state, a flow, or one Target Interface's read path — never "build the Module screen" in one issue.
3. **Acceptance criteria are behavioral**, in the spirit of the Behavioral Checklist: checkable by doing, not by taste.
   - Good: "Clicking a locked Module row does nothing; cursor shows `not-allowed`."
   - Good: "Submit stays disabled until all three checks have an answer."
   - Bad: "Locked rows should feel clearly disabled." / "The gate panel looks clean."
4. **Reference, don't restate.** Point at `README.md` sections, `screens/*.png`, `tokens.json` keys, and `docs/engineering.md` interfaces instead of re-describing the design. If an issue needs prose the README doesn't have, the README is missing something — fix it there first.
5. **Design changes flow doc-first.** If implementation pressure suggests changing a Target Interface or a screen, the issue's outcome is an edit to `docs/engineering.md` / this package — never code that drifts from the docs.
6. **Verification grows with the product.** Every issue that adds a route, an asset, or a content file carries an acceptance criterion adding a matching check line to `scripts/smoke.sh` (the standing convention in `scripts/README.md`). Instruct verification through the terse-output scripts — one line on success, read the log only on FAIL.

## UI copy ban list and the interaction-depth question (house UI standard, #115)

The house UI standard requires every app to declare its own copy ban list on
its issue template — "the list is per-app; having one is the rule" — and to
carry one review question that cannot be checked mechanically. This section
is the source; `.github/ISSUE_TEMPLATE/screen-or-flow.md` reproduces it
verbatim rather than pointing back here, so the author never has to go find
it. If the two ever disagree, this section is the one to trust and the
template gets fixed to match.

**Kata's copy ban list** — words and constructions this app does not ship:

- *streak*, *daily goal*, *days left*, *% complete*, *XP*, *score* — Kata is
  checkpoint-based and says so; none of these exist in its model.
- *just*, *simply*, *easy* — reassurance words in instructional copy.
- Any string implying the app judges the learner's code. Kata is read-only
  and never runs anything.

This is a **different list** from ground rule 1's vocabulary ban (*lesson,
course, level, quiz, flashcard, grade, score*, plus `docs/ubiquitous-language.md`
§ Removed terms): that one is Kata's domain vocabulary, checked against every
issue. This one is UI writing style, checked against copy a screen renders.

**The keeper test** (#113) for any new copy an issue adds: a string survives
only if it (1) carries live data — a count, a date, a name; (2) is the only
instruction on a step; (3) guards a destructive action; or (4) it is the
first-use definition of a term the UI then uses as a label. Everything else is
a read-once explainer and does not ship.

**The interaction-depth review question**, asked on every issue that touches
a screen:

> Does this add a second way to reach the same content?

The answer must be no. A detail screen's list row is a link to it, never a
disclosure alongside one — two affordances to the same content is a decision
the learner pays for on every visit (`design/README.md` and #115's own issue
body carry the full rule). This one cannot be tested mechanically — no
`aria-expanded`, no `<details>`, no `scripts/smoke.sh` line catches it — which
is exactly why it is a standing review question rather than a one-off fix.

## Issue anatomy

```markdown
Title: [Screen] — [slice]            e.g. Curriculum — Module rows with lock chain

## Context
Build-order step (docs/engineering.md § 7) and one sentence of intent.

## Scope
The exact slice: screen, states covered, data source (which Target Interface).

## Design references
- README.md § <section>
- screens/<nn>-state.png
- tokens.json → <keys used>

## Acceptance criteria
- [ ] Behavioral, checkable statements only (see ground rule 3)
- [ ] Include the negative cases (locked, empty, pending)
- [ ] A scripts/smoke.sh line for any new route, asset, or content file

## Out of scope
What this issue deliberately does not touch (next slice, other states).
```

## Slicing that matches the build order
Follow `docs/engineering.md` § 7 — thinnest end-to-end slice first:
1. **Foundation:** the docs, the Vite scaffold on GitHub Pages, the PWA baseline, and the terse-output check scripts (`scripts/README.md`). Nothing user-visible yet beyond the shell.
2. **Read path:** content schema + the five-Module index as committed JSON, `ICurriculum`, then the Curriculum, Module, and Exercise screens read-only. Real content for Module 1 lands here; the app is useful for reading on day 1.
3. **Progression loop:** `IProgress` over IndexedDB, the Behavioral Checklist form, the Exit Gate aside and poster, the Checkpoint write, the Curriculum unlock cascade. The loop closes here.
4. **Content packs:** Modules 2–5 (Concept Pages, Model Examples, checklist questions, briefs) plus the committed exercise folders — drafted with the authoring scripts (`scripts/draft-concept.mjs`, `scripts/draft-exercise.mjs`), human-edited, committed; CI compiles every exercise folder.
5. **Polish:** the pending-Module placeholder, progress export/import, and the design-fidelity sweep against `screens/`.

Labels in use: `screen:curriculum | screen:module | screen:exercise`, `area:frontend | area:content | area:tooling | area:docs`, `design-fidelity` (for pixel gaps against `screens/`), `language` (for vocabulary violations). If an issue needs a build-order marker, use `slice:1..5` matching the steps above.

## Before you file — 30-second check
- [ ] Title names a screen + slice, in ubiquitous language
- [ ] Every criterion is checkable by clicking or reading the DOM
- [ ] States covered are named (locked / fresh / in progress / passed / submitted / pending)
- [ ] No value hard-coded in the issue that `tokens.json` already carries
- [ ] Nothing asks for streaks, scores, timers, a code editor, or anything about the state of the learner's code (explicit non-goals)
- [ ] No new copy in the issue uses a word from the UI copy ban list above, and any new copy passes the keeper test
- [ ] If the issue touches a screen: answered "no" to "Does this add a second way to reach the same content?"

## Worked example

The live version of this example shipped as issue #10.

```markdown
Title: Curriculum — Module rows with lock chain

## Context
Build-order step 2 (read path): the first real screen.
Makes the app useful for reading on day 1.

## Scope
Curriculum screen at the root route. Rows for all five Modules from
ICurriculum.getModules(), ordered by ordinal. Content is committed JSON under
public/content/; lock state is derived at read time by ICurriculum in the
browser from stored Checkpoints, never persisted. No navigation into locked
Modules. Header block included.

## Design references
- README.md § Screens › 1. Curriculum
- screens/01-state.png
- tokens.json → layout.curriculumRow, semantics.locked, color.accentRamp

## Acceptance criteria
- [ ] Five rows render in fixed order 01–05 with a 2px top rule each and a closing rule
- [ ] Passed Module shows the accent "Exit Gate passed" tag and "Checkpoint · <date>"
- [ ] Locked rows render at 0.5 opacity with a lock icon; click does nothing; cursor is not-allowed
- [ ] Unlocked rows show hover tint and navigate to the Module screen on click
- [ ] With empty IndexedDB: Module 1 is unlocked and 2–5 are locked
- [ ] Nav shows "Checkpoints n / 5" where n = count of Checkpoints, not a percentage
- [ ] No text on the screen uses a banned term
- [ ] scripts/smoke.sh gains a check line: the root route serves the Curriculum screen markup

## Out of scope
Module screen content (own issue); the Checkpoint write and unlock cascade
(build-order step 3).
```
