# Handoff: Kata — Curriculum, Module & Exercise screens

## Overview
Kata is a personal app for learning software design fundamentals through authored C# exercises the learner does in their own IDE. This package hands off the full frontend design: three screens (Curriculum → Module → Exercise), all progression states, brand, and tokens. Product intent lives in `docs/design.md`, architecture and Target Interfaces in `docs/engineering.md`, and the vocabulary contract in `docs/ubiquitous-language.md` — every label in the UI uses those terms exactly.

## About the design files
`DevGym.dc.html` is a **design reference created in HTML** — a working prototype showing intended look and behavior, not production code. The task is to **recreate it in the target stack from `docs/engineering.md`: React (Vite, TypeScript)** as a read-only static PWA — content read from committed JSON, progress kept in the browser's IndexedDB, no backend — using `styles.css` from this folder as the real stylesheet. (The prototype is self-contained — `_ds/` and `support.js` travel with this folder — so it opens in a browser as-is; `screens/` captures are the quick visual index.)

**The prototype and the captures predate the read-only decision.** Wherever they show the app checking the learner's code — the Exercise screen's right-hand aside with its terminal and run history, and the Exercise cards' status column — that region is **not built**. Those parts of `screens/04-state.png` and `screens/05-state.png` are historical; `docs/engineering.md` § 9 records why. Everything else in the prototype is current.

