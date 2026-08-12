#!/usr/bin/env node
/**
 * Drafts one Exercise's practice material by calling the local `claude` CLI
 * headless: the flawed C# source (refactor type) or Target Interface stub
 * (construct type), the xUnit Test Suite, and smell-notes.md for the human
 * reviewer.
 *
 * THE ONE NON-NEGOTIABLE RULE (docs/design.md § Exercise design rules,
 * docs/engineering.md § 6): the Test Suite is generated from the brief's
 * Target Interface, NEVER from the flawed code. Tests written from the flawed
 * code would bless the Smell — they would pin the very behavior the learner
 * is supposed to refactor away. The same rule is stated in the prompt below.
 *
 * docs/engineering.md § 5 Authoring-time content workflow: draft → human
 * review → commit. This script is step 1 only. It runs on the build host,
 * never in the app or the deploy path. The candidate folder lands under
 * exercises/<module>/<exercise-id>/ and is committed only after review (#23).
 *
 *   node scripts/draft-exercise.mjs <brief.json> [exercise-id] [--dry-run]
 *
 *   node scripts/draft-exercise.mjs public/content/modules/m01.json m01-e1
 *                                    # pack file + which brief → exercises/m01/m01-e1/
 *   node scripts/draft-exercise.mjs scripts/fixtures/exercise-briefs/refactor.json
 *                                    # a standalone brief JSON file
 *   node scripts/draft-exercise.mjs … --dry-run   # print the prompt, write nothing
 *
 * There is deliberately NO --force flag: a regenerated Exercise is a NEW
 * Exercise id, never an overwrite (docs/engineering.md § 5) — the old
 * material and the learner's solutions stay valid.
 *
 * The script itself writes the deterministic parts — both csproj files
 * (net10.0), the Target Interface .cs copied verbatim from the brief, and
 * README.md — so the immutable Target Interface can never be paraphrased by
 * the model. The model contributes only the implementation/stub sources, the
 * test sources, and the smell notes, as strict JSON:
 *
 *   { "files": [{"path","content"}], "testFiles": [{"path","content"}], "smellNotes": "…" }
 *
 * Output contract (scripts/README.md): one line on success — including the
 * generated source LOC, flagged when it exceeds the brief's size budget —
 * transcript to .checks/draft-exercise.log, distinct exit codes. For tests,
 * $KATA_CLAUDE_BIN swaps the CLI binary and $KATA_EXERCISES_DIR the output
 * directory.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  EXIT,
  REPO,
  createRun,
  exists,
  firstLine,
  invokeClaude,
  section,
  show,
} from './lib/authoring.mjs';

const EXERCISES_DIR = process.env.KATA_EXERCISES_DIR ?? join(REPO, 'exercises');

const NEVER_FROM_FLAWED_CODE =
  'The Test Suite is generated from the brief\'s Target Interface, NEVER from ' +
  'the flawed code. Tests written from the flawed code would bless the Smell.';

const run = createRun('draft-exercise.log');

function usage(message) {
  run.done(EXIT.usage, [
    `DRAFT USAGE ERROR: ${message}`,
    'usage: node scripts/draft-exercise.mjs <brief.json> [exercise-id] [--dry-run]',
    '       <brief.json> is one Exercise brief, or a Module pack (then name the exercise id)',
  ]);
}

/** Loads and validates the Exercise brief; exits 2 on any shape problem. */
function loadBrief(path, exerciseId) {
  if (!exists(path)) usage(`no such file: ${path}`);
  let json;
  try {
    json = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    usage(`${path} is not valid JSON: ${firstLine(error.message)}`);
  }

  let brief = json;
  if (Array.isArray(json.exercises)) {
    if (!exerciseId) {
      usage(
        `${path} is a Module pack — name the exercise id (have: ${json.exercises
          .map((entry) => entry.id)
          .join(', ')})`,
      );
    }
    brief = json.exercises.find((entry) => entry.id === exerciseId);
    if (!brief) {
      usage(
        `no exercise "${exerciseId}" in ${path} (have: ${json.exercises
          .map((entry) => entry.id)
          .join(', ')})`,
      );
    }
  } else if (exerciseId && json.id !== exerciseId) {
    usage(`${path} is the brief for "${json.id}", not "${exerciseId}"`);
  }

  // The fields the prompt and folder depend on, per schemas/module-content.schema.json.
  if (typeof brief.id !== 'string' || !/^m\d{2}-e\d+$/.test(brief.id)) {
    usage(`brief.id must match mNN-eN, got ${JSON.stringify(brief.id)}`);
  }
  if (brief.type !== 'refactor' && brief.type !== 'construct') {
    usage(`brief.type must be "refactor" or "construct", got ${JSON.stringify(brief.type)}`);
  }
  for (const field of ['title', 'concept', 'smell', 'targetInterfaceCode']) {
    if (typeof brief[field] !== 'string' || brief[field].trim() === '') {
      usage(`brief.${field} must be a non-empty string`);
    }
  }
  if (!Number.isInteger(brief.sizeBudgetLoc) || brief.sizeBudgetLoc < 1 || brief.sizeBudgetLoc > 300) {
    usage(`brief.sizeBudgetLoc must be an integer 1–300, got ${JSON.stringify(brief.sizeBudgetLoc)}`);
  }
  return brief;
}

