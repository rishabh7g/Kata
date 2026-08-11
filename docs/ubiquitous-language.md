# Ubiquitous Language — DevGym

Keep this file open during all planning and prompting sessions. Every PRD, prompt, commit message, and interface name uses these terms exactly. If a concept isn't here, name it here first, then use it.

## Domain terms

- **Module** — one learnable concept unit (e.g., "Deep Modules"). Contains: one Concept Page, 2–3 Model Examples, one or more Exercises, one Exit Gate. Not to be confused with a code module; when ambiguity is possible, say *Learning Module* vs *Code Module*.
- **Concept Page** — ~1 page of prose explaining the concept. First draft is LLM-generated, then human-edited. Read-only content, no interaction.
- **Model Example** — a small before/after C# code pair demonstrating the concept (the "10 model sentences" equivalent). Shown alongside the Concept Page.
- **Exercise** — a generated, deliberately flawed C# codebase plus a Test Suite written against the Target Interface. The learner refactors/implements until tests pass.
- **Smell** — the specific flaw deliberately planted in an Exercise codebase (e.g., "shallow module: config leaked into caller"). Each Exercise declares its Smell explicitly in metadata.
- **Target Interface** — the boundary the learner must end up with. Tests are written against this and only this. The learner may not change it; everything behind it is theirs.
- **Test Suite** — xUnit tests targeting the Target Interface. The trustworthy artifact of an Exercise; generated code may be sloppy, tests must be correct.
- **Exit Gate** — the pass condition for a Module: all Exercise Test Suites green AND the Behavioral Checklist completed. Checkpoint-based, never time-based.
- **Behavioral Checklist** — secondary validation. Only behaviorally-answerable checks ("state each class's responsibility in one sentence — did you need 'and'?"), never opinion checks ("is this clean?").
- **Checkpoint** — a learner's recorded passage through an Exit Gate. Progress = ordered list of Checkpoints. There is no timeline, streak, or schedule anywhere in the system.
- **Verification Run** — one execution of an Exercise's Test Suite, reported to the app with pass/fail per test.
- **Exercise Spec** — the prompt-input that generates an Exercise: concept + Smell to plant + Target Interface. Specs are stored; generated Exercises are stored; regeneration creates a *new* Exercise, never overwrites (no specs-to-code degradation).
- **Curriculum** — the fixed, ordered list of Modules. v1: Deep Modules → Dependency Direction → Testing at Boundaries → Naming & Ubiquitous Language → Error Design.

## System terms

- **Generator** — the component that calls the LLM to produce Concept Pages and Exercises from Exercise Specs.
- **Verifier CLI** — local command-line companion (`devgym verify`) that runs `dotnet test` in an Exercise folder and posts a Verification Run to the app.
- **Workbench** — the local folder where an Exercise's codebase is materialized for the learner to edit in their own IDE.

## Banned / disambiguated terms

- Don't say "lesson", "course", "level", "quiz", "flashcard" — none of these exist in this system.
- Don't say "grade" or "score" — a Verification Run is pass/fail per test; an Exit Gate is passed or not.
- "Interface" alone is ambiguous — say **Target Interface** (domain) or C# `interface` (code) explicitly.
