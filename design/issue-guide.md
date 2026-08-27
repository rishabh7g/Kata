# Writing GitHub issues for the Kata design

Issues are the contract between this design package and the code. Keep them small, behavioral, and written in the project's exact vocabulary.

## Ground rules
1. **Ubiquitous language, always.** Library, Category, Module, Concept Page, Model Example, Self-Check, Exercise, Smell, Target Interface, Test Suite, Exercise Spec, Curriculum — exactly as defined in `docs/ubiquitous-language.md`. Test Suite is a live term: it stopped being a gate condition, not the point of the practice — the learner runs it in their own IDE and the app never sees the result. Banned in titles and bodies: *lesson, course, level, quiz, flashcard, grade, score, unlock, locked, gate, submit*, plus everything in `docs/ubiquitous-language.md` § Removed terms — **Exit Gate**, **Behavioral Checklist** and **Checkpoint** are removed terms, so an issue that needs the questions says **Self-Check**. Say **Target Interface** (domain) or C# `interface` (code) — never "interface" alone.
2. **One issue = one verifiable slice.** A screen state, a flow, or one Target Interface's read path — never "build the Module screen" in one issue.
3. **Acceptance criteria are behavioral**, in the spirit of the Self-Check's own questions: checkable by doing, not by taste.
   - Good: "Every Module row navigates to its Module screen on click."
   - Good: "Picking a Self-Check option persists without any button: reload restores it."
   - Bad: "Module rows should feel inviting." / "The Self-Check panel looks clean."
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

- *streak*, *daily goal*, *days left*, *% complete*, *XP*, *score* — Kata is a
  self-paced Library and says so; none of these exist in its model.
- *just*, *simply*, *easy* — reassurance words in instructional copy.
- Any string implying the app judges the learner's code. Kata is read-only
  and never runs anything.

This is a **different list** from ground rule 1's vocabulary ban (*lesson,
course, level, quiz, flashcard, grade, score, unlock, locked, gate, submit*, plus
`docs/ubiquitous-language.md` § Removed terms): that one is Kata's domain
vocabulary, checked against every issue. This one is UI writing style, checked
against copy a screen renders.

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
Title: [Screen] — [slice]            e.g. Curriculum — Module rows grouped by Category

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
- [ ] Include the negative cases (empty, unanswered, pending)
- [ ] A scripts/smoke.sh line for any new route, asset, or content file

## Out of scope
What this issue deliberately does not touch (next slice, other states).
```

## Slicing that matches the build order
Follow `docs/engineering.md` § 7 — thinnest end-to-end slice first:
1. **Foundation:** the docs, the Vite scaffold on GitHub Pages, the PWA baseline, and the terse-output check scripts (`scripts/README.md`). Nothing user-visible yet beyond the shell.
2. **Read path:** content schema + the five-Module index as committed JSON, `ICurriculum`, then the Curriculum, Module, and Exercise screens read-only. Real content for Module 1 lands here; the app is useful for reading on day 1.
3. **Self-Check:** `IProgress` over IndexedDB and the Self-Check form — questions answered in place, autosaved as they are picked, never submitted anywhere. Reading is not blocked before or after.
4. **Content packs:** Modules 2–5 (Concept Pages, Model Examples, Self-Check questions, briefs) plus the committed exercise folders — drafted with the authoring scripts (`scripts/draft-concept.mjs`, `scripts/draft-exercise.mjs`), human-edited, committed; CI compiles every exercise folder.
5. **Polish:** the pending-Module placeholder, progress export/import, and the design-fidelity sweep against `screens/`.

Labels in use: `screen:curriculum | screen:module | screen:exercise`, `area:frontend | area:content | area:tooling | area:docs`, `design-fidelity` (for pixel gaps against `screens/`), `language` (for vocabulary violations). If an issue needs a build-order marker, use `slice:1..5` matching the steps above.

## Before you file — 30-second check
- [ ] Title names a screen + slice, in ubiquitous language
- [ ] Every criterion is checkable by clicking or reading the DOM
- [ ] States covered are named (fresh / partly answered / fully answered / pending)
- [ ] No value hard-coded in the issue that `tokens.json` already carries
- [ ] Nothing asks for streaks, scores, timers, a code editor, or anything about the state of the learner's code (explicit non-goals)
- [ ] No new copy in the issue uses a word from the UI copy ban list above, and any new copy passes the keeper test
- [ ] If the issue touches a screen: answered "no" to "Does this add a second way to reach the same content?"

## Worked example

```markdown
Title: Curriculum — Module rows grouped under Category headings

## Context
Build-order step 2 (read path): the Library's front page.
Every Module is open to read, so the screen's only job is to show what is on
the shelf.

## Scope
Curriculum screen at the root route. Rows for every Module from
ICurriculum.getModules(), grouped under their Category and ordered by Category
ordinal then Module ordinal. Content is committed JSON under public/content/.
Header block included.

## Design references
- README.md § Screens › 1. Curriculum
- screens/01-state.png
- tokens.json → layout.curriculumRow, color.accentRamp

## Acceptance criteria
- [ ] Each Category renders one heading with its description and its practice
      language shown exactly once, and its Module rows beneath in ordinal order
- [ ] Every row has a 2px top rule, with a closing rule under the last one
- [ ] Every row shows hover tint and navigates to its Module screen on click —
      no row is dimmed, guarded, or unreachable in any stored state
- [ ] With empty IndexedDB the screen renders identically to a browser that has
      answered every Self-Check
- [ ] No text on the screen uses a banned term or a term from § Removed terms
- [ ] scripts/smoke.sh gains a check line: the root route serves the Curriculum screen markup
- [ ] Interaction-depth question answered: grouping adds no second way to reach
      a Module

## Out of scope
Module screen content (own issue); the Self-Check form (own issue).
```
