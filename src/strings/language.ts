import type { CategoryLanguage } from '../curriculum';

/**
 * The command that runs an Exercise's Test Suite, per Category language.
 * `Record<CategoryLanguage, …>` means a new member of the union fails `tsc`
 * here until it has an entry.
 */
export const LANGUAGE_TEST_COMMAND: Readonly<Record<CategoryLanguage, string>> = {
  csharp: 'dotnet test',
  python: 'pytest',
};
