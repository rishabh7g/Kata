/**
 * `checkCopy` (#240) — one test per failure class the gate exists to catch, plus
 * the shipped pack passing clean.
 *
 * The issue's acceptance criteria are met by hand, against the real
 * `src/strings/copy.ts`: inject each case, quote `node tools/strings-check.ts`
 * refusing it, restore the file byte-identical. This file pins the same four
 * behaviours permanently, on a copy of the pack, so the checked-in bundle is
 * never edited to prove a point.
 */
import { describe, expect, it } from 'vitest';
import { COPY_KEYS } from '../src/strings/copyKeys.ts';
import { copy } from '../src/strings/copy.ts';
import { checkCopy, flattenCopy } from './strings-check.ts';

/** The pack as the check sees it, with one edit applied — never the real object. */
function packWith(edit: (flat: Map<string, unknown>) => void): Record<string, unknown> {
  const flat = flattenCopy(copy);
  edit(flat);
  return unflatten(flat);
}

describe('checkCopy', () => {
  it('passes the shipped copy pack with no issues', () => {
    expect(checkCopy(copy, 'copy')).toEqual([]);
  });

  it('reports a canonical key missing from the pack', () => {
    const issues = checkCopy(
      packWith((flat) => flat.delete('curriculum.orientation')),
      'copy',
    );
    expect(issues).toContain('copy pack: missing key "curriculum.orientation"');
  });

  it('reports a key the canonical list does not have', () => {
    const issues = checkCopy(
      packWith((flat) => flat.set('curriculum.neverRead', 'nothing reads this')),
      'copy',
    );
    expect(issues).toContain(
      'copy pack: unknown key "curriculum.neverRead" — not in the canonical list (src/strings/copyKeys.ts)',
    );
  });

  it('reports an empty value', () => {
    const issues = checkCopy(
      packWith((flat) => flat.set('curriculum.orientation', '')),
      'copy',
    );
    expect(issues).toContain(
      'copy pack: "curriculum.orientation" must be a non-empty string — got an empty string',
    );
  });

  // Whitespace passes `!== ''` and renders as nothing, so it is the same defect.
  it('reports a whitespace-only value', () => {
    const issues = checkCopy(
      packWith((flat) => flat.set('curriculum.orientation', '   ')),
      'copy',
    );
    expect(
      issues.some((issue) => issue.includes('"curriculum.orientation" must be a non-empty string')),
    ).toBe(true);
  });

  it('reports a placeholder the canonical entry does not declare', () => {
    const issues = checkCopy(
      packWith((flat) => flat.set('module.ordinalLabel', 'Module {n}')),
      'copy',
    );
    expect(issues).toContain(
      'copy pack: "module.ordinalLabel" placeholders — expected ordinal, found n',
    );
  });

  it('reports a stray brace, which no placeholder pattern would match', () => {
    const issues = checkCopy(
      packWith((flat) => flat.set('module.ordinalLabel', 'Module {ordinal')),
      'copy',
    );
    expect(issues).toContain(
      'copy pack: "module.ordinalLabel" has a stray { or } — placeholders are written {likeThis}',
    );
  });

  it('rejects a pack that is not an object at all', () => {
    expect(checkCopy(null, 'copy')).toEqual([
      'copy pack: must be an object of copy keys, not null',
    ]);
  });

  it('flattens every canonical key out of the shipped pack', () => {
    const flat = flattenCopy(copy);
    for (const key of COPY_KEYS) expect(flat.has(key)).toBe(true);
  });
});

/** Dot-paths back to a nested object, the inverse of `flattenCopy`. */
function unflatten(flat: Map<string, unknown>): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const [path, value] of flat) {
    const parts = path.split('.');
    const leaf = parts.pop();
    if (leaf === undefined) continue;
    let node = root;
    for (const part of parts) {
      const child = node[part];
      if (child === undefined) node[part] = {};
      node = node[part] as Record<string, unknown>;
    }
    node[leaf] = value;
  }
  return root;
}
