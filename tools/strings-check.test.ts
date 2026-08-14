import { describe, expect, it } from 'vitest';
import { checkStrings, flattenStrings } from './strings-check.ts';
import en from '../src/strings/en.ts';

describe('flattenStrings', () => {
  it('dot-paths a nested object', () => {
    const flat = flattenStrings({ gate: { condition: { title: 'x' } } });
    expect(flat.get('gate.condition.title')).toBe('x');
  });

  it('keeps an empty object as a leaf rather than vanishing it', () => {
    const flat = flattenStrings({ gate: {} });
    expect(flat.get('gate')).toEqual({});
  });
});

describe('checkStrings', () => {
  it('accepts the real pack Kata ships', () => {
    expect(checkStrings(en, 'src/strings/en.ts')).toEqual([]);
  });

  it('rejects a non-object payload', () => {
    expect(checkStrings('nope', 'p')).toEqual([
      'p: must be a JSON object of microcopy keys, not a blank string',
    ]);
  });

  it('reports a missing key', () => {
    const issues = checkStrings({}, 'p');
    expect(issues).toContain('p: missing key "shell.backToCurriculum"');
  });

  it('reports a present-but-empty key', () => {
    const issues = checkStrings({ shell: { backToCurriculum: '   ' } }, 'p');
    expect(issues).toContain(
      'p: "shell.backToCurriculum" must be a non-empty string — got a blank string',
    );
  });

  it('reports an unknown key beside a real one, distinctly', () => {
    const pack = { ...en, shell: { backToCurriculum: 'Curriculum', backToHome: 'Home' } };
    const issues = checkStrings(pack, 'p');
    expect(issues).toContain(
      'p: unknown key "shell.backToHome" — not in the canonical list (src/strings/stringsKeys.ts)',
    );
  });

  it('reports a placeholder mismatch — missing and invented', () => {
    const pack = { ...en, gate: { ...en.gate, checkpointLine: 'Checkpoint · no date here' } };
    const issues = checkStrings(pack, 'p');
    expect(issues).toContain(
      'p: "gate.checkpointLine" placeholders — expected {date}, found none',
    );
  });

  it('catches a stray unmatched brace as its own issue', () => {
    const pack = { ...en, gate: { ...en.gate, label: 'Exit {Gate' } };
    const issues = checkStrings(pack, 'p');
    expect(issues).toContain(
      'p: "gate.label" has a stray { or } — placeholders are written {likeThis}',
    );
  });
});
