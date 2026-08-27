#!/usr/bin/env node
/**
 * Validates authored content JSON against its JSON Schema (draft 2020-12).
 *
 * docs/engineering.md § 3 Content schema: content is static JSON committed to
 * the repo and validated by a schema, "locally and in CI **before** the build,
 * so invalid content can never deploy".
 *
 * Two modes:
 *
 *   node scripts/validate-content.mjs                     # repo layout (CI, smoke)
 *   node scripts/validate-content.mjs <schema> <file|dir>  # an explicit pair
 *
 * The schema and the content shipped in #7, so the repo-layout mode is a real
 * gate: schemas/module-index.schema.json against public/content/index.json,
 * then schemas/module-content.schema.json against every file under
 * public/content/modules/ (none while every Module is still pending). The SKIP
 * path below only fires if those files ever go missing — it never pretends to
 * have passed.
 *
 * Output contract (scripts/README.md): one line on success, full transcript to
 * .checks/content.log, and on failure only the offending files with their
 * errors plus the transcript path.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const REPO = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CHECKS_DIR = process.env.KATA_CHECKS_DIR ?? join(REPO, '.checks');
const LOG = join(CHECKS_DIR, 'content.log');

/** Distinct per failure kind, so a caller can branch without parsing text. */
const EXIT = { ok: 0, usage: 2, invalid: 3, missing: 4 };

/** The repo layout of docs/engineering.md § 3, in validation order. */
const REPO_PAIRS = [
  { schema: 'schemas/module-index.schema.json', content: 'public/content/index.json' },
  { schema: 'schemas/module-content.schema.json', content: 'public/content/modules' },
];

/** Everything the run wrote, flushed to LOG whatever the outcome. */
const transcript = [];

function note(line) {
  transcript.push(line);
}

function flush() {
  mkdirSync(CHECKS_DIR, { recursive: true });
  writeFileSync(LOG, `${transcript.join('\n')}\n`);
}

function done(code, lines) {
  flush();
  console.log(lines.join('\n'));
  process.exit(code);
}

function exists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** A content argument is either one JSON file or a flat directory of them. */
function contentFiles(path) {
  if (!isDirectory(path)) return [path];
  return readdirSync(path)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => join(path, name));
}

