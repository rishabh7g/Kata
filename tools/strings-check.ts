/**
 * Copy-bundle completeness check (#240).
 *
 * `scripts/verify.sh` runs this as the STRINGS stage (exit 60) and `npm run
 * build` runs it before `vite build`, so an inconsistent bundle fails both the
 * harness and the deploy — not a warning. Until this existed Kata was the one
 * frontend whose bundle nothing checked: claude-setup#50 added a key nothing
 * reads and emptied `curriculum.orientation`, and every stage stayed green.
 * `tsc` cannot see either one. It catches a key that is *read* and then deleted,
 * because components reach values by property access; it has nothing to say
 * about a key no component mentions, or about the difference between a sentence
 * and `''`.
 *
 * Four rules, all keyed off `src/strings/copyKeys.ts` (the only list in the repo):
 *   1. every canonical key is present — flattened on `.`, because the pack is nested;
 *   2. every value is a non-empty string;
 *   3. no extra keys — the typo tripwire: a key the app will never read sits
 *      quietly beside a missing real one without this rule;
 *   4. placeholder parity — a value carries exactly its canonical
 *      `{placeholders}`, so the pack cannot silently drop `{origin}` (the notice
 *      then names no site) or invent `{title}` (`interpolate` warns and renders
 *      the braces verbatim).
 *
 * Every message names the pack and the key, because "a string is missing" is
 * useless once there is more than one pack — and a second locale is a second
 * entry in `PACKS` below, nothing else.
 */
import { COPY_KEYS, COPY_PLACEHOLDERS, type CopyKey } from '../src/strings/copyKeys.ts';
import { copy } from '../src/strings/copy.ts';

/* ------------------------------------------------------------------ contract */

/** `{origin}` and friends. Non-greedy by construction: braces cannot nest. */
const PLACEHOLDER = /\{[^{}]*\}/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Nested pack -> dot-paths: `{"curriculum":{"title":"…"}}` becomes
 * `curriculum.title`.
 *
 * Only non-empty plain objects are containers. An empty one and an array are
 * kept as leaf values, so they surface as "must be a non-empty string" or
 * "unknown key" instead of vanishing from the comparison — a branch that
 * disappears silently is how a pack passes a completeness check while shipping
 * nothing.
 */
export function flattenCopy(value: Record<string, unknown>, prefix = ''): Map<string, unknown> {
  const flat = new Map<string, unknown>();
  for (const [key, child] of Object.entries(value)) {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (isRecord(child) && Object.keys(child).length > 0) {
      for (const [nested, leaf] of flattenCopy(child, path)) flat.set(nested, leaf);
    } else {
      flat.set(path, child);
    }
  }
  return flat;
}

/** What a value IS, for a message that says why it was rejected. */
function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  if (isRecord(value)) return Object.keys(value).length === 0 ? 'an empty object' : 'an object';
  if (typeof value === 'string') return value === '' ? 'an empty string' : 'a blank string';
  return `a ${typeof value}`;
}

/** The bare names inside a value's `{placeholders}`, as a set — order and
 *  repetition are the pack's business. */
function placeholdersIn(value: string): Set<string> {
  return new Set((value.match(PLACEHOLDER) ?? []).map((match) => match.slice(1, -1)));
}

function listPlaceholders(names: Iterable<string>): string {
  const sorted = [...names].sort();
  return sorted.length === 0 ? 'none' : sorted.join(' ');
}

/* --------------------------------------------------------------------- check */

/**
 * Returns one line per problem, each naming `<packName> pack` and the key; an
 * empty array means the pack is complete.
 */
export function checkCopy(pack: unknown, packName: string): string[] {
  const label = `${packName} pack`;
  if (!isRecord(pack)) {
    return [`${label}: must be an object of copy keys, not ${describe(pack)}`];
  }

  const flat = flattenCopy(pack);
  const issues: string[] = [];
  const canonical: readonly string[] = COPY_KEYS;

  for (const key of COPY_KEYS) {
    if (!flat.has(key)) {
      issues.push(`${label}: missing key "${key}"`);
      continue;
    }
    const value = flat.get(key);
    if (typeof value !== 'string' || value.trim() === '') {
      issues.push(`${label}: "${key}" must be a non-empty string — got ${describe(value)}`);
      continue;
    }
    issues.push(...checkPlaceholders(value, key, label));
  }

  for (const key of flat.keys()) {
    if (canonical.includes(key)) continue;
    issues.push(
      `${label}: unknown key "${key}" — not in the canonical list (src/strings/copyKeys.ts)`,
    );
  }

  return issues;
}

/** Rule 4, split out: parity against the canonical set, plus the stray brace
 *  that hides a typo. */
function checkPlaceholders(value: string, key: CopyKey, label: string): string[] {
  const issues: string[] = [];
  const expected = new Set(COPY_PLACEHOLDERS[key]);
  const found = placeholdersIn(value);

  const missing = [...expected].filter((name) => !found.has(name));
  const unexpected = [...found].filter((name) => !expected.has(name));
  if (missing.length > 0 || unexpected.length > 0) {
    issues.push(
      `${label}: "${key}" placeholders — expected ${listPlaceholders(expected)}, ` +
        `found ${listPlaceholders(found)}`,
    );
  }

  // `{origin` renders as literal text and matches nothing above; catch it where
  // it is written.
  if (/[{}]/.test(value.replace(PLACEHOLDER, ''))) {
    issues.push(`${label}: "${key}" has a stray { or } — placeholders are written {likeThis}`);
  }

  return issues;
}

/* --------------------------------------------------------------------- packs */

/** Every pack the build ships. One entry today; a second locale is a second
 *  entry here. */
const PACKS: ReadonlyArray<{ name: string; data: unknown }> = [{ name: 'copy', data: copy }];

/* ------------------------------------------------------------------------ CLI */

function main(): void {
  const issues = PACKS.flatMap(({ name, data }) => checkCopy(data, name));
  if (issues.length > 0) {
    console.error(`strings-check: ${issues.length} problem(s):\n`);
    for (const issue of issues) console.error(`  - ${issue}`);
    process.exitCode = 1;
    return;
  }
  console.log(`strings-check: ok — ${PACKS.length} pack(s), ${COPY_KEYS.length} keys each.`);
}

// Only run the CLI when this file is executed directly (`node
// tools/strings-check.ts`), not when the test file imports `checkCopy`.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