function buildPrompt(brief) {
  const language = readFileSync(join(REPO, 'docs/ubiquitous-language.md'), 'utf8');
  const design = readFileSync(join(REPO, 'docs/design.md'), 'utf8');
  const rules = section(design, 'Exercise design rules');
  if (!rules) {
    run.fail(EXIT.usage, 'docs/design.md has no "## Exercise design rules" section to embed');
  }

  const material =
    brief.type === 'refactor'
      ? [
          '- "files": the deliberately flawed C# implementation of the Target',
          '  Interface. It must compile, behave correctly under the Test Suite,',
          '  and visibly exhibit the Smell — plausibly bad, not cartoonish.',
        ]
      : [
          '- "files": a stub only — one class implementing the Target Interface',
          '  whose members all `throw new NotImplementedException();`. No real',
          '  implementation: the learner builds it.',
        ];

  return [
    'You are drafting the practice material for one Exercise of Kata, a',
    'read-only app for learning software design fundamentals. This is an',
    'authoring-time draft that a human reviews before anything is committed.',
    '',
    '## The Exercise brief',
    '',
    `- id: ${brief.id}`,
    `- type: ${brief.type}`,
    `- title: ${brief.title}`,
    `- concept: ${brief.concept}`,
    `- smell: ${brief.smell}`,
    `- size budget: ${brief.sizeBudgetLoc} non-blank lines of C# source, total`,
    '',
    '## Target Interface (immutable — the script writes this file verbatim; do not restate or alter it)',
    '',
    brief.targetInterfaceCode.trim(),
    '',
    '## Ubiquitous Language (use these terms exactly — embedded verbatim)',
    '',
    language.trim(),
    '',
    '## Exercise design rules (from docs/design.md)',
    '',
    rules,
    '',
    '## The one non-negotiable rule',
    '',
    `${NEVER_FROM_FLAWED_CODE} Write every test by reading the Target`,
    'Interface and the brief above — as if the implementation did not exist.',
    '',
    '## What to generate',
    '',
    ...material,
    '- "testFiles": the xUnit Test Suite ([Fact]/[Theory], `using Xunit;`),',
    '  written against the Target Interface alone per the rule above. It must',
    '  compile with only the Target Interface visible, and it is the',
    '  trustworthy artifact the learner reviews and runs.',
    '- "smellNotes": short markdown for the human reviewer — where the Smell',
    '  was planted (or how the stub tempts one), what the Test Suite pins',
    '  down, and what a good solution hides.',
    '',
    '## Output contract — respond with ONE strict JSON object, nothing else',
    '',
    '{"files":[{"path":"<Name>.cs","content":"<C# source>"}],"testFiles":[{"path":"<Name>Tests.cs","content":"<C# source>"}],"smellNotes":"<markdown>"}',
    '',
    '- "path" is a bare .cs file name (no directories); files land in src/,',
    '  testFiles in tests/.',
    '- Do NOT emit the Target Interface file or any .csproj — the script',
    '  writes those deterministically.',
    '- src files use `namespace Kata.Exercise;`; test files use',
    '  `namespace Kata.Exercise.Tests;` with `using Kata.Exercise;`.',
    '- Target framework net10.0, nullable enabled, implicit usings enabled.',
    '- Keep the total src content within the size budget.',
    '- No markdown fences, no preamble, no commentary — the JSON object only.',
  ].join('\n');
}

