# Check scripts

Terse-output checks, for humans and agents alike. **One line on success. Full
detail to a file. Read the log only when a line says FAIL.**

| Script | What it checks | Success line |
|---|---|---|
| `scripts/smoke.sh` | the **deployed** site (`$KATA_URL`, default <https://rishabh7g.github.io/Kata/>) | `SMOKE 13/13 ok \| <url>` |
| `scripts/test-scoped.sh <file…>` | Vitest over just the files a change touched | `TEST ok \| 2 passed (2) \| 12 passed (12) \| <files>` |
| `scripts/validate-content.mjs [<schema> <file\|dir>]` | content JSON against its JSON Schema | `CONTENT ok (1 file)` |
| `scripts/build-exercises.sh` | every committed `exercises/**/` folder compiles (`dotnet build`, build only) | `EXERCISES ok \| 2/2 Test Suites compile` |

```sh
scripts/smoke.sh                                    # after a deploy
scripts/test-scoped.sh src/pwa/sw.test.ts           # after a change
FULL=1 scripts/test-scoped.sh                       # the whole suite, on purpose
node scripts/validate-content.mjs                   # repo layout; also runs in CI
scripts/build-exercises.sh                          # exercise folders; also runs in CI (#22)
```

## The contract

- **Success** prints exactly one line and exits 0.
- **Failure** exits non-zero, prints the failing step, a ~20-line extract, and
  the log path — nothing else. Diagnosis starts from that block.
- **Transcripts** go to `.checks/` (gitignored): `smoke.log`, `test.log`,
  `content.log`. Override the directory with `$KATA_CHECKS_DIR`.
- **Exit codes are distinct per stage**, so a caller can branch without parsing
  text:

| Script | Codes |
|---|---|
| `smoke.sh` | 0 ok · 2 usage/precondition · 10 shell · 11 app bundle · 12 stylesheet · 13 font · 14 manifest · 15 service worker · 16 icons · 17 content · 18 exercise folders · 19 m02 exercise folders · 20 m03 exercise folders · 21 m04 exercise folders · 22 m05 exercise folders |
| `test-scoped.sh` | 0 ok · 2 usage/precondition (including no args without `FULL=1`) · otherwise Vitest's own status |
| `validate-content.mjs` | 0 ok or SKIP · 2 usage · 3 invalid content · 4 missing schema/content path |
| `build-exercises.sh` | 0 ok (including the explicit zero-folders pass) · 2 usage/precondition (dotnet missing) · 3 one or more folders failed to build |
| `draft-concept.mjs` | 0 ok · 2 usage (bad flag/module id) · 3 draft exists without `--force` · 4 claude CLI missing/failed · 5 non-JSON or empty CLI output |
| `draft-exercise.mjs` | 0 ok · 2 usage (bad flag/brief) · 3 exercise folder exists (new Exercise id, no `--force`) · 4 claude CLI missing/failed · 5 CLI output breaks the JSON contract |

## Authoring: `draft-concept.mjs` (#20)

Drafts a Concept Page with the local `claude` CLI — step 1 of the workflow in
`docs/engineering.md` § 5 (draft → human edit → commit). Authoring-time only:
it never runs in the app or the deploy path, and `drafts/` is gitignored.

```sh
node scripts/draft-concept.mjs m02             # DRAFT m02 ok → drafts/m02-concept.md
node scripts/draft-concept.mjs m02 --dry-run   # print the assembled prompt, write nothing
node scripts/draft-concept.mjs m02 --force     # overwrite an existing draft
```

- The module id must exist in `public/content/index.json`.
- The prompt embeds `docs/ubiquitous-language.md` verbatim, the pedagogy rules
  from `docs/design.md` § Pedagogy, and the renderer's markdown limits
  (headings, `-`/`1.` lists, strong/em/inline code — nothing else).
- **Modules 2–5 (#24–#27):** run it for the module, edit the draft by hand,
  then paste the frozen text into `public/content/modules/mNN.json` as
  `conceptPageMarkdown` and check it with `node scripts/validate-content.mjs`.
  `public/content/modules/m01.json` is the canonical example of tone and shape.

## Authoring: `draft-exercise.mjs` (#21)

Drafts one Exercise's practice material — flawed source (refactor type) or
stub (construct type), the xUnit Test Suite, `smell-notes.md` — into a
candidate folder `exercises/<module>/<exercise-id>/` for human review before
commit (#23). Same authoring-time-only footing as `draft-concept.mjs`; the
shared plumbing lives in `scripts/lib/authoring.mjs`.

```sh
node scripts/draft-exercise.mjs public/content/modules/m01.json m01-e1
                                    # DRAFT m01-e1 ok → exercises/m01/m01-e1 | 177 src LOC (budget 250)
node scripts/draft-exercise.mjs path/to/brief.json            # a standalone brief file
node scripts/draft-exercise.mjs path/to/brief.json --dry-run  # print the prompt, write nothing
```

- Input is an Exercise brief JSON (shape per `schemas/module-content.schema.json`
  › `exerciseBrief`), either standalone or picked out of a Module pack by id.
- **The Test Suite is generated from the brief's Target Interface, never from
  the flawed code** — tests written from the flawed code would bless the Smell.
  The script writes the Target Interface `.cs` and both `net10.0` csproj files
  deterministically; the model never gets to paraphrase the interface.
- **No `--force`:** an existing folder exits 3 — regeneration is always a NEW
  Exercise id (`docs/engineering.md` § 5), never an overwrite.
- The summary line reports generated src LOC and says `OVER the N LOC budget`
  when the draft exceeds the brief's `sizeBudgetLoc`.
- After review, `dotnet build tests/Exercise.Tests.csproj` inside the folder
  must pass; CI will compile every committed folder (#22).

## CI: exercise Test Suites must compile (#22)

`build-exercises.sh` also runs in `.github/workflows/exercises.yml` — its own
workflow, separate from the Pages deploy, path-filtered to `exercises/**` (plus
the script and the workflow file). One `ok <folder>` line per Exercise folder
and a final count go to the job log; the full dotnet transcript is uploaded as
the `exercise-build-logs` artifact. With zero folders committed the job passes
with the explicit `0 Test Suites (none committed yet)` line. Build only — Kata
never runs `dotnet test` in CI (`docs/engineering.md` § 6).

## Content checks are live (#7)

The content schema and JSON shipped in #7 (`docs/engineering.md` § 3), so
`validate-content.mjs` (repo-layout mode) and the smoke content step are real
gates over:

```
schemas/module-index.schema.json     # draft 2020-12 schema for the index
schemas/module-content.schema.json   # draft 2020-12 schema for a Module pack
public/content/index.json            # the Module index (all 5 Modules)
public/content/modules/mNN.json      # one per non-pending Module in the index
```

While every Module is `pending` there are no `modules/mNN.json` files, so the
repo-layout run validates just the index: `CONTENT ok (1 file)`. If the schema
or index ever goes missing, both checks print an explicit `SKIP` — never a
silent pass.

`scripts/fixtures/` holds a cut-down stand-in schema with valid and deliberately
broken JSON that keeps the validator itself tested, plus `invalid-index/` —
broken JSON for the **real** index schema, proving it rejects a module entry
missing `ordinal`, `title`, or `description` (`scripts/harness.test.ts`).

## The standing convention

**Every issue that adds a route, an asset, or a content file adds a matching
check line to `scripts/smoke.sh`.** Verification coverage then grows with the
product instead of lagging it, at no extra cost per issue.
