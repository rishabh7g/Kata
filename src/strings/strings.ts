/**
 * The runtime read side of the strings contract (#112) — the shell has NO
 * copy of its own: it renders what `src/strings/en.ts` ships, through
 * `useStrings()`, or it renders nothing. That is one half of the contract;
 * the other half is mechanical: `tools/strings-check.ts` fails `npm run
 * build` if the pack is missing a canonical key, and
 * `src/shellPurity.test.ts` fails the suite if a screen renders copy of its
 * own instead. Between them there is no gap for a hardcoded fallback to hide
 * in, which is why access here is NON-OPTIONAL: `useStrings()` returns a
 * `Strings` whose every canonical key is a `string`, never `string |
 * undefined`.
 *
 * Kata ships one pack today, bundled at build time (unlike a runtime-fetched
 * course pack): there is no offline-first race to guard against, so the pack
 * is a plain static import rather than a fetch. `parseStrings` still walks
 * the canonical key list rather than trusting the file, exactly as the
 * build-time checker does — a stale build artefact is the failure mode this
 * guards, even though the build's own check should already have caught it.
 */
import { STRINGS_KEYS, type StringsKey } from './stringsKeys.ts';
import en from './en.ts';

/** The active pack, keyed by the canonical dot-paths. */
export type Strings = Readonly<Record<StringsKey, string>>;

/** A pack that fails to parse into complete `Strings` — a build artefact bug. */
export class StringsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StringsError';
  }
}

/** Reads a dot-path out of a nested pack: `gate.condition.title` → `{gate:{condition:…}}`. */
function readPath(root: unknown, key: string): unknown {
  let node: unknown = root;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/**
 * Flattens and validates a raw pack against the canonical key list. Throws
 * `StringsError` naming every key with no usable value — the runtime
 * tripwire behind the build-time checker.
 */
export function parseStrings(pack: unknown, source = 'src/strings/en.ts'): Strings {
  const bundle: Record<string, string> = {};
  const unusable: string[] = [];

  for (const key of STRINGS_KEYS) {
    const value = readPath(pack, key);
    if (typeof value !== 'string' || value.trim() === '') {
      unusable.push(key);
      continue;
    }
    bundle[key] = value;
  }

  if (unusable.length > 0) {
    throw new StringsError(
      `${source}: incomplete pack — no usable value for ${unusable.join(', ')}`,
    );
  }

  return bundle as Strings;
}

const strings: Strings = parseStrings(en);

/**
 * The app's microcopy read handle. Every screen calls this once and reads
 * `s['dot.path']` — no provider, because Kata has exactly one pack bundled
 * at build time; a second pack (a future locale) is a second file this
 * module points at, never a change to a caller.
 */
export function useStrings(): Strings {
  return strings;
}

/* ------------------------------------------------------------- interpolation */

/** `{origin}` and friends. Non-greedy by construction: braces cannot nest. */
const PLACEHOLDER = /\{([^{}]*)\}/g;

/**
 * Fills a value's `{placeholders}` — `interpolate(s['backup.confirmSummary'],
 * { selfChecks })`. A placeholder with no value is left VERBATIM (and
 * warned), never blanked: `{selfChecks}` on screen is ugly and fixable, while
 * a silent gap reads as finished copy that has quietly lost the data it was
 * showing.
 */
export function interpolate(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(PLACEHOLDER, (placeholder, name: string) => {
    const value = values[name];
    if (value === undefined) {
      console.warn(`strings: no value for ${placeholder} — rendering it verbatim`);
      return placeholder;
    }
    return String(value);
  });
}
