#!/usr/bin/env node
/**
 * Drafts a Concept Page by calling the local `claude` CLI headless.
 *
 * docs/engineering.md § 5 Authoring-time content workflow: draft → human edit →
 * commit. This script is step 1 only. It runs on the build host, never in the
 * app or the deploy path — the shipped app contains no LLM client and no
 * generation code. Drafts land in the gitignored drafts/ folder and are never
 * shipped; the edited text is committed later as content JSON (§ 3).
 *
 *   node scripts/draft-concept.mjs <module-id> [--dry-run] [--force]
 *
 *   node scripts/draft-concept.mjs m02             # → drafts/m02-concept.md
 *   node scripts/draft-concept.mjs m02 --dry-run   # print the prompt, write nothing
 *   node scripts/draft-concept.mjs m02 --force     # overwrite an existing draft
 *
 * The prompt embeds docs/ubiquitous-language.md verbatim (docs/engineering.md
 * § 8), the pedagogy rules from docs/design.md § Pedagogy, the Module's title
 * and description from the index, and the Concept Page constraints: ~1 page of
 * markdown prose, no Model Examples (authored separately, #21), behavioral
 * tone, and only the markdown constructs the app's renderer supports.
 *
 * Output contract (scripts/README.md): one line on success, transcript to
 * .checks/draft.log, distinct exit codes. For tests, $KATA_CLAUDE_BIN swaps
 * the CLI binary and $KATA_DRAFTS_DIR the output directory.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EXIT,
  REPO,
  createRun,
  exists,
  invokeClaude,
  section,
  show,
} from './lib/authoring.mjs';

const DRAFTS_DIR = process.env.KATA_DRAFTS_DIR ?? join(REPO, 'drafts');

const run = createRun('draft.log');

function buildPrompt(module) {
  const language = readFileSync(join(REPO, 'docs/ubiquitous-language.md'), 'utf8');
  const design = readFileSync(join(REPO, 'docs/design.md'), 'utf8');
  const pedagogy = section(design, 'Pedagogy');
  if (!pedagogy) {
    run.fail(EXIT.usage, 'docs/design.md has no "## Pedagogy" section to embed');
  }

  return [
    'You are drafting the Concept Page for one Module of Kata, a read-only app',
    'for learning software design fundamentals. This is an LLM first draft; a',
    'human edits it before anything is committed, and may edit it again later.',
    '',
    '## The Module',
    '',
    `- id: ${module.id}`,
    `- title: ${module.title}`,
    `- description: ${module.description}`,
    '',
    '## Ubiquitous Language (use these terms exactly — embedded verbatim)',
    '',
    language.trim(),
    '',
    '## Pedagogy rules (from docs/design.md)',
    '',
    pedagogy,
    '',
    '## Constraints on your output',
    '',
    '- Write ~1 page of markdown prose explaining the concept: why it matters,',
    '  what it looks like in practice, and how the learner will recognize it in',
    '  their own C# code.',
    '- Do NOT include Model Examples or any code blocks — before/after C# pairs',
    '  are authored separately.',
    '- Behavioral tone per the pedagogy rules: concrete, behaviorally checkable',
    '  statements ("count what a caller must know"), never taste words like',
    '  "clean" or "elegant" as criteria.',
    "- Use only these markdown constructs (the app's renderer supports nothing",
    '  else): `#`–`###` headings, `-` bullet lists, `1.` numbered lists,',
    '  **strong**, *emphasis*, `inline code`. No tables, links, images,',
    '  blockquotes, or fenced code blocks.',
    '- Start with a `# <Module title>` heading, then the prose.',
    '- Respond with the markdown only — no preamble, no commentary.',
  ].join('\n');
}

function usage(message) {
  run.done(EXIT.usage, [
    `DRAFT USAGE ERROR: ${message}`,
    'usage: node scripts/draft-concept.mjs <module-id> [--dry-run] [--force]',
    '       module-id must exist in public/content/index.json',
  ]);
}

function main(argv) {
  run.note(`draft-concept ${new Date().toISOString()}`);

  const flags = argv.filter((arg) => arg.startsWith('--'));
  const ids = argv.filter((arg) => !arg.startsWith('--'));
  const unknown = flags.find((flag) => flag !== '--dry-run' && flag !== '--force');
  if (unknown) usage(`unknown flag ${unknown}`);
  if (ids.length !== 1) usage(`expected exactly one module id, got ${ids.length}`);
  const [id] = ids;

  const index = JSON.parse(readFileSync(join(REPO, 'public/content/index.json'), 'utf8'));
  const module = index.modules.find((entry) => entry.id === id);
  if (!module) {
    usage(`no module "${id}" in the index (have: ${index.modules.map((entry) => entry.id).join(', ')})`);
  }

  run.note(`module ${module.id} — ${module.title}`);
  const prompt = buildPrompt(module);

  if (flags.includes('--dry-run')) {
    run.note('dry run: prompt printed, nothing written');
    run.done(EXIT.ok, [prompt, '', `DRAFT ${id} dry-run ok (nothing written)`]);
  }

  const out = join(DRAFTS_DIR, `${id}-concept.md`);
  if (exists(out) && !flags.includes('--force')) {
    run.fail(EXIT.exists, `${show(out)} already exists — pass --force to overwrite`);
  }

  const markdown = `${invokeClaude(run, prompt)}\n`;
  mkdirSync(DRAFTS_DIR, { recursive: true });
  writeFileSync(out, markdown);
  run.note(`wrote ${out} (${markdown.length} chars)`);
  run.done(EXIT.ok, [`DRAFT ${id} ok → ${show(out)}`]);
}

main(process.argv.slice(2));