/** Strips an optional ```json fence, then parses and validates the contract. */
function parseMaterial(text) {
  const bare = text.replace(/^```(?:json)?\s*\n/, '').replace(/\n```\s*$/, '');
  let material;
  try {
    material = JSON.parse(bare);
  } catch {
    run.fail(EXIT.badOutput, `the draft is not the strict JSON contract: ${firstLine(bare)}`);
  }

  for (const key of ['files', 'testFiles']) {
    if (!Array.isArray(material[key]) || material[key].length === 0) {
      run.fail(EXIT.badOutput, `draft JSON has no non-empty "${key}" array`);
    }
    for (const entry of material[key]) {
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.cs$/.test(entry?.path ?? '')) {
        run.fail(EXIT.badOutput, `unsafe or non-.cs ${key} path: ${JSON.stringify(entry?.path)}`);
      }
      if (typeof entry.content !== 'string' || entry.content.trim() === '') {
        run.fail(EXIT.badOutput, `${key} entry ${entry.path} has empty content`);
      }
    }
  }
  if (typeof material.smellNotes !== 'string' || material.smellNotes.trim() === '') {
    run.fail(EXIT.badOutput, 'draft JSON has no "smellNotes" text');
  }
  return material;
}

/** The interface's own name, for its file: `public interface IFoo` → IFoo. */
function interfaceName(code) {
  return code.match(/\binterface\s+([A-Za-z_]\w*)/)?.[1] ?? 'TargetInterface';
}

function srcCsproj() {
  return [
    '<Project Sdk="Microsoft.NET.Sdk">',
    '  <PropertyGroup>',
    '    <TargetFramework>net10.0</TargetFramework>',
    '    <Nullable>enable</Nullable>',
    '    <ImplicitUsings>enable</ImplicitUsings>',
    '    <RootNamespace>Kata.Exercise</RootNamespace>',
    '  </PropertyGroup>',
    '</Project>',
    '',
  ].join('\n');
}

function testsCsproj() {
  return [
    '<Project Sdk="Microsoft.NET.Sdk">',
    '  <PropertyGroup>',
    '    <TargetFramework>net10.0</TargetFramework>',
    '    <Nullable>enable</Nullable>',
    '    <ImplicitUsings>enable</ImplicitUsings>',
    '    <IsPackable>false</IsPackable>',
    '    <RootNamespace>Kata.Exercise.Tests</RootNamespace>',
    '  </PropertyGroup>',
    '  <ItemGroup>',
    '    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.14.1" />',
    '    <PackageReference Include="xunit" Version="2.9.3" />',
    '    <PackageReference Include="xunit.runner.visualstudio" Version="3.1.5" />',
    '  </ItemGroup>',
    '  <ItemGroup>',
    '    <ProjectReference Include="../src/Exercise.csproj" />',
    '  </ItemGroup>',
    '</Project>',
    '',
  ].join('\n');
}

