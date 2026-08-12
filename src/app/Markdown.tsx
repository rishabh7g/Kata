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
 * Headings shift down one level (`##` → h3): the page h1 is the Module title
 * in the header block (#12), and this prose sits under the `Concept Page`
 * section label, which is an h2 (#75) — so the prose's own top level is h3.
 * The packs open with the Module's `# title`, which ModuleScreen strips, so
 * `##` is the top level that actually reaches here; a stray `#` clamps to h3
 * rather than colliding with the section label above it.
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

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.split('\n');
  let i = 0;
  const line = () => lines[i] ?? '';

  while (i < lines.length) {
    if (line().trim() === '') {
      i += 1;
      continue;
    }

    const heading = HEADING.exec(line());
    if (heading !== null) {
      blocks.push({
        kind: 'heading',
        level: heading[1]?.length ?? 1,
        text: heading[2] ?? '',
      });
      i += 1;
      continue;
    }

    if (LIST_ITEM.test(line())) {
      const ordered = /^\s*\d+\./.test(line());
      const items: string[] = [];
      while (i < lines.length && line().trim() !== '') {
        if (LIST_ITEM.test(line())) {
          items.push(line().replace(LIST_ITEM, '').trim());
        } else {
          // An indented continuation of the previous item (hard-wrapped source).
          const last = items.length - 1;
          items[last] = `${items[last] ?? ''} ${line().trim()}`.trim();
        }
        i += 1;
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }

    // Paragraph: consecutive plain lines joined with spaces (hard wraps).
    const parts: string[] = [];
    while (
      i < lines.length &&
      line().trim() !== '' &&
      !HEADING.test(line()) &&
      !LIST_ITEM.test(line())
    ) {
      parts.push(line().trim());
      i += 1;
    }
    blocks.push({ kind: 'paragraph', text: parts.join(' ') });
  }

  return blocks;
}

function renderBlock(block: Block, index: number): ReactNode {
  switch (block.kind) {
    case 'heading': {
      // `##` → h3 … `####` → h5, floored at h3 so nothing lands on the
      // section label's own level (#75); the design system sizes these
      // (styles.css) and the sizes are unchanged by the floor.
      const Tag = `h${Math.min(Math.max(block.level + 1, 3), 6)}` as 'h3';
      return <Tag key={index}>{renderInline(block.text)}</Tag>;
    }
    case 'list': {
      const items = block.items.map((item, itemIndex) => (
        <li key={itemIndex}>{renderInline(item)}</li>
      ));
      return block.ordered ? (
        <ol key={index}>{items}</ol>
      ) : (
        <ul key={index}>{items}</ul>
      );
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
