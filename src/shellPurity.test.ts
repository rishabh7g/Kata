/**
 * Shell purity (#112) — the mechanical half of "no user-facing string
 * literal remains in `src/app/` or `src/screens/`."
 *
 * Every word a learner reads ships in `src/strings/en.ts` and reaches the
 * screen through `useStrings()`. Prose cannot enforce that; a scan can: no
 * TSX file under `src/app/` or `src/screens/` may render a literal, prose-
 * shaped JSX text node or a copy-carrying `aria-label`/`title` attribute.
 *
 * Kata ships one locale today, so — unlike `~/dev/shidi`'s script-based scan
 * (Devanagari vs. Arabic, a signal that can never appear in TypeScript
 * source) — there is no non-English marker to key off. The discriminator
 * here is shape: a JSX text node of at least one letter, with no `{…}`
 * expression inside it, sitting directly between two tags. That misses copy
 * hidden inside a JS string literal used in a ternary or a variable (this
 * scan does not parse the AST), but it is exactly the shape a paste of new
 * copy takes — `<h1>New heading</h1>`, `<button>New label</button>` — so it
 * is the mechanical net this rule needs, checked in the same repo pattern as
 * `scripts/harness.test.ts`. The initial migration (#112) was done by hand,
 * file by file; this guard is what stops a *regression* from a hardcoded
 * string node quietly landing again.
 *
 * Sources come from Vite's `import.meta.glob(…, '?raw')` rather than
 * `node:fs`, matching `~/dev/shidi`'s own guard: `src/` is browser-typed.
 */
import { describe, expect, it } from 'vitest';

/* ----------------------------------------------------------------- the rule */

/**
 * A JSX tag, open or close — `<div className="x">`, `<Foo />`, `</Foo>`.
 * Attribute values may not themselves carry a bare `<`/`>` (none in this
 * repo's shell do); that is this scanner's one documented gap, matched by
 * `~/dev/shidi`'s own "escapes are out of reach" honesty about its guard.
 *
 * An OPENING tag's `<` is required to NOT sit directly against an identifier
 * character (`(?<![\w$])`) — that is what a generic type argument list looks
 * like (`useState<Foo>`, `Record<string, string>`), and it is the one shape
 * that is otherwise indistinguishable from a JSX open tag by punctuation
 * alone. A JSX tag is never written touching the identifier before it; a
 * generic always is. A CLOSING tag needs no such guard: `</` never starts a
 * generic, so `<span>text</span>` — the closing tag touching "text" with no
 * space — still matches.
 */
const TAG =
  /(?:(?<![\w$])<[A-Za-z][\w.-]*(?:\s[^<>]*)?\/?>|<\/[A-Za-z][\w.-]*>)/g;

/**
 * A doc comment mentioning a tag in backtick code (`` `<fieldset>` ``) reads
 * as a real tag to `TAG`, which knows nothing of `//`/`/* *‍/` — stripped to
 * blanks (same length, so nothing downstream needs re-indexing) before
 * matching, the same reason `~/dev/shidi`'s guard calls out "comments count"
 * as a DELIBERATE choice for its own, different, scan: here it is the
 * opposite choice, because the failure mode is a comment's example markup,
 * not a pasted string.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => ' '.repeat(comment.length))
    .replace(/\/\/[^\n]*/g, (comment) => ' '.repeat(comment.length));
}

/** JS control-flow glue a tag-pairing scan can bridge across sibling JSX branches — `return x ? (<a/>) : (<b/>)` — never a text node. */
const CODE_GLUE = /\breturn\b|\)\s*:\s*\(|\?\s*\(|\)\s*\)\s*;/;

/**
 * Text directly between two CONSECUTIVE real tags — `<span>Some words</span>`
 * — found by pairing up `TAG` matches in file order rather than scanning for
 * a bare `>`/`<`. A bare `>` (an arrow function's `=>`, a `Record<K, V>`
 * generic) is never itself a tag, so it can never anchor a false match here,
 * which is exactly the failure mode a naive `>text<` regex has on TSX: this
 * file went through that version first and it flagged `=>` and `useState<T>`
 * as tags (see the PR this landed in, #112).
 *
 * A gap containing `{`/`}` (a JSX expression child) or `<`/`>` (an unmatched
 * generic `TAG` did not consume) is dropped — not a text node either way.
 * So is one that reads as JS control flow (`CODE_GLUE`): a ternary between
 * two JSX branches in different `case`s or ternary arms pairs its last tag
 * with the next branch's first tag, and the code between them is glue, not
 * a child of either.
 */
function textNodesBetweenTags(source: string): string[] {
  const stripped = stripComments(source);
  const tags = [...stripped.matchAll(TAG)];
  const nodes: string[] = [];
  for (let i = 0; i < tags.length - 1; i += 1) {
    const current = tags[i];
    const next = tags[i + 1];
    if (current === undefined || next === undefined) continue;
    const start = current.index + current[0].length;
    const end = next.index;
    if (end <= start) continue;
    const gap = stripped.slice(start, end);
    if (/[<>{}]/.test(gap)) continue;
    if (CODE_GLUE.test(gap)) continue;
    nodes.push(gap);
  }
  return nodes;
}

