#!/usr/bin/env bash
#
# Kata smoke test — checks the deployed site, not a local build.
#
# docs/engineering.md § 1 Stack: "deploy" means "the Actions run that published
# dist/". This script is how anyone (or any agent) confirms that run actually
# put a working Kata on https://rishabh7g.github.io/Kata/.
#
#   scripts/smoke.sh                                  # the live Pages URL
#   KATA_URL=http://localhost:4173/Kata/ scripts/smoke.sh   # a local preview
#
# Output contract (scripts/README.md): exactly ONE line on success; the full
# transcript to .checks/smoke.log; on failure a non-zero exit, the failing step
# with a ~20-line extract, and the transcript path. Read the log only on FAIL.
#
# Exit codes: 0 ok · 2 usage/precondition · 10 shell · 11 app bundle ·
#             12 stylesheet · 13 font · 14 manifest · 15 service worker ·
#             16 icons · 17 content · 18 exercise folders ·
#             19 m02 exercise folders · 20 m03 exercise folders ·
#             21 m04 exercise folders · 22 m05 exercise folders
#
set -uo pipefail

REPO="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
URL="${KATA_URL:-https://rishabh7g.github.io/Kata/}"
[[ "$URL" == */ ]] || URL="$URL/"
CHECKS_DIR="${KATA_CHECKS_DIR:-$REPO/.checks}"
LOG="$CHECKS_DIR/smoke.log"
WORK="$CHECKS_DIR/smoke"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  grep '^#' "${BASH_SOURCE[0]}" | cut -c3-
  exit 0
fi

command -v curl >/dev/null || { echo "SMOKE PRECONDITION FAIL: curl is not installed"; exit 2; }
command -v node >/dev/null || { echo "SMOKE PRECONDITION FAIL: node is not installed"; exit 2; }

rm -rf -- "$WORK"
mkdir -p -- "$WORK/content/modules"
: >"$LOG"

PASSED=0
TOTAL=0
CONTENT_NOTE=""
FAILED_STEPS=()
FAILED_CODES=()

note() { printf '[%s] %s\n' "$STEP" "$*" >>"$LOG"; }

begin() { # begin <step-id> <exit-code>
  STEP="$1"
  STEP_CODE="$2"
  STEP_OK=1
  TOTAL=$((TOTAL + 1))
  printf '\n[%s] === %s\n' "$STEP" "$(date -u +%H:%M:%SZ)" >>"$LOG"
}

bad() {
  STEP_OK=0
  note "FAIL $*"
}

end() {
  if ((STEP_OK)); then
    PASSED=$((PASSED + 1))
    note "ok"
  else
    FAILED_STEPS+=("$STEP")
    FAILED_CODES+=("$STEP_CODE")
  fi
}

# get <url> <outfile> — saves the body, notes the status, fails the step on ≠200.
get() {
  local status
  status="$(curl -sS --location --max-time 25 -o "$2" -w '%{http_code}' "$1" 2>>"$LOG")"
  note "GET $1 -> ${status:-000}"
  [[ "$status" == "200" ]] && return 0
  bad "GET $1 returned ${status:-no response} (expected 200)"
  return 1
}

# has <file> <needle> <what> — the marker that proves it is Kata's file.
has() {
  if grep -qF -- "$2" "$1"; then
    note "found $3"
    return 0
  fi
  bad "$(basename "$1") is missing $3 ('$2')"
  return 1
}

# lacks <file> <needle> <what> — the marker a removal must have taken away.
# The mirror of `has`: some issues are proved by what the deployed bundle no
# longer ships, and a check that only ever looks for presence cannot see that.
lacks() {
  if grep -qF -- "$2" "$1"; then
    bad "$(basename "$1") still ships $3 ('$2')"
    return 1
  fi
  note "absent $3"
  return 0
}

