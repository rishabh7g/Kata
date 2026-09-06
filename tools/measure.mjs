// Measures the built app's screens at a phone width and a desktop one.
//
// Hand-run, never in CI, and it gates nothing: it reports numbers a screen
// issue quotes before and after its change. The stylesheet tests it replaced
// asserted that a rule was written; this asserts nothing and shows what a
// reader actually gets.
//
//   npm run build
//   npx vite preview --port 4173 &
//   node tools/measure.mjs
//
// Needs Playwright available to node (`npm i -g playwright`, or npx). It is
// not a dependency of the app: nothing the build or the deploy does needs it.

const BASE = process.argv[2] ?? 'http://localhost:4173/Kata/';
const WIDTHS = [360, 1024];
const VIEWPORT_HEIGHT = 740;

const ROUTES = [
  ['curriculum', '#/'],
  ['module m01', '#/modules/m01'],
  ['module ai03', '#/modules/ai03'],
  ['exercise m01-e1', '#/modules/m01/exercises/m01-e1'],
];

// What each screen is measured for: the height in viewports, and the y of the
// thing the reader came to that screen for.
const ANCHORS = {
  'first module row': '.curriculum-row',
  'concept prose': '.module-concept',
  'self-check': '.self-check',
  exercises: '.module-exercises',
};

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'tools/measure.mjs needs Playwright: npm i -g playwright, then re-run.',
  );
  process.exit(2);
}

const browser = await chromium.launch();
try {
  for (const width of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height: VIEWPORT_HEIGHT },
    });
    const page = await context.newPage();
    console.log(`\n${width}px x ${VIEWPORT_HEIGHT}`);
    for (const [name, hash] of ROUTES) {
      await page.goto(BASE + hash, { waitUntil: 'networkidle' });
      const measured = await page.evaluate((anchors) => {
        // scrollHeight reads 100vh on this layout, so the page's real extent is
        // the furthest bottom edge any element reaches.
        const bottom = Math.max(
          ...Array.from(document.querySelectorAll('body *')).map(
            (element) =>
              element.getBoundingClientRect().bottom + window.scrollY,
          ),
        );
        const tops = {};
        for (const [label, selector] of Object.entries(anchors)) {
          const element = document.querySelector(selector);
          if (element !== null) {
            tops[label] = Math.round(
              element.getBoundingClientRect().top + window.scrollY,
            );
          }
        }
        return {
          screens: +(bottom / window.innerHeight).toFixed(2),
          words: document.body.innerText.split(/\s+/).filter(Boolean).length,
          tops,
        };
      }, ANCHORS);

      const anchors = Object.entries(measured.tops)
        .map(([label, y]) => `${label} y=${y}`)
        .join(', ');
      console.log(
        `  ${name.padEnd(16)} ${String(measured.screens).padStart(5)} screens  ` +
          `${String(measured.words).padStart(4)} words  ${anchors}`,
      );
    }
    await context.close();
  }
} finally {
  await browser.close();
}
