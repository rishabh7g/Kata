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
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CHECKS_DIR = process.env.KATA_CHECKS_DIR ?? join(REPO, '.checks');
const DRAFTS_DIR = process.env.KATA_DRAFTS_DIR ?? join(REPO, 'drafts');
const CLAUDE_BIN = process.env.KATA_CLAUDE_BIN ?? 'claude';
const LOG = join(CHECKS_DIR, 'draft.log');

/** Distinct per failure kind, so a caller can branch without parsing text. */
const EXIT = { ok: 0, usage: 2, exists: 3, cli: 4, badOutput: 5 };

/** Everything the run wrote, flushed to LOG whatever the outcome. */
const transcript = [];

function note(line) {
  transcript.push(line);
}

function done(code, lines) {
  mkdirSync(CHECKS_DIR, { recursive: true });
  writeFileSync(LOG, `${transcript.join('\n')}\n`);
  console.log(lines.join('\n'));
  process.exit(code);
}

function fail(code, message) {
  done(code, [`DRAFT FAIL ${message}`, `log: ${LOG}`]);
}

function show(path) {
  const rel = relative(REPO, path);
  return rel.startsWith('..') ? path : rel;
}

function exists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

/** The lines of one `## <heading>` section of a markdown doc. */
function section(markdown, heading) {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`## ${heading}`));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith('## ')) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n').trim();
}

function buildPrompt(module) {
  const language = readFileSync(join(REPO, 'docs/ubiquitous-language.md'), 'utf8');
  const design = readFileSync(join(REPO, 'docs/design.md'), 'utf8');
  const pedagogy = section(design, 'Pedagogy');
  if (!pedagogy) {
    fail(EXIT.usage, 'docs/design.md has no "## Pedagogy" section to embed');
  }

  return [
    'You are drafting the Concept Page for one Module of Kata, a read-only app',
    'for learning software design fundamentals. This is an LLM first draft that',
    'a human will edit once and freeze.',
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

/** Calls the local claude CLI headless and returns the drafted markdown. */
function draft(prompt) {
  note(`invoking: ${CLAUDE_BIN} -p --output-format json`);
  const result = spawnSync(CLAUDE_BIN, ['-p', '--output-format', 'json'], {
    input: prompt,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });

  if (result.error) {
    note(`spawn error: ${result.error.message}`);
    fail(
      EXIT.cli,
      `cannot run \`${CLAUDE_BIN}\` (${result.error.code ?? result.error.message}) — is the claude CLI installed and on PATH?`,
    );
  }
  note(`exit ${result.status}`);
  note(`--- stdout ---\n${result.stdout}`);
  note(`--- stderr ---\n${result.stderr}`);
  if (result.status !== 0) {
    fail(
      EXIT.cli,
      `\`${CLAUDE_BIN}\` exited ${result.status} — is the CLI authenticated? ${firstLine(result.stderr || result.stdout)}`,
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    fail(EXIT.badOutput, `\`${CLAUDE_BIN}\` returned non-JSON output: ${firstLine(result.stdout)}`);
  }
  if (parsed.is_error || typeof parsed.result !== 'string' || parsed.result.trim() === '') {
    fail(EXIT.badOutput, `\`${CLAUDE_BIN}\` returned no draft text (is_error=${parsed.is_error ?? false})`);
  }
  return `${parsed.result.trim()}\n`;
}

function firstLine(text) {
  return (text ?? '').trim().split('\n')[0]?.slice(0, 120) ?? '';
}

function usage(message) {
  done(EXIT.usage, [
    `DRAFT USAGE ERROR: ${message}`,
    'usage: node scripts/draft-concept.mjs <module-id> [--dry-run] [--force]',
    '       module-id must exist in public/content/index.json',
  ]);
}

function main(argv) {
  rmSync(LOG, { force: true });
  note(`draft-concept ${new Date().toISOString()}`);

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

  note(`module ${module.id} — ${module.title}`);
  const prompt = buildPrompt(module);

  if (flags.includes('--dry-run')) {
    note('dry run: prompt printed, nothing written');
    done(EXIT.ok, [prompt, '', `DRAFT ${id} dry-run ok (nothing written)`]);
  }

  const out = join(DRAFTS_DIR, `${id}-concept.md`);
  if (exists(out) && !flags.includes('--force')) {
    fail(EXIT.exists, `${show(out)} already exists — pass --force to overwrite`);
  }

  const markdown = draft(prompt);
  mkdirSync(DRAFTS_DIR, { recursive: true });
  writeFileSync(out, markdown);
  note(`wrote ${out} (${markdown.length} chars)`);
  done(EXIT.ok, [`DRAFT ${id} ok → ${show(out)}`]);
}

main(process.argv.slice(2));