# magic <file> <ascii-magic> — first bytes of a binary, e.g. PNG or wOF2.
magic() {
  if node -e '
    const [file, want] = process.argv.slice(1);
    const head = require("node:fs").readFileSync(file).subarray(0, want.length + 1).toString("latin1");
    process.exit(head.includes(want) ? 0 : 1);
  ' "$1" "$2"; then
    note "magic $2 ok"
    return 0
  fi
  bad "$(basename "$1") does not start with $2 — not a real $2 file"
  return 1
}

# json <file> <node-expression on `data`> <what> — a parsed-JSON assertion.
json() {
  local out
  if ! out="$(node -e '
    const [file, expression] = process.argv.slice(1);
    const data = JSON.parse(require("node:fs").readFileSync(file, "utf8"));
    if (!eval(expression)) { console.log("assertion false"); process.exit(1); }
  ' "$1" "$2" 2>&1)"; then
    bad "$(basename "$1"): $3 — ${out##*Error: }"
    return 1
  fi
  note "json $3 ok"
  return 0
}

# ─── 1. app shell ──────────────────────────────────────────────────────────
begin shell 10
if get "$URL" "$WORK/index.html"; then
  has "$WORK/index.html" '<title>Kata</title>' 'the Kata title'
  has "$WORK/index.html" 'id="root"' 'the React mount point'
  has "$WORK/index.html" 'rel="manifest"' 'the manifest link'
fi
end

# The hashed asset names change every build, so they are read off the shell
# rather than pinned here.
ASSETS="$(node -e '
  const [file, base] = process.argv.slice(1);
  const html = require("node:fs").readFileSync(file, "utf8");
  const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const pick = (ext) => urls.find((u) => u.includes("/assets/") && u.endsWith(ext)) ?? "";
  const abs = (u) => (u ? new URL(u, base).href : "");
  console.log(abs(pick(".js")));
  console.log(abs(pick(".css")));
' "$WORK/index.html" "$URL" 2>>"$LOG")"
JS_URL="$(printf '%s\n' "$ASSETS" | sed -n 1p)"
CSS_URL="$(printf '%s\n' "$ASSETS" | sed -n 2p)"

# ─── 2. app bundle (the nav lockup lives here, not in the HTML) ─────────────
# The root route is client-rendered, so "the root route serves the Curriculum
# screen" (#10) means: its markup ships in the bundle the shell loads.
begin app-bundle 11
if [[ -z "$JS_URL" ]]; then
  bad "the shell links no /assets/*.js bundle — nothing would render"
