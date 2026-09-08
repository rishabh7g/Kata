# Kata — Engineering

Kata is a **read-only, offline-capable PWA served as static files from GitHub
Pages out of this repo**. There is no backend, no database server, no runtime
LLM call, and no code execution: the app reads authored content that is
committed to the repo and records the reader's own Self-Check answers in the
browser.
The learner practises C# in their own IDE, against material this repo hands
them. Terms per `03-ubiquitous-language.md`.

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
| Layout | `src/` follows the shared folder vocabulary (`docs/repo-standards.md`). **Lifetime is the line between the first two:** `app/` is the composition root that runs once at startup — `bootstrap.tsx`, the two context providers, and the surface shown when IndexedDB will not open; `shell/` is the chrome that renders for as long as the app does. `components/` holds the pieces more than one screen renders through, `screens/` the routes and the helpers only their own bodies use. Tests and snapshots sit beside their subject |
| Styling | **`src/styles/base.css` is the design system** — the single source of styling truth; `app.css` adds the layout around it |
| Tokens | the custom properties `base.css` defines are the tokens; never hard-code a hex or size one already carries |
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
render the `ModuleUnavailable` notice (`src/components/ModuleUnavailable.tsx`) — the
file that failed, why it is not offline-ready, the browser's own error text,
`Try again`, and the way back to the Curriculum — rather than nothing at all.
A **404 is a failure like any other status**: every indexed Module has a
content file, so a missing one is a content error the reader meets as an
unavailable Module.

Host facts: **Node v24** and the **dotnet 10 SDK** are both available —
Node for the app and the authoring scripts, dotnet only for compiling the
committed exercise material via `scripts/build-exercises.sh` (§ 6). The app itself never invokes dotnet.

Because the app is static, "deploy" means "the Actions run that published
`dist/`". There is nothing to restart and no environment to configure.

---

## 2. The two Target Interfaces

Both Target Interfaces are fully asynchronous, because both of their backing stores (HTTP-fetched JSON
and IndexedDB) are. Absence is always `null`, never `undefined`, so every value
survives a JSON round-trip unchanged. The one exception is an authored field
that may simply not be written (`explanation?`): its key is absent from the JSON
altogether rather than present and empty, which round-trips unchanged too.

In prose a boundary is always a **Target Interface**, and C# code the learner
receives is always a C# `interface`.

The contract itself is [`src/curriculum/contract.ts`](../src/curriculum/contract.ts)
— the file the compiler reads. It used to be reprinted here and copied there by
hand; the copy the compiler checks is the one that cannot drift, so this section
describes the behaviour and the file states the shapes.

### ICurriculum — behaviour

Owns the authored content and nothing else. It is a pure function of content:
given the same content it returns the same output, it reads no progress data at
all, and it **writes nothing, ever**.

- `getCategories()` returns the index's Categories **sorted by `ordinal`**,
  each exactly as authored (id, ordinal, title, description, language). It is
  the titles and one-line descriptions the Curriculum's headings read;
  the rows themselves still come from `getModules()`, so a Category is a
  heading over rows and never a screen, a route or a second way into a Module.
- `getModules()` returns one `ModuleSummary` per entry in the module index,
  **sorted by its Category's `ordinal`, then by its own `ordinal`**. Order
  comes from the data, never from the file order. Each summary carries the
  `categoryId` it was authored under and its Category's `language`,
  denormalized so a screen never has to join the two arrays itself.
- `getModule(id)` returns `ModuleDetail`. For an **unknown id it returns
  `null`** — it never throws and never invents a Module.
- `getModule` answers for **every** Module, always: no Module waits on another
  and nothing here can refuse a read, so a deep link into any Module resolves
  from the first visit.
- A Module whose content file will not load **rejects**, and the screen says
  the Module is unavailable and offers a retry. That is what a missing file is
  too: every indexed Module has one.
- A Module whose `categoryId` names no declared Category cannot deploy — the
  schema rejects the index — so at runtime it is simply **not placed**: it is
  left out of `getModules()` and `getModule` answers `null` for it, by the same
  never-go-blank rule.
- Both methods may cache the fetched content in memory, which is safe because
  the content is committed and immutable per deploy. A **failed** load is never
  cached: the next call fetches again, so a `Try again` after an offline first
  visit can succeed.

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
and is never read as a measure of the reader: Kata never runs code,
never inspects the learner's solution, and never judges quality.

Rules, in the order a reviewer should check them:

- `saveSelfCheckAnswers(moduleId, answers)` replaces that Module's record
  (last write wins) with `savedAt = now`. It accepts a partial map, including
  an empty one, because a reader may answer one question or none.
- `getSelfCheckAnswers(moduleId)` is a pure read of that Module's record, or
  `null` when it has none. For a Module with no record it returns `null`
  rather than throwing.
- Records are **per Module**: writing one Module's answers never touches
  another's, and the key is the `moduleId` itself, so a Module has at most one.
- There is no way to read the whole store out or to replace it. The reader's
  answers live in this browser and nowhere else.
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
  screen, beside the prose it belongs to.

A Curriculum row's tag comes from one answers lookup — `ModuleSummary` carries
no state of the reader at all:

| Condition | Tag |
|---|---|
| the Module has stored Self-Check answers | outline `In progress` |
| otherwise | neutral `Ready to start` |

Two tags, both about the reader's own Self-Check answers and neither a
judgement. The row is always a link, at full opacity, and the nav
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

