# Kata

A personal app for learning software design fundamentals through generated C#
exercises. Three screens only — Curriculum → Module → Exercise — with no
in-browser editor: a React (Vite, TypeScript) frontend against an ASP.NET Core
minimal API, plus a small `devgym verify` CLI that runs `dotnet test` in the
learner's own IDE workspace and posts a Verification Run back to the app.

Progression is checkpoint-based. A Module's Exit Gate opens only when all of its
Exercise Test Suites are green **and** the Behavioral Checklist has been
submitted; passing records a Checkpoint and unlocks the next Module. There are
no timelines, streaks, schedules, scores, or grades anywhere in the system.

## Start here

| Doc | What it is |
|---|---|
| [`docs/design.md`](docs/design.md) | Product intent — thesis, pedagogy, curriculum, non-goals |
| [`docs/engineering.md`](docs/engineering.md) | Architecture, the four Target Interfaces, data model, build order |
| [`docs/ubiquitous-language.md`](docs/ubiquitous-language.md) | Vocabulary contract — every UI label uses these terms exactly |
| [`design/README.md`](design/README.md) | Frontend design handoff spec — read before building any screen |
| [`design/DevGym.dc.html`](design/DevGym.dc.html) | Interactive prototype — open in a browser as-is |
| [`design/screens/`](design/screens/) | Captured states 01–06 (Curriculum, Module, Exercise) |
| [`design/issue-guide.md`](design/issue-guide.md) | How to write issues against this design |
| [`design/tokens.json`](design/tokens.json) + [`design/styles.css`](design/styles.css) | Design tokens and the shipping stylesheet |

## Status

Design package complete. Implementation not started.

## Naming

**Open decision — settle before implementation starts.** This repo is named
**Kata**, but the entire design package uses **DevGym**: all three docs, the
prototype (`design/DevGym.dc.html`), the brand mark
(`design/assets/devgym-mark.svg`), and the CLI command (`devgym verify`).

`design/README.md` argues for keeping DevGym — it is "already the name across
the docs and the CLI; renaming would break the ubiquitous language."
`design/brand/` holds three explorations (DevGym · Praxis · Kata) if the
question is still open.

Nothing has been renamed. Pick one name first, then rename in a single
deliberate pass — the ubiquitous language is a contract, so a half-applied
rename is worse than either option.

## How work happens

- Every change is a **GitHub issue**; one PR per issue; PR title references the
  issue; **squash-merge**; `main` is always deployable.
- **Verify on the deployed/running instance before closing an issue** — green
  tests are not sufficient on their own.
