# Kata

A personal, self-paced Library for learning software design fundamentals, written
under one principle: **explain it to me like a novice**. Three screens only —
Curriculum → Module → Exercise — with no in-browser editor: a read-only React
(Vite, TypeScript) PWA served as static files from GitHub Pages, reading content
committed to this repo and keeping the learner's Self-Check answers in the
browser's IndexedDB. No backend, no accounts, and no code execution — the
learner clones an Exercise folder and runs its tests in their own IDE.

Every Module is open from the first visit. Nothing is submitted, nothing is
judged, and nothing unlocks: a Module's questions are an optional Self-Check
answered while reading and autosaved in place. Stored progress is the
Self-Check answers and nothing else — no timelines, streaks, schedules, scores,
or grades anywhere in the system.

## Start here

| Doc | What it is |
|---|---|
| [`docs/01-design.md`](docs/01-design.md) | Product intent — the one principle, pedagogy, the editorial standard every Concept Page meets, Categories and Modules, non-goals |
| [`docs/02-engineering.md`](docs/02-engineering.md) | Architecture, the two Target Interfaces (`ICurriculum`, `IProgress`), content schema, storage — the shapes themselves live in [`src/curriculum/contract.ts`](src/curriculum/contract.ts) |
| [`docs/03-ubiquitous-language.md`](docs/03-ubiquitous-language.md) | Vocabulary contract — Library, Category, Module, Self-Check; every UI label uses these terms exactly |
| [`docs/04-simplification-plan.md`](docs/04-simplification-plan.md) | The simplification plan — rung's method (measure at 360px, said once, no vestiges, contract tests only) applied to Kata, with the measured baseline, batches C → A → B → D → E → G → F, and targets |
| [`src/styles/base.css`](src/styles/base.css) | The design system — tokens, type scale, components — and the single source of styling truth |

## Run it

The app is a Vite + React + TypeScript static build, served from
<https://rishabh7g.github.io/Kata/>. Node 24.

```sh
npm ci              # install
npm run dev         # local dev server
npm test            # Vitest
npm run build       # type-check (strict) + production build into dist/
scripts/verify.sh   # every gate, in order — the one command that answers "is this healthy?"
```

[`scripts/verify.sh`](scripts/verify.sh) runs TYPES → LINT → TEST → CONTENT →
STRINGS → BUILD, stops at the first failure, and prints one line
(`TYPES ok | LINT ok | TEST n/n ok | CONTENT ok | STRINGS ok | BUILD ok`, the
TEST segment carrying that run's own passed/total count). Each stage's output goes to
`.verify/<stage>.log`; its header comment holds the stage / exit-code table.

`node scripts/validate-content.mjs` validates the committed content against the
two schemas, and CI runs it before every build. `node tools/strings-check.ts`
does the same for the shell's copy bundle — `src/strings/copy.ts` against the
canonical key list in `src/strings/copyKeys.ts` — and `npm run build` runs it,
so an emptied string or a key nothing reads cannot deploy. `node tools/measure.mjs` drives
the built app in a real browser and prints each screen's height and the y of
what the reader came for — hand-run, and it gates nothing.

Every push to `main` runs the same steps in
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) and publishes
`dist/` to GitHub Pages — that Actions run *is* the deploy.

## Status

All three screens are live on GitHub Pages. Curriculum lists the Modules under
their Category heading, all of them open to read; Module carries its Concept Page, Model Examples, Self-Check
and Exercises; Exercise shows the Exercise Spec, the immutable Target Interface,
and the link to the committed practice folder, whose note names the toolchain
and the command for its Category's language (`dotnet test`, `pytest`).

All eleven Modules are authored: the five Software Design Modules each carry a
Concept Page, three Model Examples and two Exercises whose folder and Test
Suite are committed under `exercises/`; the six Agentic AI Modules are
explain-only by design, with one pilot Python Exercise (see `docs/01-design.md`
§ Exercise coverage across the two Categories).

Reading is never blocked: nothing is submitted, nothing is judged, and no Module
waits on another. The only thing the app stores is the reader's Self-Check
answers, autosaved in this browser's IndexedDB. It is an installable PWA — the shell is precached, so it loads
and renders offline.

## Naming

**Resolved: Kata.** Two other names were explored and dropped; nothing in the
tree carries them any more.

## How work happens

- Every change is a **GitHub issue**; one PR per issue; PR title references the
  issue; **squash-merge**; `main` is always deployable.
- **Verify on the deployed/running instance before closing an issue** — green
  tests are not sufficient on their own.
