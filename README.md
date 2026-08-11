# Kata

A personal app for learning software design fundamentals through authored C#
exercises. Three screens only — Curriculum → Module → Exercise — with no
in-browser editor: a read-only React (Vite, TypeScript) PWA served as static
files from GitHub Pages, reading content committed to this repo and keeping the
learner's progress in the browser's IndexedDB. No backend, no accounts, and no
code execution — the learner clones an Exercise folder and runs `dotnet test`
in their own IDE.

Progression is Checkpoint-based. A Module's Exit Gate opens on one thing:
Behavioral Checklist submitted — the sole condition, self-assessed. Passing
records a Checkpoint and unlocks the next Module. There are no timelines,
streaks, schedules, scores, or grades anywhere in the system.

## Start here

| Doc | What it is |
|---|---|
| [`docs/design.md`](docs/design.md) | Product intent — thesis, pedagogy, curriculum, non-goals |
| [`docs/engineering.md`](docs/engineering.md) | Architecture, the two Target Interfaces (`ICurriculum`, `IProgress`), content schema, storage, build order |
| [`docs/ubiquitous-language.md`](docs/ubiquitous-language.md) | Vocabulary contract — every UI label uses these terms exactly |
| [`design/README.md`](design/README.md) | Frontend design handoff spec — read before building any screen |
| [`design/DevGym.dc.html`](design/DevGym.dc.html) | Interactive prototype (historical filename, visual reference only) — open in a browser as-is |
| [`design/screens/`](design/screens/) | Captured states 01–06 (Curriculum, Module, Exercise) |
| [`design/issue-guide.md`](design/issue-guide.md) | How to write issues against this design |
| [`design/tokens.json`](design/tokens.json) + [`design/styles.css`](design/styles.css) | Design tokens and the shipping stylesheet |

## Status

Design package complete. Implementation not started.

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
