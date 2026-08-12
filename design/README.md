# Handoff: Kata — Curriculum, Module & Exercise screens

## Overview
Kata is a personal app for learning software design fundamentals through authored C# exercises the learner does in their own IDE. This package hands off the full frontend design: three screens (Curriculum → Module → Exercise), all progression states, brand, and tokens. Product intent lives in `docs/design.md`, architecture and Target Interfaces in `docs/engineering.md`, and the vocabulary contract in `docs/ubiquitous-language.md` — every label in the UI uses those terms exactly.

## About the design files
`DevGym.dc.html` is a **design reference created in HTML** — a working prototype showing intended look and behavior, not production code. The task is to **recreate it in the target stack from `docs/engineering.md`: React (Vite, TypeScript)** as a read-only static PWA — content read from committed JSON, progress kept in the browser's IndexedDB, no backend — using `styles.css` from this folder as the real stylesheet. (The prototype is self-contained — `_ds/` and `support.js` travel with this folder — so it opens in a browser as-is; `screens/` captures are the quick visual index.)

**The prototype and the captures predate the read-only decision.** Wherever they show the app checking the learner's code — the Exercise screen's right-hand aside with its terminal and run history, and the Exercise cards' status column — that region is **not built**. Those parts of `screens/04-state.png` and `screens/05-state.png` are historical; `docs/engineering.md` § 9 records why. Everything else in the prototype is current.

Decoding the old labels you will still see in the prototype and captures (all three are removed terms — `docs/ubiquitous-language.md` § Removed terms): a **Verification Run** was a test run reported back to the app, the **Verifier CLI** (`kata verify`) was what reported it, and the **Workbench** was the folder an Exercise got materialized into. None of them exist: the learner runs the committed Test Suite in their own IDE and the app never hears about it.

## Fidelity
**High-fidelity.** Colors, type, spacing, rules, and states are final. Recreate pixel-close; `styles.css` + `tokens.json` carry every value — never hard-code a hex or px the tokens already carry.

## Contrast floor
Every string the app renders clears **WCAG 2.1 AA (SC 1.4.3)** against the background it actually composites onto — measured over the rendered DOM, not guessed from the token:

- **4.5:1** for body text — anything under 18.66px/700 or 24px.
- **3:1** for large text (≥ 24px, or ≥ 18.66px at weight 700).
- **Only two exemptions,** both WCAG's own: text inside an *inactive* component (a locked Curriculum row at 0.5 opacity, a disabled button), and purely decorative rules and dividers.

