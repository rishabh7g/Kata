// Every authored Concept Page (public/content/modules/*.json) rendered through
// <Markdown>, pinned as one HTML file. The packs are the only markdown the app
// renders, so this is the parser's whole observable behaviour: a change to
// this snapshot is a behaviour change, not a refactor. Delete the snapshot
// and re-run to re-pin on purpose.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { Markdown } from './Markdown';

const MODULES_DIR = join(process.cwd(), 'public', 'content', 'modules');

function renderPack(file: string): string {
  const pack = JSON.parse(readFileSync(join(MODULES_DIR, file), 'utf8')) as {
    conceptPageMarkdown: string;
  };
  const html = renderToStaticMarkup(<Markdown source={pack.conceptPageMarkdown} />);
  return `<!-- ${file} -->\n${html}\n`;
}

it('renders every authored Concept Page exactly as pinned', async () => {
  const files = readdirSync(MODULES_DIR)
    .filter((file) => file.endsWith('.json'))
    .sort();
  expect(files).toHaveLength(13);
  await expect(files.map(renderPack).join('\n')).toMatchFileSnapshot(
    './__snapshots__/Markdown.concept-pages.html',
  );
});