**Module index** — `{ schemaVersion: 3, categories: [...], modules: [...] }`.
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
| `id` | string | `^[a-z]+\d{2}$`, unique app-wide — a short Category prefix and a 2-digit position (`m01`, `ai01`) |
| `categoryId` | string | equals the `id` of one entry of `categories` |
| `ordinal` | integer | ≥ 1, unique and contiguous from 1 **within its Category** |
| `title` | string | non-empty; matches `docs/01-design.md` § Curriculum verbatim |
| `description` | string | non-empty, one line |

A Module naming a `categoryId` no Category declares is a **content error**, so
the index never validates and never deploys. Reference integrity inside one
document is the one rule draft 2020-12 cannot state, so
`scripts/validate-content.mjs` checks it beside the schema — same gate, same
exit code, before every deploy.

**Module content** — one file per Module, requiring:

| Field | Type | Rule |
|---|---|---|
| `schemaVersion` | integer | `2` |
| `id` | string | matches the file name and an index entry |
| `provenance` | string | which editing stages the pack has been through; a fact about the pack, rendered by no screen |
| `conceptPageMarkdown` | string | non-empty markdown, ~1 page of prose, no title line — the screen's `h1` is the title, and sections open at `##` |
| `modelExamples` | array | 2–3 items, each `{ before, after, caption }`, all non-empty; each code side ≤ 40 lines, in the Category's language (an authoring rule, checked in review) |
| `exercises` | array | 0..n briefs — `[]` is valid and means the Module only explains |
| `selfCheckQuestions` | array | **exactly 3**, each `{ id, prompt, options }` plus an optional `explanation`, with **2–4** options `{ value, label }`; option values unique within a question; question ids unique within the Module |

How many Exercises a Module carries is an **authoring convention, not a schema
rule**: a Software Design Module ships two — one `refactor`, one `construct`
(`docs/01-design.md` § Module anatomy) — while an explain-only Module ships `"exercises":
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
answerable — countable or doable — per `docs/01-design.md` § Pedagogy, and no
content text may use a banned term from `docs/03-ubiquitous-language.md`.

A question's `explanation` is optional and additive: authored, it is revealed
once the reader picks any option, and it is the **same text whichever option
was picked**. It teaches what the question was pointing at; it never says which
option was right, because nothing in Kata is right or wrong. Written to
`docs/01-design.md` § Editorial standard, 1–3 sentences. Question ids unique within
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
the reader's answers and nothing else.

**The old `kata` database is abandoned, not migrated.** It held the
gated model's records, and those describe a judgement the Library no longer
makes, so there is nothing worth carrying forward. Opening `IProgress` deletes
it — `indexedDB.deleteDatabase('kata')`, fire-and-forget: a browser that never
had one is the normal case, and a failure to delete leaves the app working, so
nothing waits on it.

**When IndexedDB will not open at all** (site data blocked for the origin, a
hardened privacy profile, some embedded webviews), there is no Kata to run:
`IProgress` is the only write path. The bootstrap (`src/app/bootstrap.tsx`)
renders the `ProgressUnavailable` notice instead of the app — the cause and the
one fix the learner controls, on the page rather than in the console.

---

## 5. Exercises in the repo

Practice material is committed under `exercises/<moduleId>/<exerciseId>/`, one
folder per Exercise brief, written in the practice language of the Module's
Category (§ 3): C# on `net10.0` for Software Design, Python for Agentic AI.

```
exercises/
  m01/
    m01-e1/            # refactor type, C#
      README.md        # goal, `dotnet test`, the immutable-Target-Interface rule
      src/             # the Target Interface + deliberately flawed C# behind it
      tests/           # the xUnit Test Suite
    m01-e2/            # construct type, C#
      README.md
      src/             # the Target Interface + a stub only, no implementation
      tests/           # the xUnit Test Suite
  ai03/
    ai03-e1/           # construct type, Python
      README.md        # goal, `pytest`, the immutable-Target-Interface rule
      smell-notes.md   # the reviewer's notes, as in every folder
      src/             # the signatures to implement + provided helpers
      tests/           # the pytest Test Suite (conftest.py puts src/ on the path)
```

The layout is the same in both languages, and so is everything below except
the command. A Python folder needs `pip install pytest` and nothing else: the
material is standard-library only, so it runs offline with no API key — an
Exercise that needed a vendor account would be practice nobody could do on a
plane.

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
  `dotnet test` (C#) or `pytest` (Python) there. **Kata never runs it, never
  sees the result, and never gates on it.** The Exercise screen simply links to
  the folder on GitHub via the brief's `folderUrl`, and names the command from
  the Category's language (`src/strings/language.ts`).
- `scripts/build-exercises.sh`, run by hand, checks every committed exercise folder so a cloned folder is never broken,
  and the check follows what is in the folder — no language is silently skipped
 . C# folders are compiled (`dotnet build`, build only); Python folders
  are collected (`pytest --collect-only`), which proves the imports resolve and
  the tests are discoverable. Neither runs a test: a construct Exercise's
  skeleton is red by design, so a gate on execution could never be honest.

---

## 6. Module 0 discipline

The app is built with the workflow it teaches — it is its own first Exercise.

- **Tests first, from this doc.** Before implementing either Target Interface,
  write its Vitest tests from this document, not from any implementation. The
  commit history has to show that order.
- **The TypeScript `interface` in code is copied from this doc, not retyped.**
  If the two ever differ, this doc is right.
- **This doc changes first.** A Target Interface change edits this file, then
  the code — never the reverse.
- **Every authoring prompt embeds `docs/03-ubiquitous-language.md`** verbatim, and
  every UI string uses its terms exactly.
- **Critical-path review**: `IProgress`'s one write path,
  `saveSelfCheckAnswers`, gets a line-by-line human review in its PR. It is
  the only place anything is ever stored.
- **Deriving beats storing.** A screen's state is computed from the stored
  answers on every read. The only stored fact is the one in § 4.

---
