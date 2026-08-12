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
#             16 icons · 17 content
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
  has "$WORK/app.js" 'Checkpoints' 'the Checkpoint count label'
  has "$WORK/app.js" 'curriculum-row' 'the Curriculum Module rows (#10)'
  has "$WORK/app.js" 'Ready to start' 'the fresh-Module status tag (#10)'
  # The Module route is hash-routed, so it is this same 200 document; its
  # markup shipping in the bundle is what "the route serves the screen" means.
  has "$WORK/app.js" 'module-concept' 'the Module Concept Page container (#11)'
  has "$WORK/app.js" 'module-example-grid' 'the Model Examples grid (#11)'
  # The Exercise route (#15) is hash-routed too: the same 200 document, with
  # the Spec grid container shipping in this bundle.
  has "$WORK/app.js" 'exercise-spec-grid' 'the Exercise Spec grid (#15)'
  # The Behavioral Checklist (#16): the form and its one primary action.
  has "$WORK/app.js" 'exercise-checklist-item' 'the Behavioral Checklist form (#16)'
  has "$WORK/app.js" 'Submit Behavioral Checklist' 'the checklist submit action (#16)'
  # The Exit Gate poster (#17): the passed-state accent field on the Module
  # screen — its container class and display line ship in this bundle.
  has "$WORK/app.js" 'module-gate-poster' 'the Exit Gate poster (#17)'
  has "$WORK/app.js" 'Passed.' 'the poster display line (#17)'
  # The Exercise gate banner (#19): the accent block under the checklist —
  # its container class and display line ship in this bundle.
  has "$WORK/app.js" 'exercise-gate-banner' 'the Exercise gate banner (#19)'
  has "$WORK/app.js" 'Exit Gate passed — Checkpoint recorded.' 'the banner display line (#19)'
  # The unlock cascade (#18): the draft-state tag ships in the bundle. The
  # live count and lock chain themselves are exercised by the app tests.
  has "$WORK/app.js" 'In progress' 'the draft In progress tag (#18)'
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
for icon in icons/icon-192.png icons/icon-512.png icons/icon-maskable-512.png; do
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
      for id in $MODULES; do
        get "${URL}content/modules/${id}.json" "$WORK/content/modules/${id}.json"
      done
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
