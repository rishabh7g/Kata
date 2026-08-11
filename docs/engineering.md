# Kata — Engineering

Kata is a **read-only, offline-capable PWA served as static files from GitHub
Pages out of this repo**. There is no backend, no database server, no runtime
LLM call, and no code execution: the app reads authored content that is
committed to the repo and records the learner's own Checkpoints in the browser.
The learner practises C# in their own IDE, against material this repo hands
them. Terms per `ubiquitous-language.md`.

Everything the app does is behind **two Target Interfaces** — `ICurriculum`
(read the authored content) and `IProgress` (own the learner's progression).
Everything else is React rendering on top of them.

Depth check applied to our own design: 2 Target Interfaces, 11 methods,
hiding content fetching and caching, the lock-chain derivation, IndexedDB, and
the Exit Gate logic. A screen needs to know none of that.

---

## 1. Stack

| Piece | Decision |
|---|---|
| App | **React + Vite + TypeScript**, `strict: true`, no `any` in app code |
| Styling | **`design/styles.css` is the app stylesheet** — imported as-is, the single source of styling truth |
| Tokens | `design/tokens.json` is honoured through the CSS variables `styles.css` defines; never hard-code a hex or px the tokens already carry |
| Fonts | **Self-hosted** Archivo 400/600/800 as committed `woff2` + `@font-face`, replacing the stylesheet's Google Fonts import (an offline PWA may not depend on a third-party origin) |
| Persistence | **IndexedDB in the browser only** (§ 4). No accounts, no server, no sync |
| Offline | Web app manifest + a hand-rolled service worker (`src/pwa/`). The **app shell** — document, JS, CSS, fonts, icons, manifest — is **precached** cache-first from a build-generated list, in a cache named for a hash of those files, so a new deploy activates on the next online load. The **content JSON** is **not** precached (`cache.addAll` is atomic, and a Module that has not been authored yet would fail the whole install): it is fetched network-first and cached as it is read, so it is offline-ready after one online visit |
| Tests | **Vitest** for all app tests; `fake-indexeddb` (or an equivalent browser test environment) for `IProgress` |
| Hosting | **GitHub Pages**, deployed by a GitHub Actions workflow on push to `main` |
| Base path | Vite `base: '/Kata/'`; every runtime URL is built from `import.meta.env.BASE_URL`, never hard-coded |
| Secrets | None exist in the app. Nothing it ships is private, so nothing needs hiding |

Host and CI facts: **Node v24** and the **dotnet 10 SDK** are both available —
Node for the app and the authoring scripts, dotnet only for compiling the
committed exercise material in CI (§ 6). The app itself never invokes dotnet.

Because the app is static, "deploy" means "the Actions run that published
`dist/`". There is nothing to restart and no environment to configure.

---

## 2. The two Target Interfaces

This section is the contract. Its code block is normative TypeScript: paste it
verbatim into a `.ts` file and it compiles under `strict`. Both Target Interfaces
are fully asynchronous, because both of their backing stores (HTTP-fetched JSON
and IndexedDB) are. Absence is always `null`, never `undefined`, so every value
survives a JSON round-trip unchanged.

The code block below is written as TypeScript `interface` declarations. In prose
a boundary is always a **Target Interface**, and C# code the learner receives is
always a C# `interface`.

```ts
// ── Ids and scalars ──────────────────────────────────────────────────────

/** Module id exactly as committed in the content files: 'm01' … 'm05'. */
export type ModuleId = string;

/** Exercise id, unique app-wide, equal to its repo folder name: 'm01-e1'. */
export type ExerciseId = string;

/** Behavioral Checklist question id, unique within its Module: 'q1' … 'q3'. */
export type ChecklistQuestionId = string;

/** ISO-8601 instant in UTC, e.g. '2026-08-12T09:41:00.000Z'. */
export type IsoDateTime = string;

export type ExerciseType = 'refactor' | 'construct';

// ── Authored content (committed JSON, read-only at runtime) ──────────────

export interface ModuleIndexEntry {
  readonly id: ModuleId;
  readonly ordinal: number; // 1-based, contiguous, the fixed Curriculum order
  readonly title: string;
  readonly description: string; // one line, shown under the title
  readonly pending: boolean; // true = content pack not authored yet
}

export interface ModuleIndex {
  readonly schemaVersion: 1;
  readonly modules: readonly ModuleIndexEntry[];
}

export interface ModelExample {
  readonly before: string; // C# source, <= 40 lines
  readonly after: string; // C# source, <= 40 lines
  readonly caption: string; // what moved or got hidden
}

export interface ExerciseBrief {
  readonly id: ExerciseId;
  readonly type: ExerciseType;
  readonly title: string;
  readonly concept: string; // Exercise Spec row 1
  readonly smell: string; // Exercise Spec row 2 — the planted flaw
  readonly targetInterfaceCode: string; // C# source, rendered read-only
  readonly sizeBudgetLoc: number; // <= 300
  readonly folderUrl: string | null; // GitHub folder link; null until committed
}

export interface ChecklistOption {
  readonly value: string; // the stored answer value
  readonly label: string; // what the radio shows
}

export interface ChecklistQuestion {
  readonly id: ChecklistQuestionId;
  readonly prompt: string; // behaviorally answerable — countable or doable
  readonly options: readonly [ChecklistOption, ChecklistOption]; // a radio pair
}

export interface ModuleContent {
  readonly schemaVersion: 1;
  readonly id: ModuleId;
  readonly conceptPageMarkdown: string;
  readonly modelExamples: readonly ModelExample[]; // 2–3
  readonly exercises: readonly ExerciseBrief[]; // >= 2: one refactor, one construct
  readonly checklistQuestions: readonly [
    ChecklistQuestion,
    ChecklistQuestion,
    ChecklistQuestion,
  ]; // exactly 3
}

// ── Learner progress (the only data Kata ever persists) ──────────────────

export interface Checkpoint {
  readonly moduleId: ModuleId;
  readonly passedAt: IsoDateTime; // written once at the pass; never updated
}

/** Complete answers: one chosen option value per checklist question id. */
export type ChecklistAnswers = Readonly<Record<ChecklistQuestionId, string>>;

/** Autosaved answers, possibly incomplete. Never part of the Exit Gate. */
export type PartialChecklistAnswers = Readonly<
  Partial<Record<ChecklistQuestionId, string>>
>;

export interface SubmittedChecklist {
  readonly moduleId: ModuleId;
  readonly answers: ChecklistAnswers;
  readonly submittedAt: IsoDateTime;
}

export interface ChecklistDraft {
  readonly moduleId: ModuleId;
  readonly answers: PartialChecklistAnswers;
  readonly savedAt: IsoDateTime;
}

export interface GateStatus {
  readonly moduleId: ModuleId;
  readonly passed: boolean; // true iff the Behavioral Checklist is submitted
  readonly checklistSubmittedAt: IsoDateTime | null;
  readonly checkpointAt: IsoDateTime | null; // null while the gate is not passed
}

/** The whole persisted state, in one value: backup file and test fixture. */
export interface ProgressState {
  readonly schemaVersion: 1;
  readonly checkpoints: readonly Checkpoint[];
  readonly submittedChecklists: readonly SubmittedChecklist[];
  readonly checklistDrafts: readonly ChecklistDraft[];
}

// ── What ICurriculum hands to the screens ────────────────────────────────

export interface ModuleSummary {
  readonly id: ModuleId;
  readonly ordinal: number;
  readonly title: string;
  readonly description: string;
  readonly pending: boolean;
  readonly unlocked: boolean; // derived per the lock chain; never stored
  readonly checkpointAt: IsoDateTime | null; // non-null iff a Checkpoint exists
}

export interface ModuleDetail extends ModuleSummary {
  readonly conceptPageMarkdown: string; // '' when pending
  readonly modelExamples: readonly ModelExample[]; // [] when pending
  readonly exercises: readonly ExerciseBrief[]; // [] when pending
  readonly checklistQuestions: readonly ChecklistQuestion[]; // [] when pending, else 3
}

// ── Seams ────────────────────────────────────────────────────────────────

/** The only progress data ICurriculum may read. IProgress satisfies it. */
export interface CheckpointReader {
  listCheckpoints(): Promise<readonly Checkpoint[]>;
}

/** Where authored content comes from: HTTP in the app, in-memory in tests. */
export interface ContentSource {
  loadIndex(): Promise<ModuleIndex>;
  /** null = the Module has no content file yet (pending). */
  loadModuleContent(id: ModuleId): Promise<ModuleContent | null>;
}

// ── Target Interface 1 of 2: ICurriculum ─────────────────────────────────

export interface ICurriculum {
  /** Every Module, ordered by ordinal ascending, with derived lock state. */
  getModules(): Promise<readonly ModuleSummary[]>;
  /** Full detail for one Module; null when the id is unknown. */
  getModule(id: ModuleId): Promise<ModuleDetail | null>;
}

export declare function createCurriculum(
  content: ContentSource,
  checkpoints: CheckpointReader,
): ICurriculum;

// ── Target Interface 2 of 2: IProgress ───────────────────────────────────

export interface IProgress extends CheckpointReader {
  /** Passes the Exit Gate and writes this Module's one Checkpoint. */
  submitChecklist(
    moduleId: ModuleId,
    answers: ChecklistAnswers,
  ): Promise<GateStatus>;
  /** Autosave of unsubmitted answers. Never affects the Exit Gate. */
  saveChecklistDraft(
    moduleId: ModuleId,
    partialAnswers: PartialChecklistAnswers,
  ): Promise<void>;
  getChecklistDraft(moduleId: ModuleId): Promise<ChecklistDraft | null>;
  getSubmittedChecklist(moduleId: ModuleId): Promise<SubmittedChecklist | null>;
  getGateStatus(moduleId: ModuleId): Promise<GateStatus>;
  listCheckpoints(): Promise<readonly Checkpoint[]>;
  getCheckpoint(moduleId: ModuleId): Promise<Checkpoint | null>;
  /** Whole state out, for the backup file and for test fixtures. */
  exportState(): Promise<ProgressState>;
  /** Whole state in: replaces everything stored. All-or-nothing. */
  importState(state: ProgressState): Promise<void>;
}

export declare function createProgress(
  databaseName?: string,
): Promise<IProgress>;
```

### ICurriculum — behaviour

Owns the authored content and the derived lock chain. It is a pure function of
(content, Checkpoints): given the same inputs it returns the same output, and
it **writes nothing, ever**.

- `getModules()` returns one `ModuleSummary` per entry in the module index,
  **sorted by `ordinal` ascending**. Order comes from the data, never from the
  file order.
- `getModule(id)` returns `ModuleDetail`. For an **unknown id it returns
  `null`** — it never throws and never invents a Module. For a **pending**
  Module it returns detail with `pending: true` and empty content
  (`conceptPageMarkdown: ''`, `[]` for the three arrays); the screen renders the
  pending placeholder from that.
- `getModule` does **not** gate on lock state — `unlocked` is data the screen
  acts on. Deciding what a deep link to a locked Module does is the router's
  job, not this Target Interface's.
- A Module that is **not** flagged pending but whose content file is missing is
  a content error that CI should have caught; at runtime `getModule` falls back
  to the pending shape rather than throwing, so a screen never goes blank.
- Both methods may cache the fetched content in memory. Checkpoints are read
  through `CheckpointReader` **on every call**, so a freshly written Checkpoint
  shows up without a reload.

**The lock chain — the only unlock rule in the system:**

1. The Module with `ordinal === 1` is **always unlocked**.
2. The Module with `ordinal === n` (n > 1) is unlocked **iff a Checkpoint
   exists for the Module with `ordinal === n − 1`**.
3. Nothing else affects lock state — not drafts, not content, not time.
4. Lock state is **derived at read time and never persisted**.

Because Checkpoints are only ever written in Curriculum order by the app, rule
2 and "every earlier Module has a Checkpoint" coincide in practice. Rule 2 as
written is the normative one — it is what the tests assert, including for a
state arriving through `importState`.

`checkpointAt` is that Module's own Checkpoint `passedAt`, or `null`.

**The seam.** `ICurriculum` depends on `CheckpointReader` and nothing else from
the progression side, so its tests pass a two-line stub
(`{ listCheckpoints: async () => [] }`) and never touch IndexedDB. In the app,
`IProgress` is passed as the `CheckpointReader` — it extends it.

### IProgress — behaviour

The integrity of the whole system: **IProgress is the only writer of
Checkpoints.** No screen, no content file, and no other code module ever
creates, edits, or deletes one.

**The Exit Gate.** A Module's gate is passed **iff its Behavioral Checklist has
been submitted**. That is the sole condition, and it is **self-assessed** —
Kata never runs code, never inspects the learner's solution, and never judges
quality. A draft is not a submission. There is no second condition to add.

Rules, in the order a reviewer should check them:

- `submitChecklist(moduleId, answers)` — when the Module has **no** submitted
  checklist: store the `SubmittedChecklist` with `submittedAt = now`, write
  **exactly one** `Checkpoint` with `passedAt = now`, delete that Module's
  draft, and return the resulting `GateStatus`. The write is atomic: either the
  submitted checklist and the Checkpoint both land, or neither does.
- `submitChecklist` on an **already-submitted** Module is a **no-op** that
  returns the existing `GateStatus`. The original `submittedAt`, the original
  answers, and the original Checkpoint `passedAt` are all kept. Submitting is
  idempotent; a Module never gets a second Checkpoint.
- `submitChecklist` **throws** when `answers` is empty. It does not check that
  every question was answered, because the question set belongs to
  `ICurriculum`; the checklist form owns that rule and keeps submit disabled
  until all three pairs have an answer.
- `saveChecklistDraft(moduleId, partialAnswers)` replaces that Module's draft
  (last write wins) with `savedAt = now`. On an **already-submitted** Module it
  is a no-op. Drafts are never a gate input.
- `getGateStatus(moduleId)` is a pure read: `passed` mirrors "a submitted
  checklist exists", `checklistSubmittedAt` and `checkpointAt` come from the
  stored records, and both are `null` while the gate is not passed. For an
  unknown or pending Module it returns a not-passed status rather than throwing.
- `listCheckpoints()` returns Checkpoints **ordered by the Module's ordinal**,
  i.e. by `moduleId` ascending, which is the same thing given the `m01`…`m05`
  id shape. `getCheckpoint(moduleId)` returns that Module's Checkpoint or
  `null`.
- `exportState()` returns everything stored. `importState(state)` **replaces**
  all three stores wholesale in one transaction, after rejecting a state with a
  `schemaVersion` it does not know or with more than one Checkpoint for the
  same Module. A rejected import changes nothing.
- Every write records the instant it happened and nothing else. There is no
  timeline, streak, schedule, or history of attempts anywhere.

### Screens on top of the two Target Interfaces

| Screen | Reads |
|---|---|
| Curriculum | `ICurriculum.getModules()` for rows and lock state; `IProgress.getChecklistDraft` for the `In progress` tag; `IProgress.listCheckpoints().length` for the nav count |
| Module | `ICurriculum.getModule(id)` for Concept Page, Model Examples, Exercise cards; `IProgress.getGateStatus(id)` for the Exit Gate aside and the poster |
| Exercise | the brief from `ICurriculum.getModule(moduleId)`; `ICurriculum`'s `checklistQuestions` for the form; `IProgress` for draft, submission, and gate banner |

Two consequences worth stating:

- The Exercise route must carry **both** the Module id and the Exercise id — a
  brief is only reachable through its Module.
- The Behavioral Checklist is **per Module**, not per Exercise. Both of a
  Module's Exercise screens show the same checklist state.

Curriculum row tags are composed from `ModuleSummary` plus one draft lookup, in
this precedence:

| Condition | Tag |
|---|---|
| `checkpointAt !== null` | accent `Exit Gate passed` + `Checkpoint · <date>` |
| `!unlocked` | no tag; row at 0.5 opacity, lock icon, click inert |
| a draft exists for the Module | outline `In progress` |
| otherwise | neutral `Ready to start` |

The nav reads `CHECKPOINTS n / 5`, where `n` is the Checkpoint count and the
denominator is the number of Modules in the index — counted, never hard-coded,
and never shown as a percentage.

---

## 3. Content schema

All content is **static JSON, committed to the repo and validated by a JSON
Schema**. The TypeScript types in § 2 (`ModuleIndex`, `ModuleContent` and what
they contain) are the same shapes; the schema is their machine-checkable twin.

```
public/content/index.json          # the module index — served at /Kata/content/index.json
public/content/modules/m01.json    # one file per Module with an authored pack
public/content/modules/m02.json
schemas/module-index.schema.json   # JSON Schema (draft 2020-12) for the index
schemas/module-content.schema.json # JSON Schema for a Module content file
```

`public/` is copied verbatim into the build output, so the deployed app fetches
content from `` `${import.meta.env.BASE_URL}content/…` ``. The `schemas/` folder
is a repo-root authoring artifact and is not shipped.

**Module index** — `{ schemaVersion: 1, modules: [...] }`, every entry
requiring:

| Field | Type | Rule |
|---|---|---|
| `id` | string | `^m\d{2}$`, unique |
| `ordinal` | integer | ≥ 1, unique, contiguous from 1 |
| `title` | string | non-empty; matches `docs/design.md` § Curriculum verbatim |
| `description` | string | non-empty, one line |
| `pending` | boolean | `true` until that Module's content pack is authored |

**Module content** — one file per non-pending Module, requiring:

| Field | Type | Rule |
|---|---|---|
| `schemaVersion` | integer | `1` |
| `id` | string | matches the file name and an index entry |
| `conceptPageMarkdown` | string | non-empty markdown, ~1 page of prose |
| `modelExamples` | array | 2–3 items, each `{ before, after, caption }`, all non-empty; each C# side ≤ 40 lines (an authoring rule, checked in review) |
| `exercises` | array | ≥ 2 briefs, at least one `refactor` and one `construct` |
| `checklistQuestions` | array | **exactly 3**, each `{ id, prompt, options }` with **exactly 2** options `{ value, label }`; option values unique within a question; question ids unique within the Module |

**Exercise brief** — each item of `exercises` requires `id` (`^m\d{2}-e\d+$`,
unique app-wide, equal to its folder name), `type` (`refactor` | `construct`),
`title`, `concept`, `smell`, `targetInterfaceCode` (the C# `interface` the
learner must end up behind), `sizeBudgetLoc` (integer, ≤ 300), and `folderUrl`
(a GitHub folder URL, **or `null`** — the placeholder the schema allows until
the folder is committed; the Exercise screen renders a quiet disabled note
instead of a dead link while it is `null`).

Both schemas set `"additionalProperties": false`, so a stray field is an error
rather than silently ignored data. Content is validated by
`scripts/validate-content.mjs` locally and in CI **before** the build, so
invalid content can never deploy. Checklist prompts must be behaviorally
answerable — countable or doable — per `docs/design.md` § Pedagogy, and no
content text may use a banned term from `docs/ubiquitous-language.md`.

---

## 4. Storage (IndexedDB)

Database `kata`, version 1, three object stores — each keyed by `moduleId`, so
the "at most one per Module" invariant is the key itself:

| Store | `keyPath` | Value | Written by |
|---|---|---|---|
| `checkpoints` | `moduleId` | `Checkpoint` | `IProgress` only, once per Module |
| `submittedChecklists` | `moduleId` | `SubmittedChecklist` | `IProgress` only, once per Module |
| `checklistDrafts` | `moduleId` | `ChecklistDraft` | `IProgress`, replaced on each autosave, deleted on submit |

**That is the entire persisted surface.** Nothing else is ever written: no copy
of the content (the service worker cache holds that), no analytics, no session
or device identity, no timestamps beyond `passedAt`, `submittedAt`, and
`savedAt`. Clearing site data resets the learner to Module 1 unlocked and zero
Checkpoints — which is exactly why `exportState`/`importState` exist as the
backup story.

---

## 5. Authoring-time content workflow

Concept Pages, Model Examples, Exercise briefs, Behavioral Checklist questions,
and exercise material are **drafted at authoring time on the build host, never
at runtime**:

1. **Draft** — a Node script under `scripts/` calls the local `claude` CLI
   headless (installed and authenticated on this host, so drafting costs
   nothing). Every prompt embeds `docs/ubiquitous-language.md` verbatim plus
   the relevant rules from `docs/design.md`. Drafts land in a gitignored
   `drafts/` folder and are never shipped.
2. **Human edit** — one editing pass, then the text is frozen. The Concept Page
   carries the `LLM first draft · human-edited once · frozen` note on screen.
3. **Commit** — the edited text is committed as content JSON (§ 3) and must
   pass schema validation in CI before it can deploy.

Consequences that are not negotiable:

- The shipped app contains **no LLM client, no API key, and no generation
  code**. It only fetches committed JSON.
- **Regeneration means new content committed**, reviewed the same way. Nothing
  is ever generated, overwritten, or mutated at runtime.
- A regenerated Exercise is a **new** Exercise id, never an edit of the old one
  — the old material and the learner's solutions stay valid.

---

## 6. Exercises in the repo

Practice material is committed under `exercises/<moduleId>/<exerciseId>/`, one
folder per Exercise brief, targeting `net10.0`:

```
exercises/
  m01/
    m01-e1/            # refactor type
      README.md        # goal, `dotnet test`, the immutable-Target-Interface rule
      src/             # the Target Interface + deliberately flawed C# behind it
      tests/           # the xUnit Test Suite
    m01-e2/            # construct type
      README.md
      src/             # the Target Interface + a stub only, no implementation
      tests/           # the xUnit Test Suite
```

- **Refactor type**: the planted Smell lives in `src/`; the learner refactors
  behind the fixed C# `interface` until the Test Suite is green.
- **Construct type**: `src/` holds the Target Interface and a stub; the learner
  implements it.
- **The Test Suite is generated from the brief's Target Interface, never from
  the flawed code.** Tests written from the flawed code would bless the Smell.
  This rule is stated in the authoring prompt and in the authoring script's
  header comment.
- The Target Interface is **immutable during the Exercise**. Wanting to change
  it is a signal to record and discuss, not an allowed move.
- The learner clones or copies the folder into their own IDE and runs
  `dotnet test` there. **Kata never runs it, never sees the result, and never
  gates on it.** The Exercise screen simply links to the folder on GitHub via
  the brief's `folderUrl`.
- CI compiles every committed exercise folder (`dotnet build`, build only) so a
  cloned folder is never broken.

---

## 7. Build order (thinnest end-to-end slice first)

1. **Foundation** — these docs, the Vite scaffold on GitHub Pages, the PWA
   baseline, and the terse-output check scripts. Nothing user-visible yet
   beyond the shell.
2. **Read path** — content schema + the five-Module index, `ICurriculum`, then
   the Curriculum, Module, and Exercise screens read-only. Real content for
   Module 1 lands here. The app is useful for reading on day 1.
3. **Progression loop** — `IProgress`, the Behavioral Checklist form, the Exit
   Gate aside and poster, the Checkpoint write, the Curriculum unlock cascade.
   The loop closes here; everything after is content and polish.
4. **Content packs** — Modules 2–5 (Concept Pages, Model Examples, checklist
   questions, briefs) plus the committed exercise folders.
5. **Polish** — the pending-Module placeholder, progress export/import, and the
   design-fidelity sweep against `design/screens/`.

---

## 8. Module 0 discipline

The app is built with the workflow it teaches — it is its own first Exercise.

- **Tests first, from this doc.** Before implementing either Target Interface,
  write its Vitest tests from this document, not from any implementation. The
  commit history has to show that order.
- **The TypeScript `interface` in code is copied from this doc, not retyped.**
  If the two ever differ, this doc is right.
- **This doc changes first.** A Target Interface change edits this file, then
  the code — never the reverse.
- **Every authoring prompt embeds `docs/ubiquitous-language.md`** verbatim, and
  every UI string uses its terms exactly.
- **Critical-path review**: `IProgress`'s gate and Checkpoint write path —
  `submitChecklist` and `importState` — gets a line-by-line human review in its
  PR. It is the only place a Checkpoint is ever created, and Checkpoints are
  the learner's entire progress.
- **Deriving beats storing.** Lock state and gate status are computed from
  Checkpoints and submissions on every read. The only stored facts are the
  three in § 4.

---

## 9. Superseded decisions

The original architecture was a localhost app that ran and checked the
learner's code. Kata is read-only and static instead; these pieces are gone, and
this section is the only place they are named:

| Removed | Why |
|---|---|
| ASP.NET Core minimal API + HTTP endpoints | Nothing is left for a server to do — all content is committed and all progress is local |
| SQLite data model | The browser's IndexedDB holds the only three records worth keeping (§ 4) |
| `IGenerator` (runtime LLM calls) | Content is authored on the build host and committed (§ 5), so the app ships no LLM client and no key |
| `IWorkbench` (materialising an Exercise to disk) | Exercise folders are committed in this repo; the learner clones the folder themselves (§ 6) |
| Verifier CLI (`kata verify`) | Kata does not run the learner's code, so it has nothing to report to |
| Verification Runs, test-result parsing, run history | The Exit Gate is the Behavioral Checklist alone — self-assessed, sole condition — so pass/fail counts have no reader |
| "All Exercise Test Suites green" as a gate condition | Same: the gate has exactly one condition |

The Test Suite is still the trustworthy artifact and still the point of the
practice — the learner runs it in their own IDE and judges their own work.
Kata stopped pretending to check it.
