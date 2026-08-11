# Handoff: DevGym — Curriculum, Module & Exercise screens

## Overview
DevGym is a personal app for learning software design fundamentals through generated C# exercises. This package hands off the full frontend design: three screens (Curriculum → Module → Exercise), all progression states, brand, and tokens. Product intent lives in `docs/design.md`, architecture and Target Interfaces in `docs/engineering.md`, and the vocabulary contract in `docs/ubiquitous-language.md` — every label in the UI uses those terms exactly.

## About the design files
`DevGym.dc.html` is a **design reference created in HTML** — a working prototype showing intended look and behavior, not production code. The task is to **recreate it in the target stack from `docs/engineering.md`: React (Vite, TypeScript)** against the ASP.NET Core minimal API, using `styles.css` from this folder as the real stylesheet. (The prototype is self-contained — `_ds/` and `support.js` travel with this folder — so it opens in a browser as-is; `screens/` captures are the quick visual index.)

## Fidelity
**High-fidelity.** Colors, type, spacing, rules, and states are final. Recreate pixel-close; `styles.css` + `tokens.json` carry every value — never hard-code a hex or px the tokens already carry.

## Brand
- **Name: DevGym** — already the name across the docs and the CLI (`devgym verify`); renaming would break the ubiquitous language.
- **Mark:** `assets/devgym-mark.svg` — a barbell built from two deep modules (ink) joined by the thinnest possible interface (accent). Ink + accent only; never recolor, never round.
- **Nav lockup:** 18px mark + "DevGym" in Archivo 800 / 18px, flush left. Right side: `CHECKPOINTS n / 5` in 12px uppercase, 55% ink.

## Screens
Container: max-width 1200px, 40px gutters, sticky nav (2px bottom rule). Everything flush left. Zero corner radius anywhere.

### 1. Curriculum (`screens/01-state.png`)
- **Purpose:** the fixed, ordered Module list with lock state. Data: `ICurriculum.GetModules()`.
- **Header:** kicker (13px uppercase accent) + 54px title, with a 340px muted intro column aligned to the baseline (grid `1fr 340px`, gap 48).
- **Rows:** one per Module. Grid `104px 1fr 230px 36px`, gap 24, padding-block 24, 2px top rule per row + closing 2px rule after the last. Cells: ordinal (30px/800), title (22px h3) over one-line description (13px muted), status column (tag + optional `Checkpoint · date` 11px), trailing icon.
- **Row states:** unlocked → pointer cursor, hover tint (4% ink), arrow-right icon · locked → 0.5 opacity, `not-allowed` cursor, lock icon, click inert · passed → `Exit Gate passed` accent tag + Checkpoint date · in progress → outline tag · fresh → neutral `Ready to start` tag.

### 2. Module (`screens/02` passed · `screens/03` in progress)
- **Purpose:** Concept Page, Model Examples, Exercise list, Exit Gate status. Data: `ICurriculum.GetModule(id)` + `IProgress.GetGateStatus(id)`.
- **Header:** ghost back button (← Curriculum), kicker `MODULE nn`, 44px title, status tag right-aligned. No rule under the header.
- **Body grid:** `1fr 350px`, gap 56. Sections in the main column separated by 2px `.hr` rules: Concept Page (paragraphs, 66ch max, with `LLM first draft · human-edited once · frozen` note) → Model Examples → Exercises.
- **Model Examples:** before/after pair in a 2px-bordered grid, cells split by a 2px divider (`repeat(auto-fit, minmax(300px, 1fr))` — stacks when narrow). Cell: surface fill, 16/18 padding, BEFORE label (10px uppercase, neutral-600) / AFTER label (accent-700), code 13px/1.65 mono, `overflow-x: auto`. Caption 11px below.
- **Exercise cards:** `.card` row — type tag (`Refactor`/`Construct`, outline), title 16px/800 + Smell line 12px muted, right-aligned suite status (`Green · 12 / 12` ink · `Failing · 9 / 11` accent-700 · `No runs yet` neutral-500, all 14px/800) over runs meta (11px), arrow icon. Hover: `--shadow-md`. Whole card navigates.
- **Exit Gate aside:** sticky (top 84). Not passed → 2px-bordered panel, two condition rows (check icon when met, 14px empty ink-outline square when not): "All Exercise Test Suites green" + count, "Behavioral Checklist submitted" + status; closing note about checkpoint-based progression. Passed → the **poster**: accent field, bg-colored type, "Passed." at 32px/800, `Checkpoint · date`, next-Module-unlocked line. The poster is the one place red runs as a field.
- **Pending Module (03–05, once unlocked):** placeholder copy for Concept Page / Examples / Exercises (see prototype).

