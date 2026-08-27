# Kata — Engineering

Kata is a **read-only, offline-capable PWA served as static files from GitHub
Pages out of this repo**. There is no backend, no database server, no runtime
LLM call, and no code execution: the app reads authored content that is
committed to the repo and records the reader's own Self-Check answers in the
browser.
The learner practises C# in their own IDE, against material this repo hands
them. Terms per `ubiquitous-language.md`.

Everything the app does is behind **two Target Interfaces** — `ICurriculum`
(read the authored content) and `IProgress` (own the reader's Self-Check
answers). Everything else is React rendering on top of them.

Depth check applied to our own design: 2 Target Interfaces, 6 methods, hiding
content fetching and caching, IndexedDB, and the backup file's shape. A screen
needs to know none of that.

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

Not precaching the content JSON has one visible consequence, and it is a state,
not a bug: a Module that has never been read online cannot be read offline.
When `ICurriculum.getModule(id)` rejects, the Module and Exercise screens
render the `ModuleUnavailable` notice (`src/app/ModuleUnavailable.tsx`) — the
file that failed, why it is not offline-ready, the browser's own error text,
`Try again`, and the way back to the Curriculum — rather than nothing at all
(#69). A **404 is not a failure**: a missing content file means the Module is
pending, and the pending placeholder renders as usual.

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
survives a JSON round-trip unchanged. The one exception is an authored field
that may simply not be written (`explanation?`): its key is absent from the JSON
altogether rather than present and empty, which round-trips unchanged too.

The code block below is written as TypeScript `interface` declarations. In prose
a boundary is always a **Target Interface**, and C# code the learner receives is
always a C# `interface`.

```ts
// ── Ids and scalars ──────────────────────────────────────────────────────

/** Module id exactly as committed in the content files; opaque to the app. */
export type ModuleId = string;

/** Category id exactly as committed in the content files; opaque to the app. */
export type CategoryId = string;

/** Exercise id, unique app-wide, equal to its repo folder name: 'm01-e1'. */
export type ExerciseId = string;

/** Self-Check question id, unique within its Module: 'q1' … 'q3'. */
export type SelfCheckQuestionId = string;

/** ISO-8601 instant in UTC, e.g. '2026-08-12T09:41:00.000Z'. */
export type IsoDateTime = string;

export type ExerciseType = 'refactor' | 'construct';

/** The one practice language every Module in a Category is written in. */
export type CategoryLanguage = 'csharp' | 'python';

// ── Authored content (committed JSON, read-only at runtime) ──────────────

export interface Category {
  readonly id: CategoryId;
  readonly ordinal: number; // 1-based, contiguous, the order Categories read in
  readonly title: string;
  readonly description: string; // one line, shown under the title
  readonly language: CategoryLanguage; // every Module in it practises this one
}

export interface ModuleIndexEntry {
  readonly id: ModuleId;
  readonly categoryId: CategoryId; // the one Category this Module belongs to
  readonly ordinal: number; // 1-based, contiguous within its Category
  readonly title: string;
  readonly description: string; // one line, shown under the title
  readonly pending: boolean; // true = content pack not authored yet
}

export interface ModuleIndex {
  readonly schemaVersion: 2;
  readonly categories: readonly Category[];
  readonly modules: readonly ModuleIndexEntry[];
}

export interface ModelExample {
  readonly before: string; // source in the Category's language, <= 40 lines
  readonly after: string; // source in the Category's language, <= 40 lines
  readonly caption: string; // what moved or got hidden
}

export interface ExerciseBrief {
  readonly id: ExerciseId;
  readonly type: ExerciseType;
  readonly title: string;
  readonly concept: string; // Exercise Spec row 1
  readonly smell: string; // Exercise Spec row 2 — the planted flaw
  readonly targetInterfaceCode: string; // Category's language, read-only
  readonly sizeBudgetLoc: number; // <= 300
  readonly folderUrl: string | null; // GitHub folder link; null until committed
}

export interface SelfCheckOption {
  readonly value: string; // the stored answer value
  readonly label: string; // what the radio shows
}

export interface SelfCheckQuestion {
  readonly id: SelfCheckQuestionId;
  readonly prompt: string; // behaviorally answerable — countable or doable
  readonly options: readonly SelfCheckOption[]; // 2–4 radios
  /** Revealed once any option is picked, and the SAME text whichever one was:
   *  it teaches, it never marks an answer right or wrong. 1–3 sentences in the
   *  novice voice (docs/design.md § Editorial standard). Absent = the question
   *  reveals nothing at all. */
  readonly explanation?: string;
}

export interface ModuleContent {
  readonly schemaVersion: 1;
  readonly id: ModuleId;
  readonly conceptPageMarkdown: string;
  readonly modelExamples: readonly ModelExample[]; // 2–3
  readonly exercises: readonly ExerciseBrief[]; // 0..n; [] = explains only
  readonly selfCheckQuestions: readonly [
    SelfCheckQuestion,
    SelfCheckQuestion,
    SelfCheckQuestion,
  ]; // exactly 3
}

// ── Reader answers (the only data Kata ever persists) ────────────────────

/** A Module's Self-Check picks: one option value per question id. Always
 *  partial — none, some, or all three answered are equally normal. */
export type SelfCheckAnswers = Readonly<
  Partial<Record<SelfCheckQuestionId, string>>
>;

/** One Module's stored Self-Check answers; at most one record per Module. */
export interface ModuleSelfCheck {
  readonly moduleId: ModuleId;
  readonly answers: SelfCheckAnswers;
  readonly savedAt: IsoDateTime; // when the last pick was autosaved
}

/** The whole persisted state, in one value: backup file and test fixture. */
export interface ProgressState {
  readonly schemaVersion: 2;
  readonly selfCheckAnswers: readonly ModuleSelfCheck[];
}

// ── What ICurriculum hands to the screens ────────────────────────────────

export interface ModuleSummary {
  readonly id: ModuleId;
  readonly categoryId: CategoryId; // denormalized from the index, for grouping
  readonly language: CategoryLanguage; // denormalized from its Category
  readonly ordinal: number; // within its Category
  readonly title: string;
  readonly description: string;
  readonly pending: boolean;
}

export interface ModuleDetail extends ModuleSummary {
  readonly conceptPageMarkdown: string; // '' when pending
  readonly modelExamples: readonly ModelExample[]; // [] when pending
  readonly exercises: readonly ExerciseBrief[]; // [] when pending
  readonly selfCheckQuestions: readonly SelfCheckQuestion[]; // [] when pending, else 3
}

// ── Seams ────────────────────────────────────────────────────────────────

/** Where authored content comes from: HTTP in the app, in-memory in tests. */
export interface ContentSource {
  loadIndex(): Promise<ModuleIndex>;
  /** null = the Module has no content file yet (pending). */
  loadModuleContent(id: ModuleId): Promise<ModuleContent | null>;
}

// ── Target Interface 1 of 2: ICurriculum ─────────────────────────────────

export interface ICurriculum {
  /** Every Category, in its own ordinal order — the shelves the Curriculum
   *  groups its rows under. */
  getCategories(): Promise<readonly Category[]>;
  /** Every Module, ordered by Category ordinal, then Module ordinal. */
  getModules(): Promise<readonly ModuleSummary[]>;
  /** Full detail for one Module; null when the id is unknown. */
  getModule(id: ModuleId): Promise<ModuleDetail | null>;
}

export declare function createCurriculum(content: ContentSource): ICurriculum;

// ── Target Interface 2 of 2: IProgress ───────────────────────────────────

export interface IProgress {
  /** Autosave of a Module's Self-Check picks; replaces what was stored. */
  saveSelfCheckAnswers(
    moduleId: ModuleId,
    answers: SelfCheckAnswers,
  ): Promise<void>;
  /** One Module's stored answers; null when that Module has none. */
  getSelfCheckAnswers(moduleId: ModuleId): Promise<ModuleSelfCheck | null>;
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

Owns the authored content and nothing else. It is a pure function of content:
given the same content it returns the same output, it reads no progress data at
all, and it **writes nothing, ever**.

- `getCategories()` returns the index's Categories **sorted by `ordinal`**,
  each exactly as authored (id, ordinal, title, description, language). It is
  the titles and one-line descriptions the Curriculum's headings read (#163);
  the rows themselves still come from `getModules()`, so a Category is a
  heading over rows and never a screen, a route or a second way into a Module.
- `getModules()` returns one `ModuleSummary` per entry in the module index,
  **sorted by its Category's `ordinal`, then by its own `ordinal`**. Order
  comes from the data, never from the file order. Each summary carries the
  `categoryId` it was authored under and its Category's `language`,
  denormalized so a screen never has to join the two arrays itself.
- `getModule(id)` returns `ModuleDetail`. For an **unknown id it returns
  `null`** — it never throws and never invents a Module. For a **pending**
  Module it returns detail with `pending: true` and empty content
  (`conceptPageMarkdown: ''`, `[]` for the three arrays); the screen renders the
  pending placeholder from that.
- `getModule` answers for **every** Module, always: no Module waits on another
  and nothing here can refuse a read, so a deep link into any Module resolves
  from the first visit (#156).
- A Module that is **not** flagged pending but whose content file is missing is
  a content error that CI should have caught; at runtime `getModule` falls back
  to the pending shape rather than throwing, so a screen never goes blank.
- A Module whose `categoryId` names no declared Category cannot deploy — the
  schema rejects the index — so at runtime it is simply **not placed**: it is
  left out of `getModules()` and `getModule` answers `null` for it, by the same
  never-go-blank rule.
- Both methods may cache the fetched content in memory, which is safe because
  the content is committed and immutable per deploy. A **failed** load is never
  cached: the next call fetches again, so a `Try again` after an offline first
  visit can succeed (#69).

**The one seam.** `createCurriculum` takes a `ContentSource` and nothing else,
so `ICurriculum` and `IProgress` never touch each other: the Library has no
lock chain to derive (#156, #158). Its tests pass an in-memory `ContentSource`
and never touch IndexedDB.

### IProgress — behaviour

The integrity of the whole system: **IProgress is the app's only write path**,
and what it writes is the reader's own Self-Check answers — nothing else. No
screen, no content file, and no other code module ever writes storage.

**Answers are not a judgement.** An answer is stored because the reader picked
it and would like it back on the next visit. It opens nothing, closes nothing,
and is never read as a measure of the reader (#159): Kata never runs code,
never inspects the learner's solution, and never judges quality.

Rules, in the order a reviewer should check them:

- `saveSelfCheckAnswers(moduleId, answers)` replaces that Module's record
  (last write wins) with `savedAt = now`. It accepts a partial map, including
  an empty one, because a reader may answer one question or none.
- `getSelfCheckAnswers(moduleId)` is a pure read of that Module's record, or
  `null` when it has none. For an unknown or pending Module it returns `null`
  rather than throwing.
- Records are **per Module**: writing one Module's answers never touches
  another's, and the key is the `moduleId` itself, so a Module has at most one.
- `exportState()` returns everything stored, ordered by `moduleId` ascending —
  the Module's ordinal, given the `m01`…`m05` id shape. `importState(state)`
  **replaces** the store wholesale in one transaction, after rejecting a state
  with a `schemaVersion` it does not know. A rejected import changes nothing.
- Every write records the instant it happened and nothing else. There is no
  timeline, streak, schedule, or history of attempts anywhere.

### Screens on top of the two Target Interfaces

| Screen | Reads |
|---|---|
| Curriculum | `ICurriculum.getCategories()` for the headings and `ICurriculum.getModules()` for the rows under them, both in ordinal order; `IProgress.getSelfCheckAnswers` for the `In progress` tag |
| Module | `ICurriculum.getModule(id)` for Concept Page, Model Examples, Exercise cards; its `selfCheckQuestions` for the Self-Check, whose picks are `IProgress.getSelfCheckAnswers(id)` |
| Exercise | the brief from `ICurriculum.getModule(moduleId)`; no `IProgress` read at all |

Two consequences worth stating:

- The Exercise route must carry **both** the Module id and the Exercise id — a
  brief is only reachable through its Module.
- The Self-Check is **per Module**, not per Exercise: it lives on the Module
  screen, beside the prose it belongs to (#157).

A Curriculum row's tag comes from one answers lookup — `ModuleSummary` carries
no state of the reader at all:

| Condition | Tag |
|---|---|
| the Module has stored Self-Check answers | outline `In progress` |
| otherwise | neutral `Ready to start` |

Two tags, both about the reader's own Self-Check answers and neither a
judgement. The row is always a link, at full opacity (#156), and the nav
carries the Kata lockup and no tally of any kind.

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

**Module index** — `{ schemaVersion: 2, categories: [...], modules: [...] }`.
A **Category** is a titled group of Modules that share one practice language,
and every Module belongs to exactly one. Each entry of `categories` requires:

| Field | Type | Rule |
|---|---|---|
| `id` | string | `^[a-z0-9]+(-[a-z0-9]+)*$`, unique — an opaque slug, not a position |
| `ordinal` | integer | ≥ 1, unique, contiguous from 1 — the order Categories read in |
| `title` | string | non-empty, one line |
| `description` | string | non-empty, one line |
| `language` | string | `csharp` \| `python` — the language its Modules practise |

Each entry of `modules` requires:

| Field | Type | Rule |
|---|---|---|
| `id` | string | `^m\d{2}$`, unique app-wide |
| `categoryId` | string | equals the `id` of one entry of `categories` |
| `ordinal` | integer | ≥ 1, unique and contiguous from 1 **within its Category** |
| `title` | string | non-empty; matches `docs/design.md` § Curriculum verbatim |
| `description` | string | non-empty, one line |
| `pending` | boolean | `true` until that Module's content pack is authored |

A Module naming a `categoryId` no Category declares is a **content error**, so
the index never validates and never deploys. Reference integrity inside one
document is the one rule draft 2020-12 cannot state, so
`scripts/validate-content.mjs` checks it beside the schema — same gate, same
exit code, and it runs against the deployed index in `scripts/smoke.sh` too.

**Module content** — one file per non-pending Module, requiring:

| Field | Type | Rule |
|---|---|---|
| `schemaVersion` | integer | `1` |
| `id` | string | matches the file name and an index entry |
| `conceptPageMarkdown` | string | non-empty markdown, ~1 page of prose |
| `modelExamples` | array | 2–3 items, each `{ before, after, caption }`, all non-empty; each code side ≤ 40 lines, in the Category's language (an authoring rule, checked in review) |
| `exercises` | array | 0..n briefs — `[]` is valid and means the Module only explains |
| `selfCheckQuestions` | array | **exactly 3**, each `{ id, prompt, options }` plus an optional `explanation`, with **2–4** options `{ value, label }`; option values unique within a question; question ids unique within the Module |

How many Exercises a Module carries is an **authoring convention, not a schema
rule**: a Software Design Module ships two — one `refactor`, one `construct`
(`docs/design.md` § Module anatomy) — while an explain-only Module ships `"exercises":
[]` and simply reads shorter. The schema counts nothing, so neither shape is a
content error.

**Exercise brief** — each item of `exercises` requires `id` (`^m\d{2}-e\d+$`,
unique app-wide, equal to its folder name), `type` (`refactor` | `construct`),
`title`, `concept`, `smell`, `targetInterfaceCode` (the Target Interface the
learner must end up behind, in the Category's language), `sizeBudgetLoc`
(integer, ≤ 300), and `folderUrl`
(a GitHub folder URL, **or `null`** — the placeholder the schema allows until
the folder is committed; the Exercise screen renders a quiet disabled note
instead of a dead link while it is `null`).

Both schemas set `"additionalProperties": false`, so a stray field is an error
rather than silently ignored data. Content is validated by
`scripts/validate-content.mjs` locally and in CI **before** the build, so
invalid content can never deploy. Self-Check prompts must be behaviorally
answerable — countable or doable — per `docs/design.md` § Pedagogy, and no
content text may use a banned term from `docs/ubiquitous-language.md`.

A question's `explanation` is optional and additive: authored, it is revealed
once the reader picks any option, and it is the **same text whichever option
was picked**. It teaches what the question was pointing at; it never says which
option was right, because nothing in Kata is right or wrong. Written to
`docs/design.md` § Editorial standard, 1–3 sentences. Question ids unique within
a Module and option values unique within a question are the two rules draft
2020-12 cannot state, so `scripts/validate-content.mjs` checks them beside the
schema — same gate, same exit code, same run against the deployed content.

---

## 4. Storage (IndexedDB)

Database `kata-v2`, version 1, **one** object store — keyed by `moduleId`, so
the "at most one per Module" invariant is the key itself:

| Store | `keyPath` | Value | Written by |
|---|---|---|---|
| `selfCheckAnswers` | `moduleId` | `ModuleSelfCheck` | `IProgress`, replaced on each autosave |

**That is the entire persisted surface.** Nothing else is ever written: no copy
of the content (the service worker cache holds that), no analytics, no session
or device identity, no timestamp beyond `savedAt`. Clearing site data clears
the reader's answers and nothing else — which is why `exportState`/
`importState` exist as the backup story.

**The old `kata` database is abandoned, not migrated** (#159). It held the
gated model's records, and those describe a judgement the Library no longer
makes, so there is nothing worth carrying forward. Opening `IProgress` deletes
it — `indexedDB.deleteDatabase('kata')`, fire-and-forget: a browser that never
had one is the normal case, and a failure to delete leaves the app working, so
nothing waits on it.

**When IndexedDB will not open at all** (site data blocked for the origin, a
hardened privacy profile, some embedded webviews), there is no Kata to run:
`IProgress` is the only write path. The bootstrap (`src/app/bootstrap.tsx`)
renders the `ProgressUnavailable` notice instead of the app — the cause and the
one fix the learner controls, on the page rather than in the console (#68).

---

## 5. Authoring-time content workflow

Concept Pages, Model Examples, Exercise briefs, Self-Check questions,
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
3. **Answer loop** — `IProgress` and the Self-Check form: the reader's picks
   are stored and restored. Everything after is content and polish. (Built
   first as a gated progression loop; un-gated in L1, #155–#159.)
4. **Content packs** — Modules 2–5 (Concept Pages, Model Examples, Self-Check
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
- **Critical-path review**: `IProgress`'s write paths —
  `saveSelfCheckAnswers` and `importState` — get a line-by-line human review in
  their PR. They are the only places anything is ever stored, and the stored
  answers are everything the reader would lose.
- **Deriving beats storing.** A screen's state is computed from the stored
  answers on every read. The only stored fact is the one in § 4.

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
| Verification Runs, test-result parsing, run history | Kata records nothing but the reader's own Self-Check answers, so pass/fail counts have no reader |
| Test Suite results as a pass condition | A Module has no pass condition at all (#155) — the Library opens every page from the first visit |

The Test Suite is still the trustworthy artifact and still the point of the
practice — the learner runs it in their own IDE and judges their own work.
Kata stopped pretending to check it.