elif get "$JS_URL" "$WORK/app.js"; then
  has "$WORK/app.js" 'app-nav-brand' 'the Kata nav lockup'
  # The nav's count went with the lock chain (#156): the Library never
  # measures the reader, so its one string must not be in the deployed pack.
  lacks "$WORK/app.js" 'Checkpoints {passed} / {total}' 'the removed nav count (#156)'
  has "$WORK/app.js" 'curriculum-row' 'the Curriculum Module rows (#10)'
  has "$WORK/app.js" 'Ready to start' 'the fresh-Module status tag (#10)'
  # The orientation block (#134): its container class ships in the bundle —
  # static copy, so the class is the whole surface to check.
  has "$WORK/app.js" 'curriculum-orientation' 'the Curriculum orientation block (#134)'
  # The block sits above every Category, so it may name no single practice
  # language (#185). The C#-only sentence is the one that shipped before.
  lacks "$WORK/app.js" 'You write and run the C# in your own IDE' 'the C#-only orientation line (#185)'
  # Category headings (#163). The heading TEXT ("Software Design") is authored
  # content, not shell copy, so it is checked in the content step below; what
  # the client-rendered bundle has to ship is the markup that groups the rows
  # under it, and the one place a Category's language is named.
  has "$WORK/app.js" 'curriculum-category-title' 'the Curriculum Category headings (#163)'
  has "$WORK/app.js" 'curriculum-category-language' 'the Category language, named once per heading (#163)'
  # The backup note's browser-only consequence (#142): `curriculum-backup-note`
  # shipped with #29, so the new clause is what proves the deployed pack tells
  # the learner what the exported file is for.
  has "$WORK/app.js" 'only copy of your progress that exists outside this browser' 'the backup note browser-only clause (#142)'
  # Every Module row is a link (#156). The row's inert state was a class
  # (`curriculum-row-locked`, and the reason node #140 added inside it), so
  # the class's absence is what proves the deployed rows are all open to read.
  lacks "$WORK/app.js" 'curriculum-row-locked' 'the removed Curriculum row lock states (#156)'
  # The Module route is hash-routed, so it is this same 200 document; its
  # markup shipping in the bundle is what "the route serves the screen" means.
  has "$WORK/app.js" 'module-concept' 'the Module Concept Page container (#11)'
  # The Module's Self-Check (#157): the questions ride in the Module aside
  # now, so their item class is what proves the panel ships.
  has "$WORK/app.js" 'self-check-item' 'the Module Self-Check questions (#157)'
  # Its one clause of prose — static copy, checked by its class for the same
  # reason the other definitions are.
  has "$WORK/app.js" 'self-check-definition' 'the Self-Check definition (#157)'
  # The explanation revealed after a pick (#162): its slot class is the whole
  # reveal surface, so the class shipping is what proves the deployed panel can
  # reveal one. The text itself is content, checked in the content step.
  has "$WORK/app.js" 'self-check-explanation' 'the Self-Check explanation slot (#162)'
  has "$WORK/app.js" 'module-example-grid' 'the Model Examples grid (#11)'
  # The Exercise route (#15) is hash-routed too: the same 200 document, with
  # the Spec grid container shipping in this bundle.
  has "$WORK/app.js" 'exercise-spec-grid' 'the Exercise Spec grid (#15)'
  # The Target Interface definition (#136): static copy above the display-only
  # C# block, so its class is the whole surface to check.
  has "$WORK/app.js" 'exercise-interface-definition' 'the Target Interface definition (#136)'
  # The practice-material prerequisites (#141): the note's class shipped with
  # #15, so the clause naming the toolchain is what proves the two facts a
  # learner needs BEFORE cloning are live in the deployed pack. Since #164 the
  # clause is a template — {language} and the command below both follow the
  # Module's Category language.
  has "$WORK/app.js" 'needs the {language} toolchain installed on your own machine' 'the practice-material prerequisite note (#141, #164)'
  # Both commands ship (#164): `dotnet test` alone would still be there with
  # the command hardcoded, so `pytest` in the deployed bundle is what proves
  # the language table — not the screen — decides what a learner runs.
  has "$WORK/app.js" 'dotnet test' 'the C# practice command (#164)'
  has "$WORK/app.js" 'pytest' 'the Python practice command (#164)'
  # Nothing is submitted and nothing is passed (#157): the submit action, the
  # gate panels, the poster and the Exercise banner all left the pack, so
  # their absence is what proves the deployed build is the un-gated one.
  lacks "$WORK/app.js" 'Submit Behavioral Checklist' 'the removed checklist submit action (#157)'
  lacks "$WORK/app.js" 'module-gate-poster' 'the removed Exit Gate poster (#157)'
  lacks "$WORK/app.js" 'exercise-gate-banner' 'the removed Exercise gate banner (#157)'
  lacks "$WORK/app.js" 'Exit Gate passed' 'the removed passed status copy (#157)'
  # The Curriculum row's draft tag (#18) still ships — the reader's own saved
  # answers, the one thing a row still says.
  has "$WORK/app.js" 'In progress' 'the draft In progress tag (#18)'
  # The pending-Module placeholder (#28): its copy-block class ships in the
  # bundle — the state itself is fixture-driven (no live Module is pending).
  has "$WORK/app.js" 'module-pending-copy' 'the pending-Module placeholder (#28)'
  # The reworded pending Concept Page line (#139): the class above shipped
  # with #28, so the clause is what proves the Generator/pipeline wording is
  # gone from the deployed pack.
  has "$WORK/app.js" 'there is nothing to read in this Module' 'the pending Concept Page line (#139)'
  # Progress export/import (#29): the Curriculum backup footer and the
  # download's fixed file name ship in this bundle.
  has "$WORK/app.js" 'curriculum-backup' 'the progress backup footer (#29)'
  has "$WORK/app.js" 'kata-progress.json' 'the backup file name (#29)'
  has "$WORK/app.js" 'replace current progress?' 'the import confirm summary (#29)'
  # The v2 store (#159): Self-Check answers are the only thing Kata persists,
  # so the deployed bundle opens the v2 database, and the noun the confirm
  # used to count is gone from the pack with the records it counted.
  has "$WORK/app.js" 'kata-v2' 'the v2 progress database (#159)'
  has "$WORK/app.js" '{selfChecks} — replace current progress?' 'the confirm summary counting Self-Checks (#159)'
  lacks "$WORK/app.js" 'Checkpoint' 'the removed Checkpoint noun (#159)'
