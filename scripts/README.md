# Check scripts

Terse-output checks, for humans and agents alike. **One line on success. Full
detail to a file. Read the log only when a line says FAIL.**

| Script | What it checks | Success line |
|---|---|---|
| `scripts/smoke.sh` | the **deployed** site (`$KATA_URL`, default <https://rishabh7g.github.io/Kata/>) | `SMOKE 7/7 ok \| content SKIP (…) \| <url>` |
| `scripts/test-scoped.sh <file…>` | Vitest over just the files a change touched | `TEST ok \| 2 passed (2) \| 12 passed (12) \| <files>` |
| `scripts/validate-content.mjs [<schema> <file\|dir>]` | content JSON against its JSON Schema | `CONTENT ok (2 files)` |

```sh
scripts/smoke.sh                                    # after a deploy
scripts/test-scoped.sh src/pwa/sw.test.ts           # after a change
FULL=1 scripts/test-scoped.sh                       # the whole suite, on purpose
node scripts/validate-content.mjs                   # repo layout; also runs in CI
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
| `smoke.sh` | 0 ok · 2 usage/precondition · 10 shell · 11 app bundle · 12 stylesheet · 13 font · 14 manifest · 15 service worker · 16 icons · 17 content |
| `test-scoped.sh` | 0 ok · 2 usage/precondition (including no args without `FULL=1`) · otherwise Vitest's own status |
| `validate-content.mjs` | 0 ok or SKIP · 2 usage · 3 invalid content · 4 missing schema/content path |

## Content checks skip loudly until #7

The content schema and JSON land in #7 (`schemas/…`, `public/content/…`,
`docs/engineering.md` § 3). Until they exist, `validate-content.mjs` and the
smoke content step print an explicit `SKIP` and exit 0 — never a silent pass —
and they become real checks **with no edit** the moment #7 commits:

```
schemas/module-index.schema.json     # draft 2020-12 schema for the index
schemas/module-content.schema.json   # draft 2020-12 schema for a Module pack
public/content/index.json            # the Module index
public/content/modules/mNN.json      # one per non-pending Module in the index
```

`scripts/fixtures/` holds a cut-down stand-in schema with valid and deliberately
broken JSON, so the validator itself stays tested while no real content exists.

## The standing convention

**Every issue that adds a route, an asset, or a content file adds a matching
check line to `scripts/smoke.sh`.** Verification coverage then grows with the
product instead of lagging it, at no extra cost per issue.
