import type { ReactNode } from 'react';

/**
 * Renders Concept Page markdown (docs/engineering.md § 7: ~1 page of prose)
 * as React elements — no HTML strings, so nothing to sanitize.
 *
 * Deliberately covers only the constructs the authored packs use: `#`–`####`
 * headings, paragraphs, `-` and `1.` lists (with wrapped continuation lines),
 * and inline **strong** / *em* / `code`. Anything else renders as plain text
 * rather than growing a markdown engine here.
 *
 * Headings render at their authored level, floored at h2: the page h1 is the
 * Module title in the header block, and a pack's `##` sections are that
 * title's sections — the same level as Model Examples, Exercises and the
 * Self-Check beside them. A stray `#` clamps to h2 rather than becoming a
 * second page title.
 */
export function Markdown({ source }: { source: string }) {
  return <>{parseBlocks(source).map(renderBlock)}</>;
}

type Block =
  | { readonly kind: 'heading'; readonly level: number; readonly text: string }
  | { readonly kind: 'paragraph'; readonly text: string }
  | {
      readonly kind: 'list';
      readonly ordered: boolean;
      readonly items: readonly string[];
    };

const HEADING = /^(#{1,4})\s+(.+)$/;
const LIST_ITEM = /^\s*(?:-|\d+\.)\s+/;

/** One block read off `lines` at `at`, and the index of the line after it. */
type Read = { readonly block: Block; readonly next: number };

function parseBlocks(source: string): Block[] {
  const lines = source.split('\n');
  const blocks: Block[] = [];
  for (let at = 0; at < lines.length;) {
    const read = readHeading(lines, at) ?? readList(lines, at) ?? readParagraph(lines, at);
    if (read !== null) {
      blocks.push(read.block);
    }
    at = read?.next ?? at + 1; // No reader wants a blank line: step past it.
  }
  return blocks;
}

function readHeading(lines: readonly string[], at: number): Read | null {
  const heading = HEADING.exec(lines[at] ?? '');
  if (heading === null) {
    return null;
  }
  const level = heading[1]?.length ?? 1;
  const text = heading[2] ?? '';
  return { block: { kind: 'heading', level, text }, next: at + 1 };
}

/**
 * A `-` / `1.` run up to the next blank line. A run line that is not itself an
 * item is an indented continuation of the previous one (hard-wrapped source).
 */
function readList(lines: readonly string[], at: number): Read | null {
  const first = lines[at] ?? '';
  if (!LIST_ITEM.test(first)) {
    return null;
  }
  const end = endOfRun(lines, at, isNonBlank);
  const items: string[] = [];
  for (const line of lines.slice(at, end)) {
    if (LIST_ITEM.test(line)) {
      items.push(line.replace(LIST_ITEM, '').trim());
    } else {
      const last = items.length - 1;
      items[last] = `${items[last] ?? ''} ${line.trim()}`.trim();
    }
  }
  const ordered = /^\s*\d+\./.test(first);
  return { block: { kind: 'list', ordered, items }, next: end };
}

/** Consecutive plain lines joined with spaces (hard wraps); null on a blank. */
function readParagraph(lines: readonly string[], at: number): Read | null {
  const end = endOfRun(lines, at, isPlain);
  if (end === at) {
    return null;
  }
  const text = lines
    .slice(at, end)
    .map((line) => line.trim())
    .join(' ');
  return { block: { kind: 'paragraph', text }, next: end };
}

function isNonBlank(line: string): boolean {
  return line.trim() !== '';
}

function isPlain(line: string): boolean {
  return isNonBlank(line) && !HEADING.test(line) && !LIST_ITEM.test(line);
}

/** Index of the first line at or after `at` that fails `keep`, or the end. */
function endOfRun(lines: readonly string[], at: number, keep: (line: string) => boolean): number {
  let end = at;
  while (end < lines.length && keep(lines[end] ?? '')) {
    end += 1;
  }
  return end;
}

function renderBlock(block: Block, index: number): ReactNode {
  switch (block.kind) {
    case 'heading': {
      // `##` → h2 … `####` → h4, floored at h2: nothing in the prose is a
      // second h1. The design system sizes these (styles.css).
      const Tag = `h${Math.min(Math.max(block.level, 2), 6)}` as 'h2';
      return <Tag key={index}>{renderInline(block.text)}</Tag>;
    }
    case 'list': {
      const items = block.items.map((item, itemIndex) => (
        <li key={itemIndex}>{renderInline(item)}</li>
      ));
      return block.ordered ? <ol key={index}>{items}</ol> : <ul key={index}>{items}</ul>;
    }
    case 'paragraph':
      return <p key={index}>{renderInline(block.text)}</p>;
  }
}

/** Inline spans: `code` first (its content is verbatim), then ** before *. */
function renderInline(text: string): ReactNode[] {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/);
  return tokens.map((token, index) => {
    if (token.length > 2 && token.startsWith('`') && token.endsWith('`')) {
      return <code key={index}>{token.slice(1, -1)}</code>;
    }
    if (token.length > 4 && token.startsWith('**') && token.endsWith('**')) {
      return <strong key={index}>{token.slice(2, -2)}</strong>;
    }
    if (token.length > 2 && token.startsWith('*') && token.endsWith('*')) {
      return <em key={index}>{token.slice(1, -1)}</em>;
    }
    return token;
  });
}