fi
end

# ─── 3. stylesheet ─────────────────────────────────────────────────────────
begin stylesheet 12
if [[ -z "$CSS_URL" ]]; then
  bad "the shell links no /assets/*.css — the app would render unstyled"
elif get "$CSS_URL" "$WORK/app.css"; then
  has "$WORK/app.css" '--color-accent' 'the design tokens'
  has "$WORK/app.css" '@font-face' 'the self-hosted @font-face'
fi
end

# ─── 4. font (self-hosted: an offline PWA may not depend on Google Fonts) ───
begin font 13
FONT_URL="$(node -e '
  const [file, base] = process.argv.slice(1);
  const css = require("node:fs").readFileSync(file, "utf8");
  const match = css.match(/url\(([^)]*\.woff2)\)/);
  console.log(match ? new URL(match[1].replace(/["'"'"']/g, ""), base).href : "");
' "$WORK/app.css" "$URL" 2>>"$LOG")"
if [[ -z "$FONT_URL" ]]; then
  bad "the stylesheet references no .woff2 — Archivo is not self-hosted"
elif get "$FONT_URL" "$WORK/font.woff2"; then
  magic "$WORK/font.woff2" 'wOF2'
fi
end

# ─── 5. manifest ───────────────────────────────────────────────────────────
begin manifest 14
if get "${URL}manifest.webmanifest" "$WORK/manifest.webmanifest"; then
  json "$WORK/manifest.webmanifest" 'data.name === "Kata"' 'name is Kata'
  json "$WORK/manifest.webmanifest" 'data.display === "standalone"' 'display is standalone'
  json "$WORK/manifest.webmanifest" 'data.icons.length >= 3' 'has 192, 512 and maskable icons'
fi
end

# ─── 6. service worker ─────────────────────────────────────────────────────
begin service-worker 15
if get "${URL}sw.js" "$WORK/sw.js"; then
  has "$WORK/sw.js" 'addEventListener' 'its event listeners'
  has "$WORK/sw.js" 'caches' 'its cache handling'
  has "$WORK/sw.js" 'precache' 'the injected precache list'
fi
end

# ─── 7. icons and favicon ──────────────────────────────────────────────────
begin icons 16
for icon in icons/icon-192.png icons/icon-512.png icons/icon-maskable-512.png icons/apple-touch-icon-180.png icons/favicon-32.png; do
  if get "${URL}${icon}" "$WORK/$(basename "$icon")"; then
    magic "$WORK/$(basename "$icon")" 'PNG'
  fi
done
if get "${URL}favicon.svg" "$WORK/favicon.svg"; then
  has "$WORK/favicon.svg" '<svg' 'an SVG root'
fi
end

# ─── 8. content JSON (#7) ──────────────────────────────────────────────────
# Live since #7 committed schemas/module-index.schema.json and
# public/content/index.json (docs/engineering.md § 3): the deployed index must
# fetch 200 and validate, and every non-pending Module's content file must too.
# The SKIP branch only fires if the schema or index ever goes missing.
INDEX_SCHEMA="$REPO/schemas/module-index.schema.json"
CONTENT_SCHEMA="$REPO/schemas/module-content.schema.json"
if [[ ! -f "$INDEX_SCHEMA" || ! -f "$REPO/public/content/index.json" ]]; then
  CONTENT_NOTE=" | content SKIP (no schema/content yet: #7)"
  STEP=content
  note "SKIP — schemas/ or public/content/index.json does not exist yet (#7)"
