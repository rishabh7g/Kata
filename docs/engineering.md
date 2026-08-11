# DevGym — Engineering

Stack matches your day job so the practice transfers: **ASP.NET Core (minimal API) + SQLite + React (Vite, TypeScript)**. Runs entirely on localhost. Terms per `ubiquitous-language.md`.

## Architecture (interface-first, per the talk)

You design and own everything in this file. AI owns everything behind these boundaries. Verification happens at the boundaries via tests written against these interfaces before implementation.

### Code modules and their Target Interfaces

```csharp
// 1. Curriculum — owns Modules, Concept Pages, Model Examples, ordering.
public interface ICurriculum
{
    IReadOnlyList<ModuleSummary> GetModules();          // ordered; includes lock/unlock state
    ModuleDetail GetModule(ModuleId id);                 // concept page, examples, exercises, gate status
}

// 2. Generator — all LLM interaction lives behind this. Nothing else touches the API.
public interface IGenerator
{
    Task<ConceptDraft> DraftConceptPageAsync(ModuleId id, CancellationToken ct);
    Task<GeneratedExercise> GenerateExerciseAsync(ExerciseSpec spec, CancellationToken ct);
}

// 3. Workbench — materializes an Exercise to disk for the learner's IDE.
public interface IWorkbench
{
    WorkbenchPath Materialize(ExerciseId id);            // writes csproj + code + tests to a folder
    ExerciseId? Identify(WorkbenchPath path);            // used by Verifier CLI
}

// 4. Progress — the only writer of Checkpoints and Verification Runs.
public interface IProgress
{
    void RecordVerificationRun(ExerciseId id, VerificationRun run);
    void SubmitChecklist(ModuleId id, ChecklistAnswers answers);
    GateStatus GetGateStatus(ModuleId id);               // computes: all suites green + checklist done
}
```

Depth check applied to our own design: 4 interfaces, 9 methods total, hiding LLM prompting, file I/O, test-result parsing, SQLite, and gate logic. A caller (the API layer) needs to know nothing about any of that.

### Components

- **API layer** — thin minimal-API endpoints mapping 1:1 onto the four interfaces. No logic.
- **React frontend** — three screens only: Curriculum (module list + lock state), Module (concept page, examples, exercise cards, gate status), Exercise (spec, target interface, checklist form, verification history). No editor.
- **Verifier CLI** — `devgym verify` run inside a Workbench folder: executes `dotnet test --logger trx`, parses results, POSTs a Verification Run to `localhost` API. ~100 lines; the only moving part outside the web app.
- **Generator implementation** — calls Anthropic API. Output contract is strict JSON: `{ files: [{path, content}], testFiles: [...], smellNotes }`. Tests are generated against the Target Interface *from the Exercise Spec*, never from the generated flawed code (prevents tests that bless the smell).

## Data model (SQLite)

- `modules` — id, ordinal, title, concept_md, status
- `model_examples` — module_id, before_code, after_code, caption
- `exercise_specs` — module_id, smell, target_interface_code, size_budget
- `exercises` — spec_id, generated_at, folder_hash; regeneration inserts, never updates
- `verification_runs` — exercise_id, at, passed_count, failed_count, raw_trx
- `checklist_answers` — module_id, answers_json, at
- `checkpoints` — module_id, passed_at (derived event, written by IProgress when gate conditions met)

## Key flows

1. **Generate Exercise**: pick Module → app builds Exercise Spec → `IGenerator.GenerateExerciseAsync` → stored → `IWorkbench.Materialize` → path shown to learner.
2. **Work loop**: learner edits in IDE → `devgym verify` → Verification Run recorded → frontend polls gate status.
3. **Pass gate**: all suites green + checklist submitted → `IProgress` writes Checkpoint → next Module unlocks.

## Build order (Pareto: thinnest end-to-end slice first)

1. SQLite schema + `ICurriculum` read path + Curriculum/Module screens, with Module 1 content hand-seeded. (App is useful for reading on day 1.)
2. `IGenerator` for exercises + `IWorkbench`. First generated Exercise materialized.
3. Verifier CLI + `IProgress` + gate logic. Full loop closes here — everything after is polish.
4. Concept-draft generation, checklist UI, verification history.

## Build process rules (Module 0 discipline)

- Before implementing each interface: write its tests first, from this doc, not from any implementation.
- Every AI prompt session starts by pasting `ubiquitous-language.md`.
- Interface changes require editing this file first, then code — never the reverse.
- Critical-path review exception applies to `IProgress` gate logic (it's the integrity of the whole system): review its implementation line-by-line.
