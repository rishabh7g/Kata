# DevGym — Design

Personal app for learning software design fundamentals through generated code exercises. Terms per `ubiquitous-language.md`.

## Core thesis

- Fundamentals compound with AI assistance; the strategic layer (module boundaries, interfaces, tests) is the 20% that carries career growth.
- Learning happens by *producing*, not recalling. Every Module ends in a generative act: refactor or implement real C# code against a fixed Target Interface.
- Progression is Checkpoint-based. No timelines, streaks, or schedules. You advance when the Exit Gate is passed, whether that takes 2 days or 2 months.

## Pedagogy (transferred from the Marathi app design)

- Tightly scoped Modules — one idea each, ~1 page of concept, 2–3 Model Examples.
- Generative Exit Gate — pass by producing code, never by agreeing or reciting.
- Validation is objective-first:
  1. **Primary: Test Suite at the Target Interface.** Green = the design works. No judge, no taste required.
  2. **Secondary: Behavioral Checklist.** Answerable even with undeveloped taste. Examples: "Count what a caller must know to use this module — is it > 3?", "Delete the implementation; could it be rebuilt from Target Interface + tests alone?", "Did any responsibility sentence need the word 'and'?"
- Self-review of *opinions* is banned as a gate (blind-spot problem): the smell you can't see is exactly what you're learning to see.

## Curriculum (fixed order, foundations-down)

1. **Deep Modules & Information Hiding** — the generative root. Interface = cost, functionality = benefit; good design maximizes complexity hidden per unit of interface. Most of SOLID is downstream of this.
2. **Dependency Direction** — coupling/cohesion, DIP. SOLID's S and D get real treatment here; O, L, I are demoted to Behavioral Checklist items inside Modules 1–2.
3. **Testing at Boundaries + TDD loop** — test the Target Interface, not the internals; small steps as speed limit. Doubles as the learner's permanent verification skill.
4. **Naming & Ubiquitous Language** — cheapest, highest leverage; also directly improves every AI collaboration.
5. **Error Design** — define errors out of existence; API design for backend .NET work.

Deliberately cut: CLEAN architecture and design-pattern catalogs as standalone Modules. After Modules 1–2 they compress to short reads; add them as Concept-Page appendices only.

## Module anatomy

Each Module contains:

- Concept Page (LLM first draft → human edit once, then frozen)
- 2–3 Model Examples (before/after C# pairs, ≤40 lines each side)
- 2 Exercises minimum (one refactor-type: fix planted Smell; one construct-type: implement behind a given Target Interface)
- Exit Gate = all Exercise Test Suites green + Behavioral Checklist submitted

## Exercise design rules

- Exercise Spec declares: concept, Smell, Target Interface, size budget (≤ ~300 LOC generated).
- The Test Suite is the trustworthy artifact — reviewed by the learner before starting (that review is itself practice for Module 3). The flawed codebase only needs to be *plausibly bad*.
- Target Interface is immutable during the Exercise. Wanting to change it is a signal to record and discuss, not an allowed move (v1).
- Regeneration always creates a new Exercise. Old Exercises and the learner's solutions are kept — solutions become personal Model Examples over time.

## Explicit non-goals (v1)

- No in-browser code editor or runner — learner uses their own IDE; the Verifier CLI reports results.
- No LLM judging of code quality — tests + behavioral checks only.
- No user accounts, no mobile app, no gamification.
- No spaced repetition (revisit later only if forgetting proves to be a real problem).

## Module 0 (meta)

The app is built using the workflow it teaches: this design doc + ubiquitous language file first, Target Interfaces designed by hand (see `engineering.md`), implementations delegated to AI, verification at the boundaries. The app is its own first Exercise.