else
  begin content 17
  if get "${URL}content/index.json" "$WORK/content/index.json"; then
    if ! out="$(node "$REPO/scripts/validate-content.mjs" "$INDEX_SCHEMA" "$WORK/content/index.json" 2>&1)"; then
      bad "the deployed index.json does not match its schema"
      note "$out"
    else
      note "$out"
      # Categories (#160): the deployed index declares the Software Design
      # shelf and every Module is filed under it — the language now belongs to
      # the Category, so a live index without `categories` is the old model.
      has "$WORK/content/index.json" '"categories"' 'the Categories array (#160)'
      has "$WORK/content/index.json" '"software-design"' 'the Software Design Category (#160)'
      # The heading the deployed Curriculum groups its five rows under (#163):
      # the app is client-rendered, so the served markup is the bundle above
      # plus this content — the title it reads has to be live in the index.
      json "$WORK/content/index.json" \
        'data.categories.some((c) => c.title === "Software Design" && c.language === "csharp")' \
        'the Software Design heading and its language (#163)'
      # The Agentic AI Category (#165): the second shelf ships as six pending
      # rows, so the deployed index is the whole surface — a client-rendered
      # SPA serves the heading and the rows from this file, not from HTML.
      has "$WORK/content/index.json" '"agentic-ai"' 'the Agentic AI Category (#165)'
      has "$WORK/content/index.json" '"ai06"' 'the sixth Agentic AI Module (#165)'
      json "$WORK/content/index.json" \
        'data.categories.some((c) => c.title === "Agentic AI" && c.language === "python")' \
        'the Agentic AI heading and its language (#165)'
      json "$WORK/content/index.json" \
        'data.modules.filter((m) => m.categoryId === "agentic-ai").every((m, i) => m.ordinal === i + 1) && data.modules.filter((m) => m.categoryId === "agentic-ai").length === 6' \
        'six Agentic AI Modules, ordinals 1-6 (#165)'
      # The Category shipped every row pending (#165); #166 authored the first
      # pack, so what the deployed index has to say now is that ai01 alone is
      # readable — the remaining five stay pending until their own issues.
      json "$WORK/content/index.json" \
        'data.modules.find((m) => m.id === "ai01").pending === false' \
        'ai01 is no longer pending (#166)'
      MODULES="$(node -e '
        const data = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
        console.log(data.modules.filter((m) => !m.pending).map((m) => m.id).join(" "));
      ' "$WORK/content/index.json" 2>>"$LOG")"
      # Module 1 shipped in #8: it must be non-pending, so the loop below
      # always fetches content/modules/m01.json (200) and validates it.
      if [[ " $MODULES " == *" m01 "* ]]; then
        note "m01 is non-pending — Module 1 content (#8) is live"
      else
        bad "m01 is pending in the deployed index — Module 1 content (#8) is missing"
      fi
      # Module 2 shipped in #24: the loop below must also fetch and validate
      # content/modules/m02.json.
      if [[ " $MODULES " == *" m02 "* ]]; then
        note "m02 is non-pending — Module 2 content (#24) is live"
      else
        bad "m02 is pending in the deployed index — Module 2 content (#24) is missing"
      fi
      # Module 3 shipped in #25: the loop below must also fetch and validate
      # content/modules/m03.json.
      if [[ " $MODULES " == *" m03 "* ]]; then
        note "m03 is non-pending — Module 3 content (#25) is live"
      else
        bad "m03 is pending in the deployed index — Module 3 content (#25) is missing"
      fi
      # Module 4 shipped in #26: the loop below must also fetch and validate
      # content/modules/m04.json.
      if [[ " $MODULES " == *" m04 "* ]]; then
        note "m04 is non-pending — Module 4 content (#26) is live"
      else
        bad "m04 is pending in the deployed index — Module 4 content (#26) is missing"
      fi
      # Module 5 shipped in #27 — the Curriculum is complete: the loop below
      # must also fetch and validate content/modules/m05.json.
      if [[ " $MODULES " == *" m05 "* ]]; then
        note "m05 is non-pending — Module 5 content (#27) is live"
      else
        bad "m05 is pending in the deployed index — Module 5 content (#27) is missing"
      fi
      # Module ai01 shipped in #166 — the first Agentic AI content pack: the
      # loop below must also fetch and validate content/modules/ai01.json.
      if [[ " $MODULES " == *" ai01 "* ]]; then
        note "ai01 is non-pending — Embeddings content (#166) is live"
      else
        bad "ai01 is pending in the deployed index — Embeddings content (#166) is missing"
      fi
      for id in $MODULES; do
        get "${URL}content/modules/${id}.json" "$WORK/content/modules/${id}.json"
      done
      # The served ai01.json parses, and says what an explain-only pack says:
      # no Exercises at all (#161) and the three Self-Check questions the
      # Module reads with. The schema run below covers its shape; this line is
      # what proves the DEPLOYED file is the authored pack (#166).
      if [[ -f "$WORK/content/modules/ai01.json" ]]; then
        json "$WORK/content/modules/ai01.json" \
          'data.id === "ai01" && data.exercises.length === 0 && data.selfCheckQuestions.length === 3' \
          'the served ai01 pack: explain-only, three Self-Check questions (#166)'
      fi
      if [[ -n "$MODULES" ]]; then
        if ! out="$(node "$REPO/scripts/validate-content.mjs" "$CONTENT_SCHEMA" "$WORK/content/modules" 2>&1)"; then
          bad "a deployed Module content file does not match its schema"
          note "$out"
        else
          note "$out"
        fi
      fi
    fi
  fi
  end
