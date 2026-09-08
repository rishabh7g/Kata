#!/usr/bin/env bash
# scripts/verify.sh — the repo's verification harness.
#
# One command that answers whether Kata is healthy (claude-setup
# docs/repo-standards.md § "Every repository verifies itself with one command").
# One line when everything passes, one failure block when it doesn't:
#
#   TYPES ok | LINT ok | TEST 54/54 ok | CONTENT ok | BUILD ok
#
# Stages run in order and the FIRST failure stops the run, so a red run names
# exactly one thing. Every stage's stdout+stderr goes to .verify/<stage>.log
# (gitignored, and the whole directory is wiped at the start of every run — so a
# missing log is proof that stage never ran).
#
#   stage    exit  command
#   TYPES     10   npx tsc --noEmit
#   LINT      20   npx eslint ., then npx prettier --check .
#   TEST      30   npm run test           (segment carries the vitest count)
#   CONTENT   40   node scripts/validate-content.mjs
#   BUILD     50   npx vite build
#
# Each stage is guarded by the file that configures it — tsconfig.json,
# eslint.config.js, vite.config.ts (vitest's config lives there too) and
# scripts/validate-content.mjs. A stage whose tooling is gone prints
# `<STAGE> skip` rather than being dropped: silence and success must not look
# alike.
#
# usage: scripts/verify.sh

set -uo pipefail

readonly USAGE='usage: scripts/verify.sh'

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)" || exit 2
cd -- "$repo_root" || exit 2

for arg in "$@"; do
  case "$arg" in
    -h | --help)
      printf '%s\n' "$USAGE"
      exit 0
      ;;
    *)
      printf 'verify: unknown argument: %s\n%s\n' "$arg" "$USAGE" >&2
      exit 2
      ;;
  esac
done

log_dir="$repo_root/.verify"
rm -rf -- "$log_dir"
mkdir -p -- "$log_dir" || exit 2

# The logs are read by tail, grep and humans — never by a terminal.
export NO_COLOR=1 FORCE_COLOR=0

# The one-line summary, built a segment at a time as stages pass.
segments=()

# fail <STAGE> <exit-code> <log> <status> <command…> — the only thing a red run
# prints: what broke, the status the command itself exited with, the tail of its
# log, and where the rest of it is.
#
# The stage code (30) is the harness's word for "TEST failed"; `$status` is the
# tool's own — 1 means the tool decided the run was bad, 137/143 mean it was
# killed and nothing decided anything. Telling them apart matters: #233 is a
# TEST failure whose log held 75 passing tests and no error, and the one thing
# that would have named its cause was never printed.
fail() {
  local stage=$1 code=$2 log=$3 status=${4-} command=${5-}
  printf 'FAIL %s (exit %s)\n' "$stage" "$code"
  [ -n "$status" ] && printf '%s exited %s\n' "$command" "$status"
  printf '\n'
  if [ -s "$log" ]; then
    tail -n 20 "$log"
  else
    printf '(no output)\n'
  fi
  printf '\nlog: %s\n' "$log"
  exit "$code"
}

# run <STAGE> <exit-code> <log> <command…> — appends, so one stage can chain
# several commands (LINT does) into a single log and a single exit code.
run() {
  local stage=$1 code=$2 log=$3
  shift 3
  "$@" >>"$log" 2>&1 || fail "$stage" "$code" "$log" "$?" "$*"
}

# Vitest's summary line reads `Tests  54 passed (54)`, with `N failed |` and
# `N skipped |` in front when relevant. Turn it into `54/54`; print nothing if
# the reporter ever changes shape, so the segment degrades to a plain `TEST ok`
# rather than lying about a count.
test_counts() {
  local line passed total
  line=$(grep -E '^[[:space:]]*Tests[[:space:]]' "$1" | tail -n 1)
  passed=$(printf '%s' "$line" | sed -nE 's/.*[^0-9]([0-9]+) passed.*/\1/p')
  total=$(printf '%s' "$line" | sed -nE 's/.*\(([0-9]+)\).*/\1/p')
  if [ -n "$passed" ] && [ -n "$total" ]; then
    printf '%s/%s' "$passed" "$total"
  fi
}

if [ -f "$repo_root/tsconfig.json" ]; then
  run TYPES 10 "$log_dir/types.log" npx tsc --noEmit
  segments+=('TYPES ok')
else
  segments+=('TYPES skip')
fi

# Two commands, one gate: eslint owns correctness, prettier owns formatting, and
# either one failing is a lint failure (exit 20).
if [ -f "$repo_root/eslint.config.js" ]; then
  run LINT 20 "$log_dir/lint.log" npx eslint .
  run LINT 20 "$log_dir/lint.log" npx prettier --check .
  segments+=('LINT ok')
else
  segments+=('LINT skip')
fi

# vite.config.ts carries the vitest config, so it gates TEST as well as BUILD.
#
# #233 — TEST was seen failing once with `Tests 75 passed (75)` and no error in
# its log. Not reproduced since, under deliberate CPU contention (8 spinners on
# 12 cores): 30 sequential `npm run test` runs, 12 pairs of concurrent ones in
# this same checkout, and 30 consecutive `verify.sh` runs — 84 runs, every one
# exit 0. No vitest bug is named because none was demonstrated, so nothing here
# works around one. What the harness does instead is print the tool's own exit
# status in the failure block (see `fail`), which is the fact the first report
# lacked: 1 means vitest judged the run bad and its log is worth reading; 137 or
# 143 mean it was killed and the log is beside the point. If TEST goes red with
# a clean log again, that line is the finding — put it in #233.
#
# What must NOT happen: TEST is never re-run to see if it passes the second
# time, and `test_counts` is a display detail that never overrides the status.
# Either would turn a real failure into a green line.
if [ -f "$repo_root/vite.config.ts" ]; then
  run TEST 30 "$log_dir/test.log" npm run test
  counts=$(test_counts "$log_dir/test.log")
  segments+=("TEST${counts:+ $counts} ok")
else
  segments+=('TEST skip')
fi

# Content is validated against its schemas before the build, so invalid content
# can never reach dist/ (docs/engineering.md § 3).
if [ -f "$repo_root/scripts/validate-content.mjs" ]; then
  run CONTENT 40 "$log_dir/content.log" node scripts/validate-content.mjs
  segments+=('CONTENT ok')
else
  segments+=('CONTENT skip')
fi

# vite build directly, not `npm run build`: that would re-run tsc --noEmit, so a
# type error would resurface as FAIL BUILD long after TYPES had passed.
if [ -f "$repo_root/vite.config.ts" ]; then
  run BUILD 50 "$log_dir/build.log" npx vite build
  segments+=('BUILD ok')
else
  segments+=('BUILD skip')
fi

line=''
for segment in "${segments[@]}"; do
  line="${line:+$line | }$segment"
done
printf '%s\n' "$line"
