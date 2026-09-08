# Kata — project deltas (workflow: see `~/.claude/CLAUDE.md`)

## What this is

A read-only, offline-capable PWA that *shows* software-design material — it
never runs it: three screens (Curriculum → Module → Exercise), no editor, no
backend, no code execution. React 19 + react-router 7 on Vite 8, TypeScript
strict, vitest. The only thing stored is the reader's Self-Check
answers, in this browser's IndexedDB. Node 24. Served from GitHub Pages at
<https://rishabh7g.github.io/Kata/>, under base path `/Kata/`. Intent and
architecture: `docs/01-design.md`, `docs/02-engineering.md`. Cross-repo rules:
[`docs/repo-standards.md`](https://github.com/rishabh7g/claude-setup/blob/main/docs/repo-standards.md).

## How to run it

- `npm ci`, then `npm run dev` → <http://localhost:5173/Kata/> (the base path,
  not `/`). `npm run build` is `tsc --noEmit` + `vite build` into `dist/`.
- **Nothing has to be generated before `dev` or `build`.** Content is committed
  JSON under `public/content/`, validated against `schemas/` by
  `node scripts/validate-content.mjs`; `exercises/` holds the folders a learner
  clones into their own IDE. Neither is a build input.
- `scripts/build-exercises.sh` is the only check the committed Exercise folders
  have — hand-run, gating nothing: it builds each `.csproj` and *collects* (never
  runs) each pytest suite. It needs the toolchain the material it finds is
  written in — a missing `dotnet` or `pytest` is exit 2, never a pass.
- Deploy is a push to `main`: `.github/workflows/deploy.yml` publishes `dist/`
  to Pages, and that Actions run *is* the deploy. Nothing to restart.

## How to verify it

`scripts/verify.sh` → one line on success,
`TYPES ok | LINT ok | TEST n/n ok | CONTENT ok | STRINGS ok | BUILD ok`, where
the TEST
segment carries that run's own passed/total count (per-stage logs in `.verify/`,
exit-code table in the script's own header).

## Deviations from the repo standards

- **`typescript` is pinned to `~6.0.3`, not 7.x.** TypeScript 7's npm package
  ships the native compiler and no JS compiler API, so typescript-eslint refuses
  to load against it and `npx eslint .` aborts before linting a single file.
  Measured, not assumed, and recorded where it bites, in `eslint.config.js`.
- **`verify.sh` carries two extra stages, `CONTENT` (exit 40) and `STRINGS`
  (exit 60), and runs both *before* `BUILD` rather than after the four reserved
  names** — validating content or copy after the build would let a bad one reach
  `dist/`. The codes are what was left over, not the run order.
- **The keyed string bundle is gated by its own key list, not by `tsc`.**
  `src/strings/copy.ts` holds every string the shell renders;
  `src/strings/copyKeys.ts` holds the canonical key list and each key's
  `{placeholders}`, and `tools/strings-check.ts` compares the two (STRINGS, exit
  60; `npm run build` runs it as well, so the deploy fails too). `tsc` only ever
  caught a key that is *read* and then deleted — an unread key and an emptied
  value both passed the whole gate before #240. Still outside it: a new
  hardcoded literal, and authored content, which is deliberately validated as
  content instead.
- **`ajv` is exact-pinned to `8.20.0`, and no reason for that was ever
  recorded.** The commit that added it (2f59cc4, #6) says nothing about the pin
  and no doc explains it; 8.20.0 is also ajv's `latest`, so today the pin costs
  nothing. #237 left it standing rather than retiring a constraint whose purpose
  is unknown — clearing the fast-uri advisories needed no ajv move at all. Retire
  it on purpose or not at all.

## What a newcomer gets wrong

- **`EXERCISES ok | 0 Test Suites (none committed yet)` means the tree really
  is empty, and nothing else.** It used to mean discovery had failed: GNU `find
  -printf` with stderr discarded, so on macOS 11 committed folders read as none
  (#234); or it meant `KATA_EXERCISES_DIR` pointed at nothing at all, which
  skipped discovery in silence and printed the same green line (#235). Where to
  look is now a precondition checked before discovery, discovery itself is one
  POSIX `find` whose status is checked, and `scripts/build-exercises.test.ts`
  pins every case.
- **`npm ci` printing `EBADENGINE` here is the pin working, not a break.**
  `engines.node` is `^22.22.2 || >=24.15.0` (#242), which mirrors
  `jsdom@30.0.1`'s own `^22.22.2 || ^24.15.0 || >=26.0.0` — the strictest Node
  floor anything in this lockfile declares, and the same range rung and Bora.py
  carry. This host runs v24.13.0, which satisfies neither arm, so npm warns for
  `kata` and for `jsdom` and installs anyway; the deploy workflow's
  `node-version: 24` resolves above 24.15.0 and is silent. Raise the host
  (claude-setup#64), not the range.
- **`src/components/__snapshots__/Markdown.concept-pages.html` is behaviour, not a
  fixture** — every authored Concept Page's rendered HTML. Re-pin it on purpose
  with `npx vitest run -u`; an unexplained diff is a parser change, not noise.
- **`docs/04-simplification-plan.md` is a plan record, not the present state.** It
  still names DevGym, `design/` and other things already deleted. The naming
  question is closed: Kata.
- **`npm ls ajv` shows two, and only one of them reaches `fast-uri`.** The
  direct devDependency `ajv@8.20.0` — the one `scripts/validate-content.mjs`
  imports as `ajv/dist/2020.js` — depends on `fast-uri`; `eslint@10.10.0`'s
  nested `ajv@6.15.0` depends on `uri-js` instead and is not on that path.
  "Fixing" the eslint one clears nothing (#237).
- **`verify.sh` was once seen printing `FAIL TEST (exit 30)` with all tests
  passing (#233), and 84 runs under CPU load could not reproduce it.** A red
  TEST is still a red TEST: read the second line of the failure block, which
  names what `npm run test` itself exited with — `1` is vitest's verdict, `137`
  or `143` mean it was killed. If the log is clean and the status is not 1, that
  is the missing evidence #233 asked for.
