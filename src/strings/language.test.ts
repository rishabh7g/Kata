// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { CategoryLanguage } from '../curriculum';
import { LANGUAGE_LABEL_KEY, LANGUAGE_TEST_COMMAND } from './language';
import { STRINGS_KEYS } from './stringsKeys.ts';
import { useStrings } from './strings';

/**
 * The one language→copy table (#163). It is shared surface, not one screen's
 * detail: the Curriculum names the Category's language at its heading, and
 * the Exercise screen names the same language beside the command the learner
 * runs — so this file's job is to prove the table is complete and that its
 * keys are real, whoever reads it next.
 */

const LANGUAGES: readonly CategoryLanguage[] = ['csharp', 'python'];

describe('the Category language labels (#163)', () => {
  it('names every language in CategoryLanguage', () => {
    expect(Object.keys(LANGUAGE_LABEL_KEY).sort()).toEqual([...LANGUAGES].sort());
  });

  it('points at canonical strings keys, so the pack must carry them', () => {
    for (const language of LANGUAGES) {
      expect(STRINGS_KEYS).toContain(LANGUAGE_LABEL_KEY[language]);
    }
  });

  it('reads as the reader names the language, not as the authored value', () => {
    const s = useStrings();

    expect(s[LANGUAGE_LABEL_KEY.csharp]).toBe('C#');
    expect(s[LANGUAGE_LABEL_KEY.python]).toBe('Python');
  });
});

describe('the Category language test commands (#164)', () => {
  it('names every language in CategoryLanguage', () => {
    expect(Object.keys(LANGUAGE_TEST_COMMAND).sort()).toEqual([...LANGUAGES].sort());
  });

  it('is the command the learner types, verbatim', () => {
    expect(LANGUAGE_TEST_COMMAND.csharp).toBe('dotnet test');
    expect(LANGUAGE_TEST_COMMAND.python).toBe('pytest');
  });

  it('carries a real command for every language, never an empty token', () => {
    for (const language of LANGUAGES) {
      expect(LANGUAGE_TEST_COMMAND[language].trim()).not.toBe('');
    }
  });
});