So: **secondary text is `--color-text-muted`** (`neutral-700`, 5.83:1 on bg / 5.38:1 on surface), never ink at an alpha — 55% ink read 3.65:1 and failed on every screen (#70). A new token that carries text has to be measured against `--color-bg` *and* `--color-surface` before it ships.

## Brand
- **Name: Kata** — the owner's decision, chosen from the three brand explorations in `design/brand/` (DevGym · Praxis · Kata). `brand/Brand Kata.dc.html` is the adopted brand card.
- **Mark:** `assets/kata-mark.svg` — three steps climbing (ink) to an accent square: the TDD speed limit, the accent square is the gate passed. Ink + accent only; never recolor, never round.
- **Nav lockup:** 18px mark + "Kata" in Archivo 800 / 18px, flush left. Right side: `CHECKPOINTS n / 5` in 12px uppercase, muted (`--color-text-muted`).
- **Historical reference:** `DevGym.dc.html`, `brand/Brand DevGym.dc.html` / `Brand Praxis.dc.html`, `assets/devgym-mark.svg`, and `screens/*.png` keep the old name — not re-captured or edited, kept only as visual reference to prior states.

## Screens
Container: max-width 1200px, 40px gutters, sticky nav (2px bottom rule). Everything flush left. Zero corner radius anywhere.

### 1. Curriculum (`screens/01-state.png`)
- **Purpose:** the fixed, ordered Module list with lock state. Data: `ICurriculum.getModules()`.
- **Header:** kicker (13px uppercase accent) + 54px title, with a 340px muted intro column aligned to the baseline (grid `1fr 340px`, gap 48).
- **Rows:** one per Module. Grid `104px 1fr 230px 36px`, gap 24, padding-block 24, 2px top rule per row + closing 2px rule after the last. Cells: ordinal (30px/800), title (22px h3) over one-line description (13px muted), status column (tag + optional `Checkpoint · date` 11px), trailing icon.
- **Row states:** unlocked → pointer cursor, hover tint (4% ink), arrow-right icon · locked → 0.5 opacity, `not-allowed` cursor, lock icon, click inert · passed → `Exit Gate passed` accent tag + Checkpoint date · in progress → outline tag · fresh → neutral `Ready to start` tag.

### 2. Module (`screens/02` passed · `screens/03` in progress)
- **Purpose:** Concept Page, Model Examples, Exercise list, Exit Gate status. Data: `ICurriculum.getModule(id)` + `IProgress.getGateStatus(id)`.
- **Header:** ghost back button (← Curriculum), kicker `MODULE nn`, 44px title, status tag right-aligned. No rule under the header.
- **Body grid:** `1fr 350px`, gap 56. Sections in the main column separated by 2px `.hr` rules: Concept Page (paragraphs, 66ch max, with `LLM first draft · human-edited once · frozen` note) → Model Examples → Exercises.
- **Model Examples:** before/after pair in a 2px-bordered grid, cells split by a 2px divider (`repeat(auto-fit, minmax(300px, 1fr))` — stacks when narrow). Cell: surface fill, 16/18 padding, BEFORE label (10px uppercase, muted) / AFTER label (accent-700), code 13px/1.65 mono, `overflow-x: auto`. Caption 11px below.
- **Exercise cards:** `.card` row — type tag (`Refactor`/`Construct`, outline), title 16px/800 + Smell line 12px muted, arrow icon. Hover: `--shadow-md`. Whole card navigates. **No status column** — the app knows nothing about the learner's code; the captures' `Green · 12 / 12` column is historical and is not built.
- **Exit Gate aside:** sticky (top 84). Not passed → 2px-bordered panel with a **single condition row** (check icon when met, 14px empty ink-outline square when not): "Behavioral Checklist submitted" + status; closing note about checkpoint-based progression. There is no second row: the gate is the checklist alone. Passed → the **poster**: accent field, bg-colored type, "Passed." at 32px/800, `Checkpoint · date`, next-Module-unlocked line. The poster is the one place red runs as a field.
- **Pending Module (03–05, once unlocked):** placeholder copy for Concept Page / Examples / Exercises (see prototype).

### 3. Exercise (`screens/04`, `05` partially historical · `screens/06` checklist submitted)
The screen is exactly six things: **header, Exercise Spec grid (Concept / Smell / Size budget), Target Interface block, practice-material link, Behavioral Checklist, gate banner.** Nothing on it reports on the learner's code.

- **Purpose:** show the Exercise Spec and its immutable Target Interface, hand the learner the practice folder, and carry the Module's Behavioral Checklist. Data: the brief and the checklist questions from `ICurriculum.getModule(moduleId)`; draft, submission, and gate from `IProgress`. Body grid `1fr 400px`, gap 56 — main column: Spec grid → Target Interface → practice-material link; right column (sticky, top 84): the Behavioral Checklist panel, with the gate banner under it. The right column is where the removed aside used to sit, so its geometry is unchanged.
- **Header:** ghost back (← Module nn), kicker `EXERCISE id · MODULE nn`, 40px title, one tag: `{type}-type` (outline). The captures' `Test Suite · n tests` tag is dropped — a brief carries no test count, and a count would imply the app tracks results.
- **Exercise Spec:** definition grid `130px 1fr`, 1px top rule per row — exactly three rows: Concept / Smell / Size budget (mono 13px). The captures' fourth row is historical.
- **Target Interface:** h6 + `Immutable` accent tag, warning note (12px muted), then the C# block: surface fill, 2px divider border, 16/18 padding, 12.5px/1.6 mono. Content is read-only — the learner may never edit it.
- **Practice-material link:** last block in the main column, after a 2px `.hr`. h6 + a link out to this Exercise's folder on GitHub (the brief's `folderUrl`, new tab), under it a 12px muted note: clone or copy the folder, review the Test Suite before starting, run `dotnet test` in your own IDE. When `folderUrl` is `null` it renders as a quiet disabled note instead of a dead link. No terminal, no command to copy, no results area — Kata never runs anything.
- **Behavioral Checklist:** per Module (not per Exercise), three checks, radio pairs (`.radio`), primary submit disabled until all three answered. No free-text field. Submitted → 2px-bordered read-only panel: check + `Submitted · time` (14px/800), then question/answer rows (1px rules, answers 600 weight). This is the whole Exit Gate.
- **Gate banner:** when the gate passes, an accent block in the right column under the checklist panel: "Exit Gate passed — Checkpoint recorded." + next Module line.

