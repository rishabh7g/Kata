#!/usr/bin/env bash
#
# Kata exercise build check — every committed Exercise folder's xUnit Test
# Suite must compile (dotnet build, build only; Kata never gates on test
# execution — docs/engineering.md § 6).
#
#   scripts/build-exercises.sh          # builds every exercises/<mNN>/<id>/
#
# Discovery: every exercises/<module>/<exercise>/ folder containing at least
# one .csproj. Each folder's csproj files are built in path order — tests/
# reference src/ by ProjectReference, so a folder is "ok" only when all of it
# compiles.
#
# Output contract (scripts/README.md), adapted per #22: one `ok <folder>` line
# per Exercise folder plus a final count; ZERO folders is an explicit pass
# ("0 Test Suites (none committed yet)"). Full dotnet output goes to
# .checks/exercises.log (uploaded as a CI artifact, never inlined in the job
# log); on failure print the failing folder, a ~20-line error slice, and the
# log path.
#
# Exit codes: 0 ok (including zero folders) · 2 usage/precondition ·
#             3 one or more folders failed to build
#
set -uo pipefail

REPO="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
CHECKS_DIR="${KATA_CHECKS_DIR:-$REPO/.checks}"
LOG="$CHECKS_DIR/exercises.log"
WORK="$CHECKS_DIR/exercises"
EXERCISES_DIR="${KATA_EXERCISES_DIR:-$REPO/exercises}"

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
# segments above any .csproj (docs/engineering.md § 6 layout).
FOLDERS=()
if [[ -d "$EXERCISES_DIR" ]]; then
  while IFS= read -r folder; do
    FOLDERS+=("$folder")
  done < <(
    find "$EXERCISES_DIR" -mindepth 3 -name '*.csproj' -printf '%P\n' 2>/dev/null |
      awk -F/ '{ print $1 "/" $2 }' | sort -u
  )
fi

if ((${#FOLDERS[@]} == 0)); then
  echo "no exercise folders under exercises/ — nothing to build" >>"$LOG"
  echo "EXERCISES ok | 0 Test Suites (none committed yet)"
  exit 0
fi

command -v dotnet >/dev/null ||
  { echo "EXERCISES PRECONDITION FAIL: dotnet is not installed"; exit 2; }

# ─── build ──────────────────────────────────────────────────────────────────
PASSED=0
FAILED=()

for folder in "${FOLDERS[@]}"; do
  FOLDER_LOG="$WORK/${folder//\//__}.log"
  FOLDER_OK=1
  while IFS= read -r csproj; do
    {
      printf '\n=== dotnet build %s (%s)\n' "$csproj" "$(date -u +%H:%M:%SZ)"
      dotnet build "$EXERCISES_DIR/$csproj" -nologo --verbosity minimal 2>&1
    } >>"$FOLDER_LOG" || FOLDER_OK=0
  done < <(
    find "$EXERCISES_DIR/$folder" -name '*.csproj' -printf "$folder/%P\n" | sort
  )
  cat "$FOLDER_LOG" >>"$LOG"

  if ((FOLDER_OK)); then
    PASSED=$((PASSED + 1))
    echo "ok exercises/$folder"
  else
    FAILED+=("$folder")
    echo "FAIL exercises/$folder"
    echo "--- exercises/$folder ------------------------------------"
    grep -iE 'error|FAILED' "$FOLDER_LOG" | tail -20
    echo "----------------------------------------------------------"
  fi
done

# ─── report ─────────────────────────────────────────────────────────────────
TOTAL=${#FOLDERS[@]}
if ((${#FAILED[@]} == 0)); then
  echo "EXERCISES ok | ${PASSED}/${TOTAL} Test Suites compile"
  exit 0
fi

echo "EXERCISES FAIL ${PASSED}/${TOTAL} | broken: ${FAILED[*]}"
echo "log: $LOG"
exit 3
