# Writing GitHub issues for the DevGym design

Issues are the contract between this design package and the code. Keep them small, behavioral, and written in the project's exact vocabulary.

## Ground rules
1. **Ubiquitous language, always.** Module, Exercise, Smell, Target Interface, Test Suite, Exit Gate, Behavioral Checklist, Checkpoint, Verification Run, Workbench — exactly as defined in `docs/ubiquitous-language.md`. Banned in titles and bodies: *lesson, course, level, quiz, flashcard, grade, score*. Say **Target Interface** (domain) or C# `interface` (code) — never "interface" alone.
2. **One issue = one verifiable slice.** A screen state, a flow, or one Target Interface's read path — never "build the Module screen" in one issue.
3. **Acceptance criteria are behavioral**, in the spirit of the Behavioral Checklist: checkable by doing, not by taste.
   - Good: "Clicking a locked Module row does nothing; cursor shows `not-allowed`."
   - Good: "Submit stays disabled until all three checks have an answer."
   - Bad: "Locked rows should feel clearly disabled." / "The gate panel looks clean."
4. **Reference, don't restate.** Point at `README.md` sections, `screens/*.png`, `tokens.json` keys, and `docs/engineering.md` interfaces instead of re-describing the design. If an issue needs prose the README doesn't have, the README is missing something — fix it there first.
5. **Design changes flow doc-first.** If implementation pressure suggests changing a Target Interface or a screen, the issue's outcome is an edit to `docs/engineering.md` / this package — never code that drifts from the docs.

## Issue anatomy

```markdown
Title: [Screen] — [slice]            e.g. Curriculum — Module rows with lock chain

## Context
Build-order step (docs/engineering.md §Build order) and one sentence of intent.

## Scope
The exact slice: screen, states covered, data source (which Target Interface).

## Design references
- README.md § <section>
- screens/<nn>-state.png
- tokens.json → <keys used>

## Acceptance criteria
- [ ] Behavioral, checkable statements only (see ground rule 3)
- [ ] Include the negative cases (locked, empty, failing)

## Out of scope
What this issue deliberately does not touch (next slice, other states).
```

## Slicing that matches the build order
Follow `docs/engineering.md` — thinnest end-to-end slice first:
1. **Slice 1 (read path):** Curriculum rows + lock chain → Module screen: Concept Page, Model Examples, Exercise cards (static status), gate panel (read-only).
2. **Slice 2 (generation):** Exercise screen: Spec grid + Target Interface block + Workbench path; fresh state (no runs).
3. **Slice 3 (the loop):** Verification aside (terminal, latest run, history table), gate computation, Checkpoint write, unlock cascade, poster + gate banner.
4. **Slice 4 (polish):** Behavioral Checklist form + submitted state, concept-draft generation UI, pending-Module placeholders.

Suggested labels: `screen:curriculum | screen:module | screen:exercise`, `slice:1..4`, `design-fidelity` (for pixel gaps against `screens/`), `language` (for vocabulary violations).

## Before you file — 30-second check
- [ ] Title names a screen + slice, in ubiquitous language
- [ ] Every criterion is checkable by clicking or reading the DOM
- [ ] States covered are named (locked / fresh / failing / passed / submitted)
- [ ] No value hard-coded in the issue that `tokens.json` already carries
- [ ] Nothing asks for streaks, scores, timers, or a code editor (explicit non-goals)

## Worked example

```markdown
Title: Curriculum — Module rows with lock chain

## Context
Build-order step 1: SQLite schema + ICurriculum read path + Curriculum screen.
Makes the app useful for reading on day 1.

## Scope
Curriculum screen only. Rows for all five Modules from ICurriculum.GetModules(),
ordered by ordinal, with lock/unlock derived server-side. No navigation into
locked Modules. Header block included.

## Design references
- README.md § Screens › 1. Curriculum
- screens/01-state.png
- tokens.json → layout.curriculumRow, semantics.locked, color.accentRamp

## Acceptance criteria
- [ ] Five rows render in fixed order 01–05 with a 2px top rule each and a closing rule
- [ ] Passed Module shows the accent "Exit Gate passed" tag and "Checkpoint · <date>"
- [ ] Locked rows render at 0.5 opacity with a lock icon; click does nothing; cursor is not-allowed
- [ ] Unlocked rows show hover tint and navigate to the Module screen on click
- [ ] Nav shows "Checkpoints n / 5" where n = count of Checkpoints, not a percentage
- [ ] No text on the screen uses a banned term

## Out of scope
Module screen content (own issue); gate computation (slice 3).
```
