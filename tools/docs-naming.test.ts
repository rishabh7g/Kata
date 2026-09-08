/**
 * `docs/` is named to one scheme — `NN-lowercase-kebab.md`, numbered in creation
 * order (claude-setup docs/repo-standards.md § "Naming that is uniform
 * everywhere"). Before #241 the four docs were `design.md`, `engineering.md`,
 * `ubiquitous-language.md` and `simplification-plan.md`, and `engineering.md`
 * alone was cited from CLAUDE.md, README.md, both JSON schemas, three scripts
 * and a dozen source comments. The rename was the cheap half; re-finding the
 * citations was not, so the shape is held mechanically rather than by habit.
 *
 * Kata's docs are prose only — no `screenshots/` or other asset directory — so
 * every entry under `docs/` is a numbered file and nothing else.
 */
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const docsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../docs');
const entries = readdirSync(docsDir, { withFileTypes: true });

const numberedProse = /^\d{2}-[a-z\d]+(-[a-z\d]+)*\.md$/;

it('finds the files it is meant to police', () => {
  // Without this the guards below would pass vacuously on an empty read.
  expect(entries.filter((entry) => entry.isFile()).length).toBeGreaterThan(3);
});

it('names every doc `NN-lowercase-kebab.md`', () => {
  const offenders = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => !numberedProse.test(name));
  expect(offenders).toEqual([]);
});

it('keeps prose flat — no subdirectories under `docs/`', () => {
  const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  expect(directories).toEqual([]);
});

it('numbers each doc once', () => {
  const numbers = entries.filter((entry) => entry.isFile()).map((entry) => entry.name.slice(0, 2));
  expect(numbers).toEqual([...new Set(numbers)]);
});