fi

# ─── 9. exercise folders (#23) ─────────────────────────────────────────────
# Module 1's two Exercise folders are committed (#23), so the deployed
# m01.json must carry both GitHub folder URLs (no null placeholders left) and
# each URL must return 200 — the Exercise screen's practice-material link
# (#15) points there.
begin exercise-folders 18
M01_JSON="$WORK/content/modules/m01.json"
if [[ ! -f "$M01_JSON" ]]; then
  bad "the deployed m01.json was not fetched (content step failed?) — cannot read folderUrl"
else
  FOLDER_URLS="$(node -e '
    const data = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
    console.log(data.exercises.map((e) => e.folderUrl).filter(Boolean).join(" "));
  ' "$M01_JSON" 2>>"$LOG")"
  COUNT=$(wc -w <<<"$FOLDER_URLS")
  if ((COUNT < 2)); then
    bad "deployed m01.json has $COUNT non-null folderUrl values (expected 2: #23)"
  else
    n=0
    for folder_url in $FOLDER_URLS; do
      n=$((n + 1))
      get "$folder_url" "$WORK/exercise-folder-$n.html" || true
    done
  fi
fi
end

# ─── 10. m02 exercise folders (#24) ────────────────────────────────────────
# Module 2's two Exercise folders are committed (#24): the deployed m02.json
# must carry both GitHub folder URLs and each must return 200.
begin exercise-folders-m02 19
M02_JSON="$WORK/content/modules/m02.json"
if [[ ! -f "$M02_JSON" ]]; then
  bad "the deployed m02.json was not fetched (content step failed?) — cannot read folderUrl"
else
  FOLDER_URLS="$(node -e '
    const data = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
    console.log(data.exercises.map((e) => e.folderUrl).filter(Boolean).join(" "));
  ' "$M02_JSON" 2>>"$LOG")"
  COUNT=$(wc -w <<<"$FOLDER_URLS")
  if ((COUNT < 2)); then
    bad "deployed m02.json has $COUNT non-null folderUrl values (expected 2: #24)"
  else
    n=0
    for folder_url in $FOLDER_URLS; do
      n=$((n + 1))
      get "$folder_url" "$WORK/m02-exercise-folder-$n.html" || true
    done
  fi
fi
end