/** A copy-carrying attribute — the two that speak to assistive tech directly. */
const COPY_ATTR = /\b(aria-label|title)=(?:"([^"]*)"|'([^']*)')/g;

/**
 * The one token that is a shape-match but is not copy: the product name,
 * kept out of the strings pack deliberately (`stringsKeys.ts`'s own header
 * comment explains why — a product name is not translatable prose).
 *
 * `dotnet test` was the second entry until #164. The practice-material note
 * now reads its command from `LANGUAGE_TEST_COMMAND` by Category language,
 * so it renders as an expression child and no literal command is left in the
 * shell to exempt — an exemption that stopped earning its place is deleted,
 * not kept "just in case".
 *
 * The list stays exactly this long by policy, same as `~/dev/shidi`'s own
 * one-entry `ALLOWED`: an exemption nobody had to argue for is how a guard
 * rots, so the next one is another conscious edit in another diff.
 */
const ALLOWED_LITERALS: ReadonlySet<string> = new Set(['Kata']);

/** Pure punctuation, digits or whitespace — never copy on its own. */
const PUNCTUATION_ONLY = /^[\s\d.,:/·•\-—()%]*$/;

interface Violation {
  file: string;
  text: string;
}

function isSuspicious(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed === '') return false;
  if (PUNCTUATION_ONLY.test(trimmed)) return false;
  if (ALLOWED_LITERALS.has(trimmed)) return false;
  return true;
}

function scanSource(file: string, source: string): Violation[] {
  const violations: Violation[] = [];
  const stripped = stripComments(source);

  for (const gap of textNodesBetweenTags(source)) {
    const text = gap.trim();
    if (isSuspicious(text)) violations.push({ file, text });
  }

  for (const match of stripped.matchAll(COPY_ATTR)) {
    const value = (match[2] ?? match[3] ?? '').trim();
    if (isSuspicious(value)) {
      violations.push({ file, text: `${match[1] ?? ''}="${value}"` });
    }
  }

  return violations;
}

/** Every TSX file under `src/app/` and `src/screens/`, tests excluded. */
const SOURCES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>(['./app/**/*.tsx', './screens/**/*.tsx'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  )
    .filter(([file]) => !file.endsWith('.test.tsx'))
    .map(([file, source]) => [file.replace('./', 'src/'), source]),
);

/* ---------------------------------------------------------------- the guard */

describe('shell purity (#112)', () => {
  it('finds no hardcoded copy in src/app/ or src/screens/', () => {
    const violations = Object.entries(SOURCES).flatMap(([file, source]) =>
      scanSource(file, source),
    );

    expect(
      violations,
      violations
        .map((violation) => `${violation.file}: "${violation.text}"`)
        .join('\n')
        .concat(
          '\nEvery learner-facing word ships in src/strings/en.ts and is read with useStrings() (#112).',
        ),
    ).toEqual([]);
  });

  it('scans the real tree — the shell files, not the tests beside them', () => {
    const files = Object.keys(SOURCES);

    expect(files).toContain('src/app/AppShell.tsx');
    expect(files).toContain('src/screens/CurriculumScreen.tsx');
    expect(files.some((file) => file.endsWith('.test.tsx'))).toBe(false);
  });
});

describe('the scanner itself', () => {
  it('catches a planted heading', () => {
    expect(scanSource('src/Planted.tsx', '<h1>New heading text</h1>')).toEqual([
      { file: 'src/Planted.tsx', text: 'New heading text' },
    ]);
  });

  it('catches a planted copy-carrying aria-label', () => {
    expect(scanSource('src/Planted.tsx', '<button aria-label="Do the thing" />')).toEqual([
      { file: 'src/Planted.tsx', text: 'aria-label="Do the thing"' },
    ]);
  });

  it('leaves an expression child alone — the normal post-#112 shape', () => {
    expect(scanSource('src/Planted.tsx', '<h1>{s.curriculum.title}</h1>')).toEqual([]);
  });

  it('leaves punctuation-only text alone', () => {
    expect(scanSource('src/Planted.tsx', '<span> · </span>')).toEqual([]);
  });

  it('leaves the one allow-listed literal alone', () => {
    expect(scanSource('src/Planted.tsx', '<span>Kata</span>')).toEqual([]);
  });

  it('no longer exempts a literal test command — it comes from the language table now (#164)', () => {
    expect(scanSource('src/Planted.tsx', '<code>dotnet test</code>')).toEqual([
      { file: 'src/Planted.tsx', text: 'dotnet test' },
    ]);
    expect(
      scanSource('src/Planted.tsx', '<code>{LANGUAGE_TEST_COMMAND[language]}</code>'),
    ).toEqual([]);
  });

  it('leaves a decorative aria-hidden icon attribute alone — not a copy attr', () => {
    expect(scanSource('src/Planted.tsx', '<svg aria-hidden="true" />')).toEqual([]);
  });
});
