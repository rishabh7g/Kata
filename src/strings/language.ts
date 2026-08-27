/**
 * The Category's practice language, as the reader sees it named (#163).
 *
 * `CategoryLanguage` is authored data — `'csharp'`, `'python'` — and nothing
 * a learner should ever read. This is the ONE table that turns it into
 * something on screen, so the mapping lives in one place rather than in each
 * screen that happens to need it: the Curriculum names the language once per
 * Category heading, and the Exercise screen names the same language beside
 * the command the learner runs. A second table would be two places to forget
 * when a third language is authored.
 *
 * Extending it is adding a row per language, not a second table:
 * `Record<CategoryLanguage, …>` means a new member of the union fails `tsc`
 * here until every table below has an entry for it.
 */
import type { CategoryLanguage } from '../curriculum';
import type { StringsKey } from './stringsKeys.ts';

/**
 * What the language is CALLED — `s[LANGUAGE_LABEL_KEY[language]]` reads
 * `C#` or `Python`. A strings key, not a literal: language names are copy the
 * shell renders, and the shell has no copy of its own (#112).
 */
export const LANGUAGE_LABEL_KEY: Readonly<Record<CategoryLanguage, StringsKey>> =
  {
    csharp: 'language.csharp',
    python: 'language.python',
  };