function readme(brief, interfaceFile) {
  const goal =
    brief.type === 'refactor'
      ? 'The Smell is planted in `src/`. Refactor behind the Target Interface until every design decision the Smell leaks is hidden again — with the Test Suite green the whole time.'
      : 'src/ holds the Target Interface and a stub only. Implement it until the Test Suite is green, keeping the design decisions named in the Smell hidden from callers.';
  return [
    `# ${brief.title} (${brief.id})`,
    '',
    `- **Type:** ${brief.type}`,
    `- **Concept:** ${brief.concept}`,
    `- **Smell:** ${brief.smell}`,
    `- **Size budget:** ≤ ${brief.sizeBudgetLoc} source LOC`,
    '',
    '## Goal',
    '',
    goal,
    '',
    '## Run the Test Suite',
    '',
    '```sh',
    'cd tests',
    'dotnet test',
    '```',
    '',
    '## The rules',
    '',
    `- The Target Interface (\`src/${interfaceFile}\`) is **immutable during the`,
    '  Exercise**. Wanting to change it is a signal to record and discuss, not',
    '  an allowed move.',
    `- ${NEVER_FROM_FLAWED_CODE} Review the`,
    '  Test Suite before you start — it is the trustworthy artifact.',
    '',
  ].join('\n');
}

function main(argv) {
  run.note(`draft-exercise ${new Date().toISOString()}`);

  const flags = argv.filter((arg) => arg.startsWith('--'));
  const args = argv.filter((arg) => !arg.startsWith('--'));
  const unknown = flags.find((flag) => flag !== '--dry-run');
  if (unknown) usage(`unknown flag ${unknown} (regeneration is a new Exercise id, so there is no --force)`);
  if (args.length < 1 || args.length > 2) usage(`expected <brief.json> [exercise-id], got ${args.length} arguments`);

  const brief = loadBrief(args[0], args[1]);
  run.note(`brief ${brief.id} (${brief.type}) — ${brief.title}`);
  const prompt = buildPrompt(brief);

  if (flags.includes('--dry-run')) {
    run.note('dry run: prompt printed, nothing written');
    run.done(EXIT.ok, [prompt, '', `DRAFT ${brief.id} dry-run ok (nothing written)`]);
  }

  const moduleId = brief.id.slice(0, 3);
  const dir = join(EXERCISES_DIR, moduleId, brief.id);
  if (exists(dir)) {
    run.fail(
      EXIT.exists,
      `${show(dir)} already exists — regeneration takes a NEW Exercise id, never an overwrite`,
    );
  }

  const material = parseMaterial(invokeClaude(run, prompt));
  const interfaceFile = `${interfaceName(brief.targetInterfaceCode)}.cs`;

  // Assemble everything in memory first, so a bad draft writes nothing.
  // The Target Interface file comes LAST: written verbatim from the brief, it
  // wins even if the draft disobeyed and emitted its own copy.
  const output = [
    ['README.md', readme(brief, interfaceFile)],
    ['smell-notes.md', `${material.smellNotes.trim()}\n`],
    ['src/Exercise.csproj', srcCsproj()],
    ['tests/Exercise.Tests.csproj', testsCsproj()],
    ...material.testFiles.map((entry) => [`tests/${entry.path}`, `${entry.content.trimEnd()}\n`]),
    ...material.files.map((entry) => [`src/${entry.path}`, `${entry.content.trimEnd()}\n`]),
    [`src/${interfaceFile}`, `namespace Kata.Exercise;\n\n${brief.targetInterfaceCode.trim()}\n`],
  ];

  const written = new Map();
  for (const [rel, content] of output) {
    written.set(rel, content);
  }
  for (const [rel, content] of written) {
    const path = join(dir, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    run.note(`wrote ${rel} (${content.length} chars)`);
  }

  const srcLoc = [...written]
    .filter(([rel]) => rel.startsWith('src/') && rel.endsWith('.cs'))
    .flatMap(([, content]) => content.split('\n'))
    .filter((line) => line.trim() !== '').length;
  const budget =
    srcLoc > brief.sizeBudgetLoc
      ? `OVER the ${brief.sizeBudgetLoc} LOC budget — trim before review`
      : `budget ${brief.sizeBudgetLoc}`;
  run.done(EXIT.ok, [`DRAFT ${brief.id} ok → ${show(dir)} | ${srcLoc} src LOC (${budget})`]);
}

main(process.argv.slice(2));
