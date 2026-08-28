#!/usr/bin/env bash
#
# Kata exercise check — every committed Exercise folder's Test Suite must be
# intact, so a learner who clones a folder never lands on broken material.
# Never a test RUN: Kata never gates on test execution (docs/engineering.md
# § 6), and a construct Exercise's skeleton is red by design.
#
#   scripts/build-exercises.sh          # checks every exercises/<module>/<id>/
#
# Discovery: every exercises/<module>/<exercise>/ folder holding practice
# material, in either of the two languages a Category can be written in
# (#172) — the check follows the folder's contents, so new material can never
# be silently skipped:
#
#   C# folder      at least one .csproj  → dotnet build, build only. Each
#                  folder's csproj files build in path order (tests/ reference
#                  src/ by ProjectReference), so a folder is "ok" only when
#                  all of it compiles.
#   Python folder  no .csproj, at least  → pytest --collect-only, run from the
#                  one .py                 folder. Collection is the honest
#                  analogue of `dotnet build`: it proves the imports resolve
#                  and the tests are discoverable without running them.
#
# Output contract (scripts/README.md), adapted per #22: one `ok <folder>` line
# per Exercise folder plus a final count; ZERO folders is an explicit pass
# ("0 Test Suites (none committed yet)"). Full dotnet/pytest output goes to
# .checks/exercises.log (uploaded as a CI artifact, never inlined in the job
# log); on failure print the failing folder, a ~20-line error slice, and the
# log path.
#
# Exit codes: 0 ok (including zero folders) · 2 usage/precondition ·
#             3 one or more folders failed to build or collect
#
set -uo pipefail

REPO="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
CHECKS_DIR="${KATA_CHECKS_DIR:-$REPO/.checks}"
LOG="$CHECKS_DIR/exercises.log"
WORK="$CHECKS_DIR/exercises"
EXERCISES_DIR="${KATA_EXERCISES_DIR:-$REPO/exercises}"
PYTHON="${KATA_PYTHON:-python3}"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  grep '^#' "${BASH_SOURCE[0]}" | cut -c3-
  exit 0
fi

mkdir -p -- "$CHECKS_DIR"
rm -rf -- "$WORK"
mkdir -p -- "$WORK"
: >"$LOG"

# ─── discover ───────────────────────────────────────────────────────────────
# Exercise folders are exercises/<module>/<exercise>/ — the first two path
# segments above any .csproj or .py file (docs/engineering.md § 6 layout).
FOLDERS=()
if [[ -d "$EXERCISES_DIR" ]]; then
  while IFS= read -r folder; do
    FOLDERS+=("$folder")
  done < <(
    find "$EXERCISES_DIR" -mindepth 3 \( -name '*.csproj' -o -name '*.py' \) -printf '%P\n' 2>/dev/null |
      awk -F/ '{ print $1 "/" $2 }' | sort -u
  )
fi

if ((${#FOLDERS[@]} == 0)); then
  echo "no exercise folders under exercises/ — nothing to build" >>"$LOG"
  echo "EXERCISES ok | 0 Test Suites (none committed yet)"
  exit 0
fi

# A folder's language decides its check, so a toolchain is a precondition only
# when material in that language is actually committed.
CSHARP=0
PYTHON_FOLDERS=0
for folder in "${FOLDERS[@]}"; do
  if [[ -n "$(find "$EXERCISES_DIR/$folder" -name '*.csproj' -print -quit)" ]]; then
    CSHARP=1
  else
    PYTHON_FOLDERS=1
  fi
done

if ((CSHARP)); then
  command -v dotnet >/dev/null ||
    { echo "EXERCISES PRECONDITION FAIL: dotnet is not installed"; exit 2; }
fi
if ((PYTHON_FOLDERS)); then
  command -v "$PYTHON" >/dev/null ||
    { echo "EXERCISES PRECONDITION FAIL: $PYTHON is not installed"; exit 2; }
  "$PYTHON" -m pytest --version >/dev/null 2>&1 ||
    { echo "EXERCISES PRECONDITION FAIL: pytest is not installed ($PYTHON -m pytest)"; exit 2; }
fi

# ─── check ──────────────────────────────────────────────────────────────────
PASSED=0
FAILED=()

for folder in "${FOLDERS[@]}"; do
  FOLDER_LOG="$WORK/${folder//\//__}.log"
  FOLDER_OK=1

  if [[ -n "$(find "$EXERCISES_DIR/$folder" -name '*.csproj' -print -quit)" ]]; then
    while IFS= read -r csproj; do
      {
        printf '\n=== dotnet build %s (%s)\n' "$csproj" "$(date -u +%H:%M:%SZ)"
        dotnet build "$EXERCISES_DIR/$csproj" -nologo --verbosity minimal 2>&1
      } >>"$FOLDER_LOG" || FOLDER_OK=0
    done < <(
      find "$EXERCISES_DIR/$folder" -name '*.csproj' -printf "$folder/%P\n" | sort
    )
  else
    # --collect-only never executes a test; -p no:cacheprovider keeps pytest
    # from writing .pytest_cache into the committed folder. Exit 5 (no tests
    # collected) is a failure: a Python folder with nothing to discover is
    # exactly the broken material this check exists to catch.
    {
      printf '\n=== pytest --collect-only %s (%s)\n' "$folder" "$(date -u +%H:%M:%SZ)"
      (cd "$EXERCISES_DIR/$folder" && PYTHONDONTWRITEBYTECODE=1 \
        "$PYTHON" -m pytest --collect-only -q -p no:cacheprovider 2>&1)
    } >>"$FOLDER_LOG" || FOLDER_OK=0
  fi

  cat "$FOLDER_LOG" >>"$LOG"

  if ((FOLDER_OK)); then
    PASSED=$((PASSED + 1))
    echo "ok exercises/$folder"
  else
    FAILED+=("$folder")
    echo "FAIL exercises/$folder"
    echo "--- exercises/$folder ------------------------------------"
    grep -iE 'error|FAILED|no tests' "$FOLDER_LOG" | tail -20
    echo "----------------------------------------------------------"
  fi
done

# ─── report ─────────────────────────────────────────────────────────────────
TOTAL=${#FOLDERS[@]}
if ((${#FAILED[@]} == 0)); then
  echo "EXERCISES ok | ${PASSED}/${TOTAL} Test Suites ready"
  exit 0
fi

echo "EXERCISES FAIL ${PASSED}/${TOTAL} | broken: ${FAILED[*]}"
echo "log: $LOG"
exit 3