function show(path) {
  const rel = relative(REPO, path);
  return rel.startsWith('..') ? path : rel;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function compile(schemaPath) {
  const ajv = new Ajv2020({
    allErrors: true,
    // Strict-mode complaints are authoring smells, not content errors: they go
    // to the transcript rather than failing somebody's deploy.
    strict: 'log',
    logger: { log: note, warn: note, error: note },
  });
  return ajv.compile(readJson(schemaPath));
}

/** Ajv's errors, flattened to one readable line each. */
function formatErrors(errors) {
  return (errors ?? []).map((error) => {
    const where = error.instancePath === '' ? '/' : error.instancePath;
    const extra = error.params?.additionalProperty
      ? ` (${error.params.additionalProperty})`
      : error.params?.missingProperty
        ? ` (${error.params.missingProperty})`
        : '';
    return `  ${where}: ${error.message}${extra}`;
  });
}

/**
 * The one index rule draft 2020-12 cannot state: a Module's `categoryId` must
 * name a Category the same file declares (docs/engineering.md § 3). Reference
 * integrity inside one document is invisible to the schema, so it is checked
 * here rather than in a test — that way a dangling reference fails the same
 * gate locally, in CI, and against the DEPLOYED index in scripts/smoke.sh.
 */
function danglingCategoryErrors(data) {
  if (!Array.isArray(data?.categories) || !Array.isArray(data?.modules)) return [];
  const declared = new Set(data.categories.map((category) => category?.id));
  return data.modules
    .map((module, position) =>
      declared.has(module?.categoryId)
        ? null
        : `  /modules/${position}/categoryId: must name a Category this index declares (${module?.categoryId})`,
    )
    .filter((line) => line !== null);
}

/**
 * The two Module-content rules draft 2020-12 cannot state (docs/engineering.md
 * § 3): question ids unique within the Module, option values unique within a
 * question. `uniqueItems` compares whole objects, so two options differing
 * only in label slip past it — and a duplicate value makes one radio
 * unreachable, because a pick is stored by value and restored by matching it.
 * Checked here for the same reason the dangling categoryId is: same gate
 * locally, in CI, and against the DEPLOYED content in scripts/smoke.sh.
 */
function duplicateSelfCheckErrors(data) {
  const questions = data?.selfCheckQuestions;
  if (!Array.isArray(questions)) return [];
  const errors = [];
  const seenIds = new Set();
  questions.forEach((question, position) => {
    const at = `/selfCheckQuestions/${position}`;
    if (seenIds.has(question?.id)) {
      errors.push(`  ${at}/id: must be unique within the Module (${question?.id})`);
    }
    seenIds.add(question?.id);
    if (!Array.isArray(question?.options)) return;
    const seenValues = new Set();
    question.options.forEach((option, index) => {
      if (seenValues.has(option?.value)) {
        errors.push(
          `  ${at}/options/${index}/value: must be unique within the question (${option?.value})`,
        );
      }
      seenValues.add(option?.value);
    });
  });
  return errors;
}

/** Everything the schema itself cannot say, for one already-valid document. */
function structuralErrors(data) {
  return [...danglingCategoryErrors(data), ...duplicateSelfCheckErrors(data)];
}

/** Validates one schema/content pair, collecting failures rather than exiting. */
function validatePair(schemaPath, contentPath, failures) {
  note(`schema ${show(schemaPath)}`);
  let validate;
  try {
    validate = compile(schemaPath);
  } catch (error) {
    note(`  schema unusable: ${error.message}`);
    failures.push({ file: show(schemaPath), errors: [`  unusable schema: ${error.message}`] });
    return 0;
  }

  let checked = 0;
  for (const file of contentFiles(contentPath)) {
    checked += 1;
    let data;
    try {
      data = readJson(file);
    } catch (error) {
      note(`  FAIL ${show(file)} — not JSON: ${error.message}`);
      failures.push({ file: show(file), errors: [`  not valid JSON: ${error.message}`] });
      continue;
    }
    if (validate(data)) {
      const structural = structuralErrors(data);
      if (structural.length === 0) {
        note(`  ok   ${show(file)}`);
        continue;
      }
      note(`  FAIL ${show(file)}`);
      for (const line of structural) note(`  ${line}`);
      failures.push({ file: show(file), errors: structural });
      continue;
    }
    const errors = formatErrors(validate.errors);
    note(`  FAIL ${show(file)}`);
    for (const line of errors) note(`  ${line}`);
    failures.push({ file: show(file), errors });
  }
  return checked;
}

function usage(message) {
  done(EXIT.usage, [
    `CONTENT USAGE ERROR: ${message}`,
    'usage: node scripts/validate-content.mjs [<schema.json> <content-file-or-dir>]',
    '       no arguments = validate the repo layout (docs/engineering.md § 3)',
  ]);
}

function report(checked, failures, label) {
  if (failures.length === 0) {
    done(EXIT.ok, [`CONTENT ok (${checked} ${checked === 1 ? 'file' : 'files'})${label}`]);
  }

  const lines = [`CONTENT FAIL ${failures.length}/${checked} files${label}`];
  for (const failure of failures.slice(0, 3)) {
    lines.push(`--- ${failure.file} ---`);
    lines.push(...failure.errors.slice(0, 5));
    if (failure.errors.length > 5) lines.push(`  ... ${failure.errors.length - 5} more errors`);
  }
  if (failures.length > 3) lines.push(`... ${failures.length - 3} more files failed`);
  lines.push(`log: ${LOG}`);
  done(EXIT.invalid, lines);
}

function main(argv) {
  rmSync(LOG, { force: true });
  note(`validate-content ${new Date().toISOString()}`);

  if (argv.length === 1 || argv.length > 2) {
    usage(`expected 0 or 2 arguments, got ${argv.length}`);
  }

  const failures = [];
  let checked = 0;

  if (argv.length === 2) {
    const [schemaPath, contentPath] = argv.map((path) => resolve(path));
    for (const path of [schemaPath, contentPath]) {
      if (!exists(path)) {
        note(`missing ${path}`);
        done(EXIT.missing, [`CONTENT FAIL missing path: ${show(path)}`, `log: ${LOG}`]);
      }
    }
    checked = validatePair(schemaPath, contentPath, failures);
    return report(checked, failures, ` | ${show(schemaPath)}`);
  }

  // Repo layout. Both schemas and the index must exist; the modules directory
  // is optional (a Module with no authored pack has no file yet).
  for (const { schema, content } of REPO_PAIRS) {
    const schemaPath = join(REPO, schema);
    if (!exists(schemaPath)) {
      note(`skip: ${schema} does not exist yet (#7)`);
      done(EXIT.ok, [`CONTENT SKIP (no schema yet: ${schema} lands in #7)`]);
    }
    if (content.endsWith('.json') && !exists(join(REPO, content))) {
      note(`skip: ${content} does not exist yet (#7)`);
      done(EXIT.ok, [`CONTENT SKIP (no content yet: ${content} lands in #7)`]);
    }
  }

  for (const { schema, content } of REPO_PAIRS) {
    const contentPath = join(REPO, content);
    if (!exists(contentPath)) {
      note(`no ${content} yet — nothing to validate against ${schema}`);
      continue;
    }
    checked += validatePair(join(REPO, schema), contentPath, failures);
  }
  return report(checked, failures, '');
}

main(process.argv.slice(2));
