/**
 * Strings pack completeness check (#112) — the build-time half of the
 * strings contract: "a missing key is a build failure, not a fallback."
 *
 * `npm run build` runs this before `vite build`; a broken pack fails the
 * build before a single file is written. There is no CLI flag to skip it and
 * no fallback copy anywhere in the shell (`src/shellPurity.test.ts`), which
 * is exactly why this is a build failure and not a warning.
 *
 * Four rules, all keyed off `src/strings/stringsKeys.ts` (the only list in
 * the repo — this module imports FROM the app, never the reverse):
 *   1. every canonical key is present — flattened on `.`, because the
 *      authored pack is nested;
 *   2. every value is a non-empty string;
 *   3. no extra keys — the typo tripwire: `gate.condition.notsubmitted`
 *      sitting quietly beside a missing real `notSubmitted` is caught here,
 *      not shipped as a silent English-language leak;
 *   4. placeholder parity — a value carries exactly its canonical
 *      `{placeholders}`, so a future translation cannot silently drop
 *      `{origin}` or invent `{name}`.
 *
 * Every message names the pack file and the key, because "a string is
 * missing" is useless once a second locale exists.
 */
import { readdirSync } from 'node:fs';
import { STRINGS_KEYS, STRINGS_PLACEHOLDERS, type StringsKey } from '../src/strings/stringsKeys.ts';

/* ------------------------------------------------------------------ contract */

/** `{origin}` and friends. Non-greedy by construction: braces cannot nest. */
const PLACEHOLDER = /\{[^{}]*\}/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Nested object -> dot-paths: `{"gate":{"condition":{"title":"…"}}}` becomes
 * `gate.condition.title`.
 *
 * Only non-empty plain objects are containers. An empty one and an array are
 * kept as leaf values, so they surface as "must be a non-empty string" or
 * "unknown key" instead of vanishing from the comparison — a branch that
 * disappears silently is how a pack passes a completeness check while
 * shipping nothing.
 */
export function flattenStrings(value: Record<string, unknown>, prefix = ''): Map<string, unknown> {
  const flat = new Map<string, unknown>();
  for (const [key, child] of Object.entries(value)) {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (isRecord(child) && Object.keys(child).length > 0) {
      for (const [nested, leaf] of flattenStrings(child, path)) flat.set(nested, leaf);
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

/** The `{placeholders}` in a value, as a set — order and repetition are the pack's business. */
function placeholdersIn(value: string): Set<string> {
  return new Set(value.match(PLACEHOLDER) ?? []);
}

function listPlaceholders(names: Iterable<string>): string {
  const sorted = [...names].sort();
  return sorted.length === 0 ? 'none' : sorted.join(' ');
}

/* --------------------------------------------------------------------- check */

/**
 * Returns one line per problem, each naming `<packLabel>` and the key; an
 * empty array means the pack is complete.
 */
export function checkStrings(json: unknown, packLabel: string): string[] {
  if (!isRecord(json)) {
    return [`${packLabel}: must be a JSON object of microcopy keys, not ${describe(json)}`];
  }

  const flat = flattenStrings(json);
  const issues: string[] = [];
  const canonical: readonly string[] = STRINGS_KEYS;

  for (const key of STRINGS_KEYS) {
    if (!flat.has(key)) {
      issues.push(`${packLabel}: missing key "${key}"`);
      continue;
    }
    const value = flat.get(key);
    if (typeof value !== 'string' || value.trim() === '') {
      issues.push(`${packLabel}: "${key}" must be a non-empty string — got ${describe(value)}`);
      continue;
    }
    issues.push(...checkPlaceholders(value, key, packLabel));
  }

  for (const key of flat.keys()) {
    if (canonical.includes(key)) continue;
    issues.push(
      `${packLabel}: unknown key "${key}" — not in the canonical list (src/strings/stringsKeys.ts)`,
    );
  }

  return issues;
}

/** Rule 4, split out: parity against the canonical set, plus the stray brace that hides a typo. */
function checkPlaceholders(value: string, key: StringsKey, packLabel: string): string[] {
  const issues: string[] = [];
  const expected = new Set(STRINGS_PLACEHOLDERS[key]);
  const found = placeholdersIn(value);

  const missing = [...expected].filter((name) => !found.has(name));
  const unexpected = [...found].filter((name) => !expected.has(name));
  if (missing.length > 0 || unexpected.length > 0) {
    issues.push(
      `${packLabel}: "${key}" placeholders — expected ${listPlaceholders(expected)}, ` +
        `found ${listPlaceholders(found)}`,
    );
  }

  // `{origin` renders as literal text and matches nothing above; catch it where it is written.
  if (/[{}]/.test(value.replace(PLACEHOLDER, ''))) {
    issues.push(`${packLabel}: "${key}" has a stray { or } — placeholders are written {likeThis}`);
  }

  return issues;
}

/* --------------------------------------------------------------------- CLI */

/**
 * Every pack file in `src/strings/` — anything that is not the canonical
 * list itself, the runtime loader, a lookup table, or a test. Adding a locale
 * is adding a file here; nothing else changes for this script to pick it up.
 *
 * `language.ts` is on the exclusion list for the same reason the first two
 * are: it is not a pack. It maps a `CategoryLanguage` onto the canonical key
 * that names it (#163) — keys, not copy — so read as a pack it would be a
 * pack missing every key there is.
 */
const NOT_A_PACK: readonly string[] = ['stringskeys.ts', 'strings.ts', 'language.ts'];

function packFiles(): string[] {
  const dir = new URL('../src/strings/', import.meta.url);
  return readdirSync(dir)
    .filter((file) => /^[a-z]+\.ts$/.test(file))
    .filter((file) => !NOT_A_PACK.includes(file.toLowerCase()))
    .sort();
}

async function main(): Promise<void> {
  const files = packFiles();
  if (files.length === 0) {
    console.error('STRINGS CHECK FAIL: no pack file found under src/strings/');
    process.exit(2);
  }

  const allIssues: string[] = [];
  for (const file of files) {
    const mod: unknown = await import(new URL(`../src/strings/${file}`, import.meta.url).href);
    const pack = (mod as { default?: unknown }).default;
    allIssues.push(...checkStrings(pack, `src/strings/${file}`));
  }

  if (allIssues.length > 0) {
    console.error(`STRINGS CHECK FAIL — ${allIssues.length} issue(s):`);
    for (const issue of allIssues) console.error(`  ${issue}`);
    process.exit(1);
  }

  console.log(`STRINGS ok — ${files.length} pack(s), ${STRINGS_KEYS.length} keys each`);
}

// Only run the CLI when invoked directly (`node tools/strings-check.ts`), not
// when a test imports `checkStrings`/`flattenStrings` as a library.
if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