**The captures also predate the 16px body-text floor (#108).** `screens/01…06-state.png` were taken at the old 15px base with the reading layer down to 11px; the shipping app now floors every piece of reading text at 16px (`styles.css` `body`, `tokens.json` `typeScale.base.body` / `typeScale.app`). The layout, rules, and colors in the captures are still current — only the small type reads smaller in the PNGs than it renders today.

Decoding the old labels you will still see in the prototype and captures (all three are removed terms — `docs/ubiquitous-language.md` § Removed terms): a **Verification Run** was a test run reported back to the app, the **Verifier CLI** (`kata verify`) was what reported it, and the **Workbench** was the folder an Exercise got materialized into. None of them exist: the learner runs the committed Test Suite in their own IDE and the app never hears about it.

## Fidelity
**High-fidelity.** Colors, type, spacing, rules, and states are final. Recreate pixel-close; `styles.css` + `tokens.json` carry every value — never hard-code a hex or px the tokens already carry.

## Contrast floor
Every string the app renders clears **WCAG 2.1 AA (SC 1.4.3)** against the background it actually composites onto — measured over the rendered DOM, not guessed from the token:

- **4.5:1** for body text — anything under 18.66px/700 or 24px.
- **3:1** for large text (≥ 24px, or ≥ 18.66px at weight 700).
- **3:1 for meaningful non-text (SC 1.4.11)** — not just the focus ring: every icon or marker that *is* the state it reports answers to this, and so does every **form control's indicator**. The Self-Check's radio dot is the control — the `input` behind it is 0×0 — and unanswered, in `--color-divider`, it read **2.41:1** (#97); it takes `--color-text-muted`. (The Exit Gate's empty square answered to the same floor after reading 1.80:1 in `neutral-400` (#93); the gate is gone (#157), the floor is not.)
- **Only two exemptions,** both WCAG's own: text inside an *inactive* component (a disabled button), and purely decorative rules and dividers — `--color-divider` draws those, and only those.

So:

- **Secondary text is `--color-text-muted`** (`neutral-700`, 5.83:1 on bg / 5.38:1 on surface), never ink at an alpha — 55% ink read 3.65:1 and failed on every screen (#70).
- **Accent text is `--color-accent-text`** (`accent-700`, 6.41:1 / 5.91:1). `--color-accent` is a **field** colour — posters, the passed banner, rules, the 2px focus ring — and reads 3.76:1 on bg / 3.47:1 on surface: enough for non-text (SC 1.4.11, 3:1), never enough for a string (#71). Kickers, links, ghost labels, outline tags and the primary action's field all take the ink one.
- **One recorded exception, now historical:** the passed **poster** and **gate banner** kept the brand field, so their ground-coloured type read 3.27–3.76:1 — the large-text floor, not 4.5:1. Both went with the gate (#157) and nothing renders ground-coloured type today; the rule stands for the next thing that wants to: display type only, never a small string on that field.

A new token that carries text — or that draws an icon or marker with a meaning — has to be measured against `--color-bg` *and* `--color-surface` before it ships. `src/styles/contrast.test.ts` holds both floors in CI: 4.5:1 for the text roles, 3:1 for the markers, and a sweep asserting `--color-divider` paints nothing but rules, panel edges and table lines (#97).

## Brand
- **Name: Kata** — the owner's decision, chosen from the three brand explorations in `design/brand/` (DevGym · Praxis · Kata). `brand/Brand Kata.dc.html` is the adopted brand card.
- **Mark:** `assets/kata-mark.svg` — three steps climbing (ink) to an accent square: the TDD speed limit, the accent square is the gate passed. Ink + accent only; never recolor, never round.
- **Nav lockup:** 18px mark + "Kata" in Archivo 800 / 18px, flush left — and nothing on the right (#156). The nav used to carry a `CHECKPOINTS n / 5` readout there; the Library never measures the reader, so permanent chrome has nothing to count and the nav is a way back to the Curriculum, not a readout.
- **Historical reference:** `DevGym.dc.html`, `brand/Brand DevGym.dc.html` / `Brand Praxis.dc.html`, `assets/devgym-mark.svg`, and `screens/*.png` keep the old name — not re-captured or edited, kept only as visual reference to prior states.

## Screens
Container: max-width 1200px, 40px gutters, sticky nav (2px bottom rule). Everything flush left. Zero corner radius anywhere.

**Heading levels are the outline, not the type scale (#75).** Every screen is one `h1` (the screen title), then `h2` for each section label, then `h3` for anything nested inside a section — Curriculum Module titles, Concept Page prose. The design system hangs its 13px uppercase *label* style on the `h6` tag, so section labels used to be marked up `h6` and the outline skipped (`h1 → h6 → h3`); the label type now travels on `.module-section-label` / `.exercise-section-label` instead. Never pick a heading tag for its size — pick the level, then style it.

**Every screen means the failure states too (#94).** A notice (`Notice.tsx`, the 2px-rule panel behind the blocked-progress-database and Module-content-unavailable states) *is* the screen when it is raised, so its title is that screen's `h1`, sized by `.app-notice-title` rather than by its tag. It was an `h2` with no `h1` anywhere on the page. `src/test/headings.ts` is the rule in code — one `h1`, no skipped levels — and every screen that can render, including these, asserts against it.

**The tab names the screen (#77).** `document.title` is `<screen> · Kata`, set by `useDocumentTitle` from the screen's own data: Curriculum plain `Kata`, Module `Module 03 — Testing at Boundaries + TDD loop · Kata`, Exercise `m01-e2 Build a recent-values cache behind a two-method surface · Kata`. While a screen's content is still loading it is plain `Kata` — never the previous screen's name — and the title is how a screen-reader user learns that a hash route changed at all.

### 1. Curriculum (`screens/01-state.png`)
- **Purpose:** the Library's index — every Category in order, each with its Modules in reading order, all of them open. Data: `ICurriculum.getCategories()` for the headings, `ICurriculum.getModules()` for the rows.
- **Header:** kicker (13px uppercase `--color-accent-text`) + 54px title, with a 340px muted intro column aligned to the baseline (grid `1fr 340px`, gap 48).
- **Category headings (#163):** the rows group under their Category, in Category-ordinal order, rows within in Module-ordinal order. The heading block is the Category's title (32px, marked up `h2` — one level under the page `h1`), the Category's language beside it in the neutral tag (`C#` / `Python`, shown **once** per Category and never on a row), and its one-line description under both (16px muted). A heading is a **label, not a route**: no link, no filter, no collapse, and no Category screen — Kata is still three screens, and the row stays the only way into a Module. A Category whose Modules are all `pending` renders exactly like any other.
- **Rows:** one per Module. Grid `104px 1fr 230px 36px`, gap 24, padding-block 24, 2px top rule per row + closing 2px rule after the last. Cells: ordinal (30px/800), title (22px, marked up `h3` — one level under its Category's `h2`) over one-line description (16px muted, the body-text floor #108), status column (tag), trailing icon.
- **Row states:** every row is a link (#156) — pointer cursor, hover tint (4% ink), arrow-right icon, always. The inert state is gone with the lock chain: no 0.5 opacity, no `not-allowed` cursor, no lock icon and no reason to give, because reading is never blocked. The row's one tag is about the reader's own Self-Check answers: in progress → outline tag · fresh → neutral `Ready to start` tag. (Historical: the row once had a locked state whose reason lived in the status column, `.visually-hidden` at first (#73, #74) and on screen from #140, plus an `Exit Gate passed` tag with a Checkpoint date. `screens/01-state.png` still shows them.)

### 2. Module (`screens/02` passed · `screens/03` in progress)
- **Purpose:** Concept Page, Model Examples, Exercise list, Self-Check. Data: `ICurriculum.getModule(id)` + the Self-Check answers from `IProgress`.
- **Header:** ghost back button (← Curriculum), kicker `MODULE nn`, 44px title. No rule under the header, and **no status tag** (#157) — the Library reports no state back to the reader, so the header is kicker over title and nothing else. (Historical: `screens/02`/`03` show an `Exit Gate passed` / `In progress` / `Ready to start` tag on the title's baseline.)
- **Body grid:** `1fr 350px`, gap 56. Sections in the main column separated by 2px `.hr` rules: Concept Page (paragraphs, 66ch max, with `LLM first draft · human-edited once · frozen` note) → Model Examples → Exercises.
- **Model Examples:** before/after pair in a 2px-bordered grid, cells split by a 2px divider (`repeat(auto-fit, minmax(300px, 1fr))` — stacks when narrow). Cell: surface fill, 16/18 padding, BEFORE label (10px uppercase, muted) / AFTER label (`--color-accent-text`), code 16px/1.65 mono (the body-text floor #108), `overflow-x: auto`. Caption 16px below.
- **Exercise cards:** `.card` row — type tag (`Refactor`/`Construct`, outline), title 16px/800 + Smell line 16px muted (the body-text floor #108), arrow icon. Hover: `--shadow-md`. Whole card navigates. **No status column** — the app knows nothing about the learner's code; the captures' `Green · 12 / 12` column is historical and is not built.
- **Self-Check aside:** sticky (top 84), the 350px column's only content (#157). A 2px-bordered panel: the `Self-Check` section label, one clause saying what a Self-Check is, then the Module's three questions as radio pairs (`.radio`; the dot *is* the control — unanswered it is a 16px circle outlined in `--color-text-muted`, the 3:1 non-text floor, #97). Picking an option autosaves it; nothing else on the screen changes. **No submit control, no submitted state, no panel state of any kind.** (Historical: this column held the Exit Gate panel and its passed poster — `screens/02`/`03` still show them; both went with the gate, along with the one place red ran as a field.)
- **Pending Module (03–05):** placeholder copy for Concept Page / Examples / Exercises (see prototype). It carries no questions, so it renders **no aside at all**.

### 3. Exercise (`screens/04`, `05` partially historical · `screens/06` historical)
The screen is exactly four things: **header, Exercise Spec grid (Concept / Smell / Size budget), Target Interface block, practice-material link.** Nothing on it reports on the learner's code, and it writes nothing.

- **Purpose:** show the Exercise Spec and its immutable Target Interface, and hand the learner the practice folder. Data: the brief inside `ICurriculum.getModule(moduleId)` — this screen reads no progress at all. **One column** (#157): the 400px aside went with the Behavioral Checklist, whose questions are the Module's Self-Check now, answered on the Module screen. Main column: Spec grid → Target Interface → practice-material link.
- **Header:** ghost back (← Module nn), kicker `EXERCISE id · MODULE nn`, 40px title, one tag: `{type}-type` (outline). The captures' `Test Suite · n tests` tag is dropped — a brief carries no test count, and a count would imply the app tracks results.
- **Exercise Spec:** definition grid `130px 1fr`, 1px top rule per row — exactly three rows: Concept / Smell / Size budget (mono 16px, the body-text floor #108). The captures' fourth row is historical.
- **Target Interface:** section label + `Immutable` accent tag, warning note (16px muted, the body-text floor #108), then the C# block: surface fill, 2px divider border, 16/18 padding, 16px/1.6 mono. Content is read-only — the learner may never edit it.
- **Practice-material link:** last block in the main column, after a 2px `.hr`. Section label + a link out to this Exercise's folder on GitHub (the brief's `folderUrl`, new tab), under it a 16px muted note (the body-text floor #108): clone or copy the folder, review the Test Suite before starting, and — with the Category language's toolchain installed on your own machine, and from the Exercise folder's `tests/` directory — run the language's command (`dotnet test` under a C# Category, `pytest` under a Python one) in your own IDE. The prerequisite and the working directory are stated here because this note is the only instruction on the step, and the folder's own README carries them one step too late, after cloning (#141). The language name and the command both come from `src/strings/language.ts`, the one `CategoryLanguage` table the Curriculum's headings also read (#163, #164). When `folderUrl` is `null` it renders as a quiet disabled note instead of a dead link. No terminal, no command to copy, no results area — Kata never runs anything.
- **Historical:** the right column here carried the Behavioral Checklist panel and, once the gate passed, an accent banner ("Exit Gate passed — Checkpoint recorded." + next Module line). `screens/06-state.png` is that state. Both are gone (#157); the questions live on the Module screen as its Self-Check.

## Interactions & behavior
- Navigation: brand → Curriculum; rows/cards/back buttons as above. No other chrome — three screens only, no editor.
- Hover/pressed/focus/disabled states come from `styles.css` — do not restyle per page. Focus is the 2px brand-accent ring (non-text, 3.76:1), never the browser default.
- **Self-Check flow (the only write in the app):** picking a radio option saves it immediately (`IProgress.saveChecklistDraft`) and the answers restore on the next visit. There is nothing to press: no submit, no completeness rule, no state text, no navigation change — answering all three questions leaves every other pixel of the app identical to answering none (#157). The prototype's "Simulate verify run" button has no counterpart: **drop it**, along with the pulsing terminal line it drove.
- **Never render:** timelines, streaks, schedules, scores, grades, spaced-repetition prompts, or anything about the state of the learner's code — test results, pass counts, run history, suite-status chips. Nor a pass state of any kind: nothing is submitted, nothing is passed, nothing is recorded but the reader's own answers.

## State management
Screen-local state maps 1:1 onto the **two** Target Interfaces (`docs/engineering.md` § 2), both async, absence always `null`:
- `ICurriculum.getCategories()` — the Curriculum's Category headings, ordinal order: id, ordinal, title, description, language, exactly as authored.
- `ICurriculum.getModules()` — Curriculum rows, Category ordinal then Module ordinal. Id, categoryId, language, ordinal, title, description, pending: the authored index entry and nothing about the reader (#158).
- `ICurriculum.getModule(id)` — Concept Page, Model Examples, Exercise briefs, and the three checklist questions.
- `IProgress` — the Self-Check answers, one record per Module, and nothing else: `saveSelfCheckAnswers` / `getSelfCheckAnswers` plus `exportState` / `importState` for the backup file (#159). The gated-course model's records went with the `kata` database it kept them in; the app opens `kata-v2` and deletes the old one on the first load.

The two Target Interfaces do not touch each other: `createCurriculum(content)` reads no progress data, so there is nothing to derive per reader (#158). Compute nothing else client-side, and never persist it.

## Design tokens
`styles.css` (ship it) and `tokens.json` (mirror + app-layer values: layout grids, type scale, code sizes, semantics). Key semantics: red = emphasis and attention — primary action (field red `--color-accent`; any red *string* uses `--color-accent-text`); passing = ink + check. Never a green/red traffic pair. (`semantics.failing` in `tokens.json` has no rendered use now that no screen reports test results; `semantics.locked` is gone with the lock chain, #158.)

## Assets
- `assets/kata-mark.svg` — brand mark (also the app-icon/favicon source). `assets/devgym-mark.svg` stays in place as a historical artifact, no longer used.
- Icons: [Lucide](https://lucide.dev), 2px stroke, currentColor — used: arrow-right, arrow-left, check, x.
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