### 3. Exercise (`screens/04` failing · `screens/05` fresh · `screens/06` checklist submitted)
- **Purpose:** Exercise Spec, Target Interface, Behavioral Checklist, Verification history. Data: exercise from `ICurriculum.GetModule`, runs + gate via `IProgress`.
- **Header:** ghost back (← Module nn), kicker `EXERCISE id · MODULE nn`, 40px title, tags: `{type}-type` (outline) + `Test Suite · n tests` (neutral).
- **Body grid:** `1fr 400px`, gap 56.
- **Exercise Spec:** definition grid `130px 1fr`, 1px top rule per row — Concept / Smell / Size budget / Workbench (mono 13px).
- **Target Interface:** h6 + `Immutable` accent tag, warning note (12px muted), then the C# block: surface fill, 2px divider border, 16/18 padding, 12.5px/1.6 mono. Content is read-only — the learner may never edit it.
- **Behavioral Checklist:** module-level, three checks, radio pairs (`.radio`), primary submit disabled until all three answered. No free-text field. Submitted → 2px-bordered read-only panel: check + `Submitted · time` (14px/800), then question/answer rows (1px rules, answers 600 weight).
- **Verification aside:** sticky, 2px-bordered. Header row (h6 + `Green`/`Failing` tag) over a terminal block (neutral-900 bg, neutral-100 text, 12px/1.8 mono, `$` prompts in neutral-500) showing `cd <workbench>` + `devgym verify`, and a pulsing `dotnet test — running…` line while a run is pending. Result area: latest run as `{passed}` 42px/800 + `/ n passed · latest Verification Run`; failing test names listed in 12px mono accent-700 with x icons. Fresh state: "No Verification Runs yet." + review-the-Test-Suite note. Below: `.table` history — Run / At / Result (`9 / 11 · failing` accent-700, `· green` ink), newest first.
- **Gate banner:** when the gate passes, an accent block under the aside: "Exit Gate passed — Checkpoint recorded." + next Module line.

## Interactions & behavior
- Navigation: brand → Curriculum; rows/cards/back buttons as above. No other chrome — three screens only, no editor.
- Hover/pressed/focus/disabled states come from `styles.css` — do not restyle per page. Focus is the 2px accent ring, never the browser default.
- **Verify flow (real system):** the Verifier CLI posts a Verification Run to the API; the frontend **polls gate status** and re-renders history, latest-run block, card statuses, and the gate panel. The prototype's "Simulate verify run" button (900ms fake latency + pulsing terminal line) stands in for exactly that; replace with polling, keep the visual states.
- Checklist submit → panel flips to read-only submitted state.
- Gate pass (all suites green + checklist submitted) → Checkpoint recorded, next Module unlocks in Curriculum, gate panel becomes the poster, banner appears on the Exercise screen.
- **Never render:** timelines, streaks, schedules, scores, grades, spaced-repetition prompts. Progress is Checkpoints only.

## State management
Screen-local state maps 1:1 onto the four Target Interfaces (`docs/engineering.md`): module list + lock chain (`ICurriculum.GetModules`), module detail (`GetModule`), verification runs + checklist + gate (`IProgress`). Unlock = previous Module's gate passed; gate = all Exercise suites green AND checklist submitted — compute nothing else client-side.

## Design tokens
`styles.css` (ship it) and `tokens.json` (mirror + app-layer values: layout grids, type scale, code sizes, semantics). Key semantics: red = emphasis and attention — primary action, failing text (accent-700), passed-gate poster; passing = ink + check; locked = 50% opacity. Never a green/red traffic pair.

## Assets
- `assets/devgym-mark.svg` — brand mark (also the favicon source).
- Icons: [Lucide](https://lucide.dev), 2px stroke, currentColor — used: arrow-right, arrow-left, lock, check, x.
- No photography in the app. If any is ever added it prints grayscale.

## Files
- `README.md` — this spec
- `issue-guide.md` — how to write GitHub issues against this design
- `styles.css` — the design-system stylesheet (tokens + component classes)
- `tokens.json` — machine-readable tokens
- `assets/devgym-mark.svg`
- `screens/01…06-state.png` — captured states: 01 Curriculum · 02 Module 01 passed (poster) · 03 Module 02 in progress · 04 Exercise 2a failing · 05 Exercise 2b fresh · 06 Exercise 1a checklist submitted
- `DevGym.dc.html` — the interactive prototype (open in a browser as-is)
- `brand/` — brand explorations (DevGym · Praxis · Kata cards)
- The three docs — design.md, engineering.md, ubiquitous-language.md — now live in the repo-root `docs/`; the duplicate `uploads/` copies were byte-identical and have been removed
- `_ds/` + `support.js` — design-system bundle and prototype runtime (keep next to the prototype)
