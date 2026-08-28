# Kata — Design

Personal app for learning software design fundamentals through authored exercises the learner does in their own IDE. Terms per `ubiquitous-language.md`.

## Core thesis

- **One principle: explain it to me like a novice.** Every page is written for a reader who has never met the topic, has no vocabulary for it yet, and is owed a plain explanation rather than a reminder. If a page only makes sense to someone who already knows the idea, it has failed.
- Kata is a **Library**, not a course: a shelf of Categories and Modules that are all open from the first visit. Nothing is submitted, nothing is judged, nothing unlocks, and no page is ever closed to the reader.
- Fundamentals compound with AI assistance; the strategic layer (module boundaries, interfaces, tests) is the 20% that carries career growth.
- Learning happens by *producing*, not recalling. Where a Module ships an Exercise, the practice is a generative act: refactor or implement real code against a fixed Target Interface, in the learner's own IDE.
- Reading is self-paced. There is no order to earn, no timeline, no streak, and no schedule — the learner reads what they came for, in whatever order they want, for as long as they want.

## Pedagogy

- Tightly scoped Modules — one idea each, ~1 page of concept, 2–3 Model Examples.
- **Explanation first.** A Module's job is to make one idea land with a reader who arrived cold. Concept Page and Model Examples are the whole of that job; everything else on the screen is optional.
- **The Self-Check is a mirror, not a gate.** A Module's questions are answered in place while reading, autosave as they are picked, and are never submitted anywhere. They exist so the reader can catch themselves nodding along — answering none of them costs the reader nothing.
- Questions stay behaviorally answerable ("state each class's responsibility in one sentence — did you need 'and'?"), never opinion checks ("is this clean?"). A question you can answer honestly without taste is a question that teaches; one that asks for a verdict just rehearses a blind spot.
- **Validation of the learner's code stays entirely in the learner's hands.** Where an Exercise exists, its Test Suite is written at the Target Interface, and the learner runs it themselves (`dotnet test`, `pytest`) in their own IDE. Green means the design works. Kata never runs, reads, sees, or records any of it — the Test Suite is practice material, not something the app checks.

## Editorial standard

Every Concept Page — and every Model Example caption, Exercise brief, and Self-Check explanation — must meet all six of these. This is the section content issues cite; a page that fails any line is not ready to commit.

1. **Plain words.** Ordinary English over jargon wherever the ordinary word is honest. Short, common words beat impressive ones.
2. **Every term of art defined at first use.** *Coupling*, *cohesion*, *seam*, *invariant*, *embedding*, *chunk* — each gets a one-line definition the first time it appears on the page, before it is used to explain anything else.
3. **Concrete example before abstraction.** Show the specific case first, then name the general rule it illustrates. Never the reverse.
4. **Short sentences.** One idea per sentence. If a sentence needs a comma to hold two clauses together, it is usually two sentences.
5. **No assumed prior exposure.** Nothing on the page may depend on the reader having shipped production code, read another Module, or recognised a named pattern. Cross-references are invitations, never prerequisites.
6. **Novice test.** The first paragraph must be understandable by someone with none of the topic's vocabulary. If it is not, the page starts in the wrong place.

## Categories and Modules

The Library groups Modules into **Categories**. A Category is a titled group with one practice language, so the language belongs to the shelf rather than to the app: Software Design practises in C#, Agentic AI in Python.

The Software Design Category holds five Modules, ordered foundations-down. The order is a **suggested reading order** — the way the ideas build if you have no reason to prefer another — never a sequence to unlock:

1. **Deep Modules & Information Hiding** — the generative root. Interface = cost, functionality = benefit; good design maximizes complexity hidden per unit of interface. Most of SOLID is downstream of this.
2. **Dependency Direction** — coupling/cohesion, DIP. SOLID's S and D get real treatment here; O, L, I are demoted to Self-Check questions inside Modules 1–2.
3. **Testing at Boundaries + TDD loop** — test the Target Interface, not the internals; small steps as speed limit. Doubles as the learner's permanent verification skill.
4. **Naming & Ubiquitous Language** — cheapest, highest leverage; also directly improves every AI collaboration.
5. **Error Design** — define errors out of existence; API design for backend .NET work.

The Agentic AI Category holds six Modules, practised in Python, in the same
suggested reading order — each one leans on the one before, and none of them
blocks another:

1. **Embeddings** — meaning as geometry: how text becomes vectors you can compare.
2. **Ingestion** — from documents to searchable chunks: load, split, embed, store.
3. **Retrieval-Augmented Generation** — retrieve first, then generate, so answers stay grounded in your own data.
4. **Agents & Tool Use** — the reason–act loop: a model that decides which tool to call next.
5. **LangGraph** — agents as graphs: explicit state, nodes, and edges instead of tangled loops.
6. **LangSmith** — seeing what the agent did: tracing runs and evaluating outputs.

Deliberately cut: CLEAN architecture and design-pattern catalogs as standalone Modules. After Modules 1–2 they compress to short reads; add them as Concept-Page appendices only.

## Module anatomy

Each Module contains:

- Concept Page, written to the editorial standard above; its first line is the provenance note recording which editing stages it has been through (`docs/engineering.md` § 5), and no screen renders that line
- 2–3 Model Examples (before/after code pairs in the Category's language, ≤40 lines each side)
- A Self-Check — a few optional questions, answered while reading, autosaved, never submitted
- Exercises: none, one, or several. A Module that only explains is a complete Module. Where a Software Design Module ships them, the convention is two — one refactor-type (fix a planted Smell) and one construct-type (implement behind a given Target Interface) — each a committed folder the learner clones. The Agentic AI Category explains only, with one exception: Retrieval-Augmented Generation carries a single construct-type Python Exercise, the pilot that proves practice material works in a second language (#172). Whether the other five get one is decided after that Exercise has been used, not before.

## Exercise design rules

- Exercise Spec declares: concept, Smell, Target Interface, size budget (≤ ~300 LOC).
- Each Exercise ships as a folder committed in this repo — README, source, tests. The app shows the Spec and links to the folder; the learner clones it and works in their own IDE.
- The Test Suite is the trustworthy artifact — written against the Target Interface (never against the flawed code, which would bless the Smell), reviewed by the learner before starting (that review is itself practice for Module 3), and run by them. The flawed codebase only needs to be *plausibly bad*.
- Target Interface is immutable during the Exercise. Wanting to change it is a signal to record and discuss, not an allowed move (v1).
- Regeneration always creates a new Exercise. Old Exercises and the learner's solutions are kept — solutions become personal Model Examples over time.

## Explicit non-goals (v1)

- No in-browser code editor or runner — the learner uses their own IDE and runs the tests there themselves.
- No app-side checking of the learner's code at all: no test results reported back, no run history, no pass/fail status on a screen. The app reads authored content and autosaves Self-Check answers; that is its whole job.
- No LLM judging of code quality — the Test Suite the learner runs is the whole of validation, and it never leaves their machine.
- No user accounts, no mobile app, no gamification.
- No spaced repetition (revisit later only if forgetting proves to be a real problem).

## Module 0 (meta)

The app is built using the workflow it teaches: this design doc + ubiquitous language file first, the two Target Interfaces designed by hand (see `engineering.md`), implementations delegated to AI, tests written at those boundaries. The app is its own first Exercise.