# ─── 11. m03 exercise folders (#25) ────────────────────────────────────────
# Module 3's two Exercise folders are committed (#25): the deployed m03.json
# must carry both GitHub folder URLs and each must return 200.
begin exercise-folders-m03 20
M03_JSON="$WORK/content/modules/m03.json"
if [[ ! -f "$M03_JSON" ]]; then
  bad "the deployed m03.json was not fetched (content step failed?) — cannot read folderUrl"
else
  FOLDER_URLS="$(node -e '
    const data = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
    console.log(data.exercises.map((e) => e.folderUrl).filter(Boolean).join(" "));
  ' "$M03_JSON" 2>>"$LOG")"
  COUNT=$(wc -w <<<"$FOLDER_URLS")
  if ((COUNT < 2)); then
    bad "deployed m03.json has $COUNT non-null folderUrl values (expected 2: #25)"
  else
    n=0
    for folder_url in $FOLDER_URLS; do
      n=$((n + 1))
      get "$folder_url" "$WORK/m03-exercise-folder-$n.html" || true
    done
  fi
fi
end

# ─── 12. m04 exercise folders (#26) ────────────────────────────────────────
# Module 4's two Exercise folders are committed (#26): the deployed m04.json
# must carry both GitHub folder URLs and each must return 200.
begin exercise-folders-m04 21
M04_JSON="$WORK/content/modules/m04.json"
if [[ ! -f "$M04_JSON" ]]; then
  bad "the deployed m04.json was not fetched (content step failed?) — cannot read folderUrl"
else
  FOLDER_URLS="$(node -e '
    const data = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
    console.log(data.exercises.map((e) => e.folderUrl).filter(Boolean).join(" "));
  ' "$M04_JSON" 2>>"$LOG")"
  COUNT=$(wc -w <<<"$FOLDER_URLS")
  if ((COUNT < 2)); then
    bad "deployed m04.json has $COUNT non-null folderUrl values (expected 2: #26)"
  else
    n=0
    for folder_url in $FOLDER_URLS; do
      n=$((n + 1))
      get "$folder_url" "$WORK/m04-exercise-folder-$n.html" || true
    done
  fi
fi
end

# ─── 13. m05 exercise folders (#27) ────────────────────────────────────────
# Module 5's two Exercise folders are committed (#27): the deployed m05.json
# must carry both GitHub folder URLs and each must return 200.
begin exercise-folders-m05 22
M05_JSON="$WORK/content/modules/m05.json"
if [[ ! -f "$M05_JSON" ]]; then
  bad "the deployed m05.json was not fetched (content step failed?) — cannot read folderUrl"
else
  FOLDER_URLS="$(node -e '
    const data = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
    console.log(data.exercises.map((e) => e.folderUrl).filter(Boolean).join(" "));
  ' "$M05_JSON" 2>>"$LOG")"
  COUNT=$(wc -w <<<"$FOLDER_URLS")
  if ((COUNT < 2)); then
    bad "deployed m05.json has $COUNT non-null folderUrl values (expected 2: #27)"
  else
    n=0
    for folder_url in $FOLDER_URLS; do
      n=$((n + 1))
      get "$folder_url" "$WORK/m05-exercise-folder-$n.html" || true
    done
  fi
fi
end

# ─── report ────────────────────────────────────────────────────────────────
if ((${#FAILED_STEPS[@]} == 0)); then
  echo "SMOKE ${PASSED}/${TOTAL} ok${CONTENT_NOTE} | ${URL}"
  exit 0
fi

FIRST="${FAILED_STEPS[0]}"
CODE="${FAILED_CODES[0]}"
MORE=""
((${#FAILED_STEPS[@]} > 1)) && MORE=" | $((${#FAILED_STEPS[@]} - 1)) more failed: ${FAILED_STEPS[*]:1}"
echo "SMOKE FAIL ${PASSED}/${TOTAL} | step ${FIRST} (exit ${CODE})${MORE} | ${URL}"
echo "--- ${FIRST} ---------------------------------------------"
grep -F "[$FIRST] " "$LOG" | tail -20
echo "----------------------------------------------------------"
echo "log: $LOG"
exit "$CODE"
