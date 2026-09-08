// Kata's LINT gate (docs/repo-standards.md § "The same four gates"). Shaped
// after rung/eslint.config.js: the recommended JS set, typescript-eslint,
// react-hooks, and eslint-config-prettier last so formatting is prettier's job
// alone.
//
// This file is also where the toolchain deviation is recorded. Kata pins
// `typescript` to ~6.0.3 rather than 7.x because TypeScript 7's npm package
// ships the native compiler and no JS compiler API — `require('typescript')`
// exposes only `version` and `versionMajorMinor` — so typescript-eslint refuses
// to load against it (typescript-eslint/typescript-eslint#10940). Measured, not
// assumed: on 7.0.2 `npx eslint .` aborts before linting a single file, and on
// 6.0.3 `npx tsc --noEmit` reports zero errors on this repo. rung pins ~6.0.2
// for the same reason.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier/flat';

export default tseslint.config(
  {
    // dist/ is build output — gitignored, but flat config does not read
    // .gitignore, so it has to be named here.
    ignores: ['dist', 'coverage'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      prettier,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
  },
  {
    // scripts/ and tools/ are the hand-run build-time CLIs — icon generation,
    // content validation, screen measurement — and vite.config.ts is Node too.
    files: ['**/*.mjs', 'vite.config.ts'],
    extends: [js.configs.recommended, prettier],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.node,
    },
  },
  {
    // src/pwa/sw.js is a classic service-worker script, not a module: every
    // global it touches hangs off `self`, and `__KATA_SW_CONFIG__` is the
    // placeholder src/pwa/service-worker-plugin.ts substitutes at build time.
    files: ['src/pwa/sw.js'],
    extends: [js.configs.recommended, prettier],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: { ...globals.serviceworker, __KATA_SW_CONFIG__: 'readonly' },
    },
  },
  {
    // tools/measure.mjs is the odd one: it runs in Node, but the callback it
    // hands to Playwright's page.evaluate() is serialised and executed inside
    // the browser, so document and window are real in there.
    files: ['tools/measure.mjs'],
    languageOptions: {
      globals: globals.browser,
    },
  },
);