## Interactions & behavior
- Navigation: brand → Curriculum; rows/cards/back buttons as above. No other chrome — three screens only, no editor.
- Hover/pressed/focus/disabled states come from `styles.css` — do not restyle per page. Focus is the 2px accent ring, never the browser default.
- **Checklist flow (the only write in the app):** answering a radio pair autosaves a draft (`IProgress.saveChecklistDraft`); submit stays disabled until all three are answered. Submit (`IProgress.submitChecklist`) stores the submission and writes the Module's one Checkpoint atomically, then the panel flips to the read-only submitted state. Submitting again is a no-op — a Module never gets a second Checkpoint. The prototype's "Simulate verify run" button has no counterpart: **drop it**, along with the pulsing terminal line it drove.
- Gate pass (Behavioral Checklist submitted — the sole condition, self-assessed) → Checkpoint recorded, next Module unlocks in Curriculum, gate panel becomes the poster, banner appears on the Exercise screen.
- **Never render:** timelines, streaks, schedules, scores, grades, spaced-repetition prompts, or anything about the state of the learner's code — test results, pass counts, run history, suite-status chips. Progress is Checkpoints only.

## State management
Screen-local state maps 1:1 onto the **two** Target Interfaces (`docs/engineering.md` § 2), both async, absence always `null`:
- `ICurriculum.getModules()` — Curriculum rows, ordinal order, with `unlocked` and `checkpointAt` already derived.
- `ICurriculum.getModule(id)` — Concept Page, Model Examples, Exercise briefs, and the three checklist questions.
- `IProgress` — the drafts, the submission, the gate (`getGateStatus`), the Checkpoints (`listCheckpoints` also feeds the nav count).

Unlock = a Checkpoint exists for the previous Module. Gate = Behavioral Checklist submitted — the sole condition, self-assessed. Both are derived on read by the Target Interfaces; compute nothing else client-side, and never persist either.

## Design tokens
`styles.css` (ship it) and `tokens.json` (mirror + app-layer values: layout grids, type scale, code sizes, semantics). Key semantics: red = emphasis and attention — primary action and the passed-gate poster; passing = ink + check; locked = 50% opacity. Never a green/red traffic pair. (`semantics.failing` in `tokens.json` has no rendered use now that no screen reports test results.)

## Assets
- `assets/kata-mark.svg` — brand mark (also the app-icon/favicon source). `assets/devgym-mark.svg` stays in place as a historical artifact, no longer used.
- Icons: [Lucide](https://lucide.dev), 2px stroke, currentColor — used: arrow-right, arrow-left, lock, check, x.
- No photography in the app. If any is ever added it prints grayscale.

## Files
- `README.md` — this spec
- `issue-guide.md` — how to write GitHub issues against this design
- `styles.css` — the design-system stylesheet (tokens + component classes)
- `tokens.json` — machine-readable tokens
- `assets/kata-mark.svg` — the Kata brand mark (current)
- `assets/devgym-mark.svg` — historical artifact, kept for reference, no longer used
- `screens/01…06-state.png` — captured states: 01 Curriculum · 02 Module 01 passed (poster) · 03 Module 02 in progress · 04 Exercise 2a failing · 05 Exercise 2b fresh · 06 Exercise 1a checklist submitted (historical filenames, kept as visual reference, not re-captured). **04 and 05 are partially historical:** their right-hand aside (terminal, latest-run block, run-history table) and the Exercise cards' status column in 02/03 were removed with the read-only decision and are not built — match everything else in them.
- `DevGym.dc.html` — the interactive prototype (open in a browser as-is; historical filename, kept as visual reference, not re-captured or edited)
- `brand/` — brand explorations: `Brand Kata.dc.html` is the adopted card; `Brand DevGym.dc.html` and `Brand Praxis.dc.html` stay in place as historical explorations
- The three docs — design.md, engineering.md, ubiquitous-language.md — now live in the repo-root `docs/`; the duplicate `uploads/` copies were byte-identical and have been removed
- `_ds/` + `support.js` — design-system bundle and prototype runtime (keep next to the prototype)
