---
name: Screen or flow
about: A UI/screen change — carries Kata's copy ban list and the interaction-depth review question (house UI standard, #115)
title: "[Screen] — [slice]"
labels: ''
---

## Context
Build-order step (docs/engineering.md § 7) and one sentence of intent.

## Scope
The exact slice: screen, states covered, data source (which Target Interface / ICurriculum / IProgress call).

## Design references
- README.md § <section>
- screens/<nn>-state.png
- tokens.json → <keys used>

## Copy — the ban list and the keeper test

**Kata's UI copy ban list** — words and constructions this app does not ship
(source: `design/issue-guide.md` § UI copy ban list; the two must not disagree):

- *streak*, *daily goal*, *days left*, *% complete*, *XP*, *score* — Kata is a
  self-paced Library and says so; none of these exist in its model.
- *just*, *simply*, *easy* — reassurance words in instructional copy.
- Any string implying the app judges the learner's code. Kata is read-only
  and never runs anything.

**The keeper test** for any new copy this issue adds: a string survives only
if it (1) carries live data — a count, a date, a name; (2) is the only
instruction on a step; (3) guards a destructive action; or (4) it is the
first-use definition of a term the UI then uses as a label. Everything else is
a read-once explainer and does not ship.

## Interaction depth — required review question

**Does this add a second way to reach the same content?**

- [ ] No — one affordance, one destination. If a detail screen exists, the
      list row is a link to it, never a disclosure alongside one.

If the honest answer is yes, stop and rework the issue before filing it —
this cannot be caught by any test or by `scripts/smoke.sh`; the review
question is the only gate it has.

## Acceptance criteria
- [ ] Behavioral, checkable statements only (design/issue-guide.md ground rule 3)
- [ ] Include the negative cases (empty, unanswered, pending)
- [ ] No copy from the ban list above; any new copy passes the keeper test
- [ ] A scripts/smoke.sh line for any new route, asset, or content file

## Out of scope
What this issue deliberately does not touch (next slice, other states).
