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
# Recursion guard: the suite itself spawns this script (scripts/harness.test.ts),
# so a run that hands FULL=1 down to its children re-enters the full suite
# forever — a fork bomb. Two locks (#64): FULL is dropped before Vitest starts,
# and every child is marked with KATA_TEST_SCOPED_DEPTH so a nested run refuses
# (exit 3) instead of recursing.
#
# Exit codes: 0 ok · 2 usage/precondition · 3 recursion guard · otherwise
# Vitest's exit status.
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

# Recursion guard (#64). Every Vitest this script starts is marked with its
# nesting depth, so a run started BY the suite can tell it is a child.
DEPTH="${KATA_TEST_SCOPED_DEPTH:-0}"
[[ "$DEPTH" =~ ^[0-9]+$ ]] || DEPTH=0

if ((DEPTH > 0)) && (($# == 0)); then
  echo "TEST RECURSION GUARD: refusing a full-suite run nested inside one (depth ${DEPTH})."
  echo "  scripts/harness.test.ts spawns this script, so a nested full suite never ends."
  echo "  Name the test files instead, or run the suite from a shell: npm test"
  exit 3
fi

if ((DEPTH >= 2)); then
  echo "TEST RECURSION GUARD: refusing a run nested ${DEPTH} deep (one level is the limit)."
  echo "  A test that spawns this script must name its files and must not nest further."
  exit 3
fi

[[ -x "$VITEST" ]] || { echo "TEST PRECONDITION FAIL: no node_modules/.bin/vitest — run npm ci"; exit 2; }

for file in "$@"; do
  [[ -e "$REPO/$file" || -e "$file" ]] || { echo "TEST PRECONDITION FAIL: no such test file: $file"; exit 2; }
done

mkdir -p -- "$CHECKS_DIR"
SCOPE="$*"
[[ -n "$SCOPE" ]] || SCOPE="(full suite)"

# FULL is this invocation's intent, never its children's: dropping it here is
# what stops a spawned run from re-entering the whole suite (#64).
unset FULL

KATA_TEST_SCOPED_DEPTH=$((DEPTH + 1)) NO_COLOR=1 \
  "$VITEST" run --reporter=default "$@" >"$LOG" 2>&1
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
