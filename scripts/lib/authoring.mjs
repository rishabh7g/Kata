/**
 * Shared plumbing for the authoring-time draft scripts (#20 draft-concept,
 * #21 draft-exercise). docs/engineering.md § 5: these run on the build host
 * only, never in the app or the deploy path.
 *
 * Output contract (scripts/README.md): one line on success, full transcript
 * to .checks/<log>, distinct exit codes shared by every draft script.
 */
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const CHECKS_DIR = process.env.KATA_CHECKS_DIR ?? join(REPO, '.checks');
export const CLAUDE_BIN = process.env.KATA_CLAUDE_BIN ?? 'claude';

/** Distinct per failure kind, so a caller can branch without parsing text. */
export const EXIT = { ok: 0, usage: 2, exists: 3, cli: 4, badOutput: 5 };

/**
 * One run = one transcript, flushed to .checks/<logName> whatever the outcome.
 * Returns { note, done, fail, LOG }.
 */
export function createRun(logName) {
  const LOG = join(CHECKS_DIR, logName);
  const transcript = [];
  rmSync(LOG, { force: true });

  const note = (line) => transcript.push(line);

  const done = (code, lines) => {
    mkdirSync(CHECKS_DIR, { recursive: true });
    writeFileSync(LOG, `${transcript.join('\n')}\n`);
    console.log(lines.join('\n'));
    process.exit(code);
  };

  const fail = (code, message) => {
    done(code, [`DRAFT FAIL ${message}`, `log: ${LOG}`]);
  };

  return { note, done, fail, LOG };
}

/** Repo-relative path for display, absolute if outside the repo. */
export function show(path) {
  const rel = relative(REPO, path);
  return rel.startsWith('..') ? path : rel;
}

export function exists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

/** The lines of one `## <heading>` section of a markdown doc. */
export function section(markdown, heading) {
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

export function firstLine(text) {
  return (text ?? '').trim().split('\n')[0]?.slice(0, 120) ?? '';
}

/**
 * Calls the local claude CLI headless (`claude -p --output-format json`) and
 * returns the trimmed result text. Fails the run with EXIT.cli when the CLI
 * is missing or exits non-zero, EXIT.badOutput when its envelope is not the
 * expected JSON. For tests, $KATA_CLAUDE_BIN swaps in a fake binary.
 */
export function invokeClaude(run, prompt) {
  run.note(`invoking: ${CLAUDE_BIN} -p --output-format json`);
  const result = spawnSync(CLAUDE_BIN, ['-p', '--output-format', 'json'], {
    input: prompt,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });

  if (result.error) {
    run.note(`spawn error: ${result.error.message}`);
    run.fail(
      EXIT.cli,
      `cannot run \`${CLAUDE_BIN}\` (${result.error.code ?? result.error.message}) — is the claude CLI installed and on PATH?`,
    );
  }
  run.note(`exit ${result.status}`);
  run.note(`--- stdout ---\n${result.stdout}`);
  run.note(`--- stderr ---\n${result.stderr}`);
  if (result.status !== 0) {
    run.fail(
      EXIT.cli,
      `\`${CLAUDE_BIN}\` exited ${result.status} — is the CLI authenticated? ${firstLine(result.stderr || result.stdout)}`,
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    run.fail(EXIT.badOutput, `\`${CLAUDE_BIN}\` returned non-JSON output: ${firstLine(result.stdout)}`);
  }
  if (parsed.is_error || typeof parsed.result !== 'string' || parsed.result.trim() === '') {
    run.fail(EXIT.badOutput, `\`${CLAUDE_BIN}\` returned no draft text (is_error=${parsed.is_error ?? false})`);
  }
  return parsed.result.trim();
}
