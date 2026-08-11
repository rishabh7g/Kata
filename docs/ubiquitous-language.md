# Ubiquitous Language — Kata

Keep this file open during all planning and prompting sessions. Every PRD, prompt, commit message, and interface name uses these terms exactly. If a concept isn't here, name it here first, then use it.

## Domain terms

- **Module** — one learnable concept unit (e.g., "Deep Modules"). Contains: one Concept Page, 2–3 Model Examples, one or more Exercises, one Exit Gate. Not to be confused with a code module; when ambiguity is possible, say *Learning Module* vs *Code Module*.
- **Concept Page** — ~1 page of prose explaining the concept. First draft is LLM-generated, then human-edited. Read-only content, no interaction.
- **Model Example** — a small before/after C# code pair demonstrating the concept (the "10 model sentences" equivalent). Shown alongside the Concept Page.
- **Exercise** — a practice folder committed in this repo (`exercises/<moduleId>/<exerciseId>/`): a deliberately flawed C# codebase (refactor-type) or a stub (construct-type), plus a Test Suite written against the Target Interface. The learner clones or copies the folder into their own IDE and refactors/implements until the tests pass. Kata links to the folder and never runs, materializes, or inspects it.
- **Smell** — the specific flaw deliberately planted in an Exercise codebase (e.g., "shallow module: config leaked into caller"). Each Exercise declares its Smell explicitly in metadata.
- **Target Interface** — the boundary the learner must end up with. Tests are written against this and only this. The learner may not change it; everything behind it is theirs.
- **Test Suite** — xUnit tests targeting the Target Interface, committed inside the Exercise folder. The trustworthy artifact of an Exercise; the authored codebase may be sloppy, tests must be correct. The learner runs it themselves (`dotnet test`) as their own feedback loop — it is practice material, never an input to the Exit Gate, and the app never sees its results.
- **Exit Gate** — the pass condition for a Module: **Behavioral Checklist submitted — the sole condition, self-assessed**. Kata never runs or judges the learner's code, so there is no second condition to meet. Checkpoint-based, never time-based.
- **Behavioral Checklist** — the Exit Gate's one condition, and the only judgement the app records. Only behaviorally-answerable checks ("state each class's responsibility in one sentence — did you need 'and'?"), never opinion checks ("is this clean?"). Per Module, not per Exercise.
- **Checkpoint** — a learner's recorded passage through an Exit Gate. Progress = ordered list of Checkpoints. There is no timeline, streak, or schedule anywhere in the system.
- **Exercise Spec** — an Exercise's declared shape: concept + Smell planted + Target Interface + size budget. Authored with the Module's content, committed as the Exercise brief, and shown on the Exercise screen as the Spec grid. Regeneration creates a *new* Exercise, never overwrites (no specs-to-code degradation).
- **Curriculum** — the fixed, ordered list of Modules. v1: Deep Modules → Dependency Direction → Testing at Boundaries → Naming & Ubiquitous Language → Error Design.

## System terms

- **Generator** — the authoring-time script that drafts Concept Pages, Model Examples, and exercise material by calling the local `claude` CLI on the build host. It runs before the content is committed, never at runtime: the shipped app contains no LLM client and no generation code.
- **ICurriculum** / **IProgress** — the two Target Interfaces the app is built from: reading the authored content, and owning the learner's progression. Defined normatively in `docs/engineering.md` § 2.

## Removed terms (kept so old references stay decodable)

These named parts of the original localhost architecture. They are **not live system terms** — don't use them in issues, prompts, commits, or UI. `docs/engineering.md` § 9 records why each is gone.

- **Verification Run** — one execution of an Exercise's Test Suite, reported to the app. Kata no longer receives, stores, or displays test results.
- **Verifier CLI** — the `kata verify` command that ran `dotnet test` and posted results back. The learner runs `dotnet test` themselves; nothing reports anywhere.
- **Workbench** — the local folder an Exercise was materialized into. Exercise folders are committed in this repo instead; the learner clones the one they want.

Note what is *not* removed: **Test Suite** is still a live term. It stopped being a gate condition; it did not stop being the point of the practice.

## Banned / disambiguated terms

- Don't say "lesson", "course", "level", "quiz", "flashcard" — none of these exist in this system.
- Don't say "grade" or "score" — Kata never measures the learner's work; an Exit Gate is passed or not.
- "Interface" alone is ambiguous — say **Target Interface** (domain) or C# `interface` (code) explicitly.
