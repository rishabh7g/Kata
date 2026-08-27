# Ubiquitous Language — Kata

Keep this file open during all planning and prompting sessions. Every PRD, prompt, commit message, and interface name uses these terms exactly. If a concept isn't here, name it here first, then use it.

## Domain terms

- **Library** — the whole app: a self-paced shelf of Categories and Modules where every page is open to read from the first visit and nothing is ever submitted, blocked, or unlocked. Example: a first-time reader can open the last Module before the first, and the app neither prevents it nor records that they did.
- **Category** — a titled group of Modules that share one practice language. Example: "Software Design" (C#) holds the five design Modules; "Agentic AI" (Python) holds its own.
- **Module** — one learnable concept unit (e.g., "Deep Modules"). Belongs to exactly one Category. Contains: one Concept Page, 2–3 Model Examples, one Self-Check, and zero or more Exercises. Not to be confused with a code module; when ambiguity is possible, say *Learning Module* vs *Code Module*.
- **Concept Page** — ~1 page of prose explaining the concept, written to `docs/design.md` § Editorial standard. First draft is LLM-generated, then human-edited. Read-only content, no interaction.
- **Model Example** — a small before/after code pair, in the Category's language, demonstrating the concept (the "10 model sentences" equivalent). Shown alongside the Concept Page.
- **Self-Check** — a Module's optional questions, answered in place while reading, autosaved as they are picked, never submitted and never a condition for anything. Example: answering none of a Module's three questions changes nothing on any screen — no tag, no state text, no effect on what the reader can open next.
- **Exercise** — a practice folder committed in this repo (`exercises/<moduleId>/<exerciseId>/`): a deliberately flawed codebase (refactor-type) or a stub (construct-type), plus a Test Suite written against the Target Interface. The learner clones or copies the folder into their own IDE and refactors/implements until the tests pass. Kata links to the folder and never runs, materializes, or inspects it.
- **Smell** — the specific flaw deliberately planted in an Exercise codebase (e.g., "shallow module: config leaked into caller"). Each Exercise declares its Smell explicitly in metadata.
- **Target Interface** — the boundary the learner must end up with. Tests are written against this and only this. The learner may not change it; everything behind it is theirs.
- **Test Suite** — the Exercise's tests targeting the Target Interface, committed inside the Exercise folder. The trustworthy artifact of an Exercise; the authored codebase may be sloppy, tests must be correct. The learner runs it themselves (`dotnet test`, `pytest`) as their own feedback loop — it is practice material, and the app never sees its results.
- **Exercise Spec** — an Exercise's declared shape: concept + Smell planted + Target Interface + size budget. Authored with the Module's content, committed as the Exercise brief, and shown on the Exercise screen as the Spec grid. Regeneration creates a *new* Exercise, never overwrites (no specs-to-code degradation).
- **Curriculum** — the Library's index: every Category in order, each with its Modules in order. The order is a suggested reading order, never a sequence to unlock.

## System terms

- **Generator** — the authoring-time script that drafts Concept Pages, Model Examples, and exercise material by calling the local `claude` CLI on the build host. It runs before the content is committed, never at runtime: the shipped app contains no LLM client and no generation code.
- **ICurriculum** / **IProgress** — the two Target Interfaces the app is built from: reading the authored content, and owning the learner's Self-Check answers. Defined normatively in `docs/engineering.md` § 2.

## Removed terms (kept so old references stay decodable)

These are **not live system terms** — don't use them in issues, prompts, commits, or UI. The first three named the original localhost architecture (`docs/engineering.md` § 9 records why each is gone); the last three named the gated-course model Kata dropped when it became a Library.

- **Verification Run** — one execution of an Exercise's Test Suite, reported to the app. Kata no longer receives, stores, or displays test results.
- **Verifier CLI** — the `kata verify` command that ran `dotnet test` and posted results back. The learner runs the tests themselves; nothing reports anywhere.
- **Workbench** — the local folder an Exercise was materialized into. Exercise folders are committed in this repo instead; the learner clones the one they want.
- **Exit Gate** — a Module's pass condition, opened by submitting the Behavioral Checklist. Modules have no pass condition: nothing is submitted and nothing is passed.
- **Behavioral Checklist** — the Exit Gate's one condition and the only judgement the app recorded. The questions survive as the **Self-Check**; what is gone is the submitting, the pass state, and the judgement.
- **Checkpoint** — a recorded passage through an Exit Gate, and the unit of progress that unlocked the next Module. Nothing unlocks now, so nothing is recorded but Self-Check answers.

Note what is *not* removed: **Test Suite** is still a live term. It stopped being a gate condition; it did not stop being the point of the practice.

## Banned / disambiguated terms

- Don't say "lesson", "course", "level", "quiz", "flashcard" — none of these exist in this system. Kata is a Library; its questions are a Self-Check.
- Don't say "grade" or "score" — Kata never measures the learner's work, and a Self-Check has no result.
- Don't say "unlock", "locked", "gate", or "submit" — nothing in the Library blocks the reader and nothing is sent anywhere. "Progress" survives only as the name of what is stored (`IProgress`, the exported progress file): the reader's Self-Check answers, never a measure of how far they have got.
- "Interface" alone is ambiguous — say **Target Interface** (domain) or C# `interface` (code) explicitly.
