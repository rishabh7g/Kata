#!/usr/bin/env bash
#
# Kata scoped test run — Vitest over just the files a change touched.
#
# The full suite grows with every issue; a change to one screen does not need
# it, and neither does the agent reading the output.
#
#   scripts/test-scoped.sh src/pwa/sw.test.ts src/App.test.tsx
#   FULL=1 scripts/test-scoped.sh                 # the whole suite, on purpose
#   scripts/test-scoped.sh                        # refuses: name the files
#
# Output contract (scripts/README.md): exactly ONE line on success; the full
# Vitest output to .checks/test.log; on failure a non-zero exit (Vitest's own
# status), a ~20-line extract of the failures, and the log path.
#
# Exit codes: 0 ok · 2 usage/precondition · otherwise Vitest's exit status.
#
set -uo pipefail

REPO="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
CHECKS_DIR="${KATA_CHECKS_DIR:-$REPO/.checks}"
LOG="$CHECKS_DIR/test.log"
VITEST="$REPO/node_modules/.bin/vitest"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  grep '^#' "${BASH_SOURCE[0]}" | cut -c3-
  exit 0
fi

if (($# == 0)) && [[ "${FULL:-}" != "1" ]]; then
  echo "TEST USAGE ERROR: name the test files this change touched, e.g."
  echo "  scripts/test-scoped.sh src/pwa/sw.test.ts"
  echo "  FULL=1 scripts/test-scoped.sh   # the whole suite, on purpose"
  exit 2
fi

[[ -x "$VITEST" ]] || { echo "TEST PRECONDITION FAIL: no node_modules/.bin/vitest — run npm ci"; exit 2; }

for file in "$@"; do
  [[ -e "$REPO/$file" || -e "$file" ]] || { echo "TEST PRECONDITION FAIL: no such test file: $file"; exit 2; }
done

mkdir -p -- "$CHECKS_DIR"
SCOPE="$*"
[[ -n "$SCOPE" ]] || SCOPE="(full suite)"

NO_COLOR=1 "$VITEST" run --reporter=default "$@" >"$LOG" 2>&1
STATUS=$?

# " Test Files  6 passed (6)" / "      Tests  32 passed (32)"
FILES="$(grep -m1 'Test Files' "$LOG" | tr -s ' ' | cut -d' ' -f4-)"
TESTS="$(grep -m1 -E '^\s*Tests ' "$LOG" | tr -s ' ' | cut -d' ' -f3-)"

if ((STATUS == 0)); then
  echo "TEST ok | ${FILES:-files ?} | ${TESTS:-tests ?} | ${SCOPE}"
  exit 0
fi

echo "TEST FAIL (exit ${STATUS}) | ${FILES:-files ?} | ${TESTS:-tests ?} | ${SCOPE}"
echo "--- failures ---------------------------------------------"
if grep -qE 'Failed Tests|Unhandled Error' "$LOG"; then
  grep -nE 'Failed Tests|Unhandled Error' "$LOG" | head -1 | cut -d: -f1 |
    xargs -I{} tail -n +{} "$LOG" | head -20
else
  tail -20 "$LOG"
fi
echo "----------------------------------------------------------"
echo "log: $LOG"
exit "$STATUS"
