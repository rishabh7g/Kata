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
| [`docs/design.md`](docs/design.md) | Product intent — the one principle, pedagogy, the editorial standard every Concept Page meets, Categories and Modules, non-goals |
| [`docs/engineering.md`](docs/engineering.md) | Architecture, the two Target Interfaces (`ICurriculum`, `IProgress`), content schema, storage, build order — normative: its § 2 code block is the single source the code copies |
| [`docs/ubiquitous-language.md`](docs/ubiquitous-language.md) | Vocabulary contract — Library, Category, Module, Self-Check; every UI label uses these terms exactly |
| [`design/README.md`](design/README.md) | Frontend design handoff spec — read before building any screen |
| [`design/DevGym.dc.html`](design/DevGym.dc.html) | Interactive prototype (historical filename, visual reference only) — open in a browser as-is |
| [`design/screens/`](design/screens/) | Captured states 01–06 (Curriculum, Module, Exercise) — historical: taken before the Library reframe |
| [`design/issue-guide.md`](design/issue-guide.md) | How to write issues against this design |
| [`design/tokens.json`](design/tokens.json) + [`design/styles.css`](design/styles.css) | Design tokens and the shipping stylesheet |

## Run it

The app is a Vite + React + TypeScript static build, served from
<https://rishabh7g.github.io/Kata/>. Node 24.

```sh
npm ci        # install
npm run dev   # local dev server
npm test      # Vitest
npm run build # type-check (strict) + production build into dist/
```

Every push to `main` runs the same steps in
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) and publishes
`dist/` to GitHub Pages — that Actions run *is* the deploy.

## Status

All three screens are live on GitHub Pages. Curriculum lists the Modules under
their Category heading, all of them open to read; Module carries its Concept Page, Model Examples, Self-Check
and Exercises; Exercise shows the Exercise Spec, the immutable Target Interface,
and the link to the committed practice folder. All five Software Design Modules
are authored — a Concept Page, three Model Examples, and two Exercises whose
folder and Test Suite are committed under `exercises/`.

Reading is never blocked: nothing is submitted, nothing is judged, and no Module
waits on another. The only thing the app stores is the reader's Self-Check
answers, autosaved in this browser's IndexedDB, and export/import moves them to
a file and back. It is an installable PWA — the shell is precached, so it loads
and renders offline.

The Library reframe lands doc-first (`design/issue-guide.md` ground rule 5): the
docs above are the contract, and the screens, contracts and content are being
brought to it one issue at a time.

## Naming

**Resolved: Kata.** `design/brand/` held three explorations — DevGym, Praxis,
Kata — and Kata is the adopted name. The rename landed in a single pass across
the docs, `design/README.md`, the nav lockup, and the brand mark
(`design/assets/kata-mark.svg`).

`design/DevGym.dc.html`, `design/brand/Brand DevGym.dc.html` /
`Brand Praxis.dc.html`, `design/assets/devgym-mark.svg`, and
`design/screens/*.png` keep their old filenames — historical visual reference
only, not re-captured or renamed.

## How work happens

- Every change is a **GitHub issue**; one PR per issue; PR title references the
  issue; **squash-merge**; `main` is always deployable.
- **Verify on the deployed/running instance before closing an issue** — green
  tests are not sufficient on their own.
