# Kata — project deltas (workflow: see `~/.claude/CLAUDE.md`)

## What this is

A read-only, offline-capable PWA that *shows* software-design material — it
never runs it: three screens (Curriculum → Module → Exercise), no editor, no
backend, no code execution. React 19 + react-router 7 on Vite 8, TypeScript
strict, vitest. The only thing stored is the reader's Self-Check
answers, in this browser's IndexedDB. Node 24. Served from GitHub Pages at
<https://rishabh7g.github.io/Kata/>, under base path `/Kata/`. Intent and
architecture: `docs/design.md`, `docs/engineering.md`. Cross-repo rules:
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
  runs) each pytest suite. Broken on macOS; see below.
- Deploy is a push to `main`: `.github/workflows/deploy.yml` publishes `dist/`
  to Pages, and that Actions run *is* the deploy. Nothing to restart.

## How to verify it

`scripts/verify.sh` → `TYPES ok | LINT ok | TEST 77/77 ok | CONTENT ok | BUILD ok`
(per-stage logs in `.verify/`, exit-code table in the script's own header).

## Deviations from the repo standards

- **`typescript` is pinned to `~6.0.3`, not 7.x.** TypeScript 7's npm package
  ships the native compiler and no JS compiler API, so typescript-eslint refuses
  to load against it and `npx eslint .` aborts before linting a single file.
  Measured, not assumed, and recorded where it bites, in `eslint.config.js`.
- **`verify.sh` carries a fifth stage, `CONTENT` (exit 40), and runs it *before*
  `BUILD` rather than after the four reserved names** — validating content after
  the build would let invalid content reach `dist/`.
- **The keyed string bundle has no gate.** Every string the shell renders is in
  `src/strings/copy.ts` as one typed object, and `tsc` catches a key that does
  not exist — but nothing stops a new hardcoded literal, and authored content is
  deliberately outside it. A review habit, not a check.

## What a newcomer gets wrong

- **`scripts/build-exercises.sh` prints a green `0 Test Suites` on macOS** while
  11 folders sit under `exercises/`: discovery uses GNU `find -printf` with
  stderr discarded (#234). A pass from it on a mac means nothing.
- **`src/app/__snapshots__/Markdown.concept-pages.html` is behaviour, not a
  fixture** — every authored Concept Page's rendered HTML. Re-pin it on purpose
  with `npx vitest run -u`; an unexplained diff is a parser change, not noise.
- **`docs/simplification-plan.md` is a plan record, not the present state.** It
  still names DevGym, `design/` and other things already deleted. The naming
  question is closed: Kata.
- **`verify.sh` was once seen printing `FAIL TEST (exit 30)` with all tests
  passing (#233), and 84 runs under CPU load could not reproduce it.** A red
  TEST is still a red TEST: read the second line of the failure block, which
  names what `npm run test` itself exited with — `1` is vitest's verdict, `137`
  or `143` mean it was killed. If the log is clean and the status is not 1, that
  is the missing evidence #233 asked for.
