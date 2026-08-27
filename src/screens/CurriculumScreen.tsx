import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCategories } from '../app/useCategories';
import { useCurriculum } from '../app/CurriculumContext';
import { useProgress } from '../app/ProgressContext';
import { useDocumentTitle } from '../app/useDocumentTitle';
import { useModuleSummaries } from '../app/useModuleSummaries';
import type { Category, ModuleId, ModuleSummary } from '../curriculum';
import type { IProgress } from '../progress';
import { LANGUAGE_LABEL_KEY } from '../strings/language';
import { useStrings } from '../strings/strings';
import { ProgressBackup } from './ProgressBackup';

/**
 * Curriculum — the Library's index: every Category in order, each with its
 * Modules in order, every row open to read (design/README.md § Screens › 1,
 * design/screens/01-state.png).
 *
 * Renders exactly what `ICurriculum.getCategories()` and `getModules()`
 * return, in their order — which is a suggested reading order and nothing
 * else (docs/ubiquitous-language.md § Curriculum), so every row is a link to
 * its Module screen from the very first visit (#156). The status column is a
 * tag only — no suite-run counts anywhere (verification removed per the
 * read-only decision, #3). The one thing read from IProgress directly is
 * Self-Check draft existence, which ModuleSummary deliberately does not
 * carry: it drives the outline `In progress` tag (#18).
 *
 * Categories are HEADINGS over those rows (#163), not a fourth screen: Kata
 * has three screens, and a Category has no route, no filter and no collapse.
 * A heading is a label — the only way to a Module is still its row — which is
 * the interaction-depth question (design/issue-guide.md) answered in markup:
 * the `<section>`'s header holds an `<h2>`, one line of description and the
 * Category's language once, and not a single anchor.
 */
export function CurriculumScreen() {
  const curriculum = useCurriculum();
  const modules = useModuleSummaries(curriculum);
  const sections = groupIntoSections(useCategories(curriculum), modules);
  const answeredModuleIds = useAnsweredModuleIds(useProgress(), modules);
  // The home screen is the app itself: the tab reads plain `Kata` (#77).
  useDocumentTitle(null);
  const s = useStrings();

  return (
    <>
      {/* The kicker ("Curriculum — fixed order, foundations down") and the
          intro were read-once explainer copy — deleted on the copy pass
          (#113). What came back in their place (#134) is the orientation
          block: three first-use definitions, which the keeper test's fourth
          clause keeps (design/issue-guide.md § UI copy ban list). It sits in
          the header's 340px muted column — the one the intro used to fill
          (design/README.md § Screens › 1) — so it reads under the title at
          phone widths through the header's existing reflow, and nothing
          about the rows changes. Static text: no link, no disclosure, no
          second route into a Module. */}
      <header className="curriculum-header">
        <h1 className="curriculum-title">{s['curriculum.title']}</h1>
        <div className="curriculum-orientation text-muted">
          <p className="curriculum-orientation-line">
            {s['curriculum.orientation.module']}
          </p>
          <p className="curriculum-orientation-line">
            {s['curriculum.orientation.ownIde']}
          </p>
          <p className="curriculum-orientation-line">
            {s['curriculum.orientation.browserOnly']}
          </p>
        </div>
      </header>
      {sections !== null && (
        <>
          {sections.map((section) => (
            <CategorySection
              key={section.category.id}
              section={section}
              answeredModuleIds={answeredModuleIds}
            />
          ))}
          {/* The closing 2px rule after the last row (tokens.json layout.rules). */}
          <div className="curriculum-closing-rule" />
          {/* The backup story (#29): quiet export/import under the rule. */}
          <ProgressBackup />
        </>
      )}
    </>
  );
}

/** One Category and the Modules filed under it, in the order they read. */
interface CategorySectionData {
  readonly category: Category;
  readonly modules: readonly ModuleSummary[];
}

/**
 * The shelves, in Category-ordinal order, each holding its own Modules in
 * Module-ordinal order (#163). Both orders come from ICurriculum — the
 * Categories are sorted and `getModules()` returns Category ordinal then
 * Module ordinal (docs/engineering.md § ICurriculum — behaviour) — so this
 * only ever files each Module under its Category and never re-sorts either.
 *
 * `null` until BOTH reads are in: a heading with no rows under it and rows
 * with no heading over them are each a half-drawn screen.
 *
 * A Category whose Modules are ALL pending still gets its section: pending is
 * a fact about the content pack, never about the reader, and nothing in the
 * Library hides a shelf that has not been written yet (#165 lands exactly
 * that state). A Category with no Modules at all renders nothing — an empty
 * heading is furniture over a void.
 */
function groupIntoSections(
  categories: readonly Category[] | null,
  modules: readonly ModuleSummary[] | null,
): readonly CategorySectionData[] | null {
  if (categories === null || modules === null) return null;
  return categories
    .map((category) => ({
      category,
      modules: modules.filter((module) => module.categoryId === category.id),
    }))
    .filter((section) => section.modules.length > 0);
}

/**
 * One Category heading and its rows. The heading is an `<h2>` — one level
 * under the page `<h1>`, with the Module titles an `<h3>` under it, so the
 * outline a screen reader navigates is the shelf and then its Modules
 * (`src/test/headings.ts`). It carries the Category's one-line description
 * and its language ONCE: every Module in a Category practises the same
 * language (docs/ubiquitous-language.md § Category), so repeating it per row
 * would be five copies of one fact.
 */
function CategorySection({
  section,
  answeredModuleIds,
}: {
  section: CategorySectionData;
  answeredModuleIds: ReadonlySet<ModuleId>;
}) {
  const s = useStrings();
  const { category } = section;

  return (
    <section className="curriculum-category">
      <header className="curriculum-category-header">
        <h2 className="curriculum-category-title">{category.title}</h2>
        <span className="tag tag-neutral curriculum-category-language">
          {s[LANGUAGE_LABEL_KEY[category.language]]}
        </span>
        <p className="text-muted curriculum-category-desc">
          {category.description}
        </p>
      </header>
      {section.modules.map((module) => (
        <ModuleRow
          key={module.id}
          module={module}
          inProgress={answeredModuleIds.has(module.id)}
        />
      ))}
    </section>
  );
}

/**
 * The Modules carrying saved Self-Check answers (IProgress autosave,
 * docs/engineering.md § 2) — the rows that show the outline `In progress`
 * tag.
 *
 * Asked of every Module in the index, without exception (#156): the Library
 * reads the reader's own answers and nothing else, so a browser still
 * holding data from the old model renders exactly what an empty one does.
 */
function useAnsweredModuleIds(
  progress: IProgress,
  modules: readonly ModuleSummary[] | null,
): ReadonlySet<ModuleId> {
  const [answeredIds, setAnsweredIds] = useState<ReadonlySet<ModuleId>>(
    new Set(),
  );

  useEffect(() => {
    if (modules === null) return;
    let cancelled = false;
    Promise.all(
      modules.map(async (module) => ({
        id: module.id,
        answers: await progress.getSelfCheckAnswers(module.id),
      })),
    )
      .then((results) => {
        if (cancelled) return;
        setAnsweredIds(
          new Set(results.filter((r) => r.answers !== null).map((r) => r.id)),
        );
      })
      .catch((error: unknown) => {
        // Nothing read, no tag — the row falls back to `Ready to start`.
        console.error('Failed to read the stored Self-Check answers', error);
      });
    return () => {
      cancelled = true;
    };
  }, [progress, modules]);

  return answeredIds;
}

/**
 * One row, always a link (#156), and still the ONE way into a Module (#163):
 * the Category heading above it is a label, not a second route. There is no
 * inert row state left: nothing in the Library blocks the reader, so the row
 * has no opacity of its own, no `not-allowed` cursor and no icon but the
 * arrow into the Module. Its title is an `<h3>` under the Category's `<h2>` —
 * the level is the outline's, not the 22px type scale's.
 */
function ModuleRow({
  module,
  inProgress,
}: {
  module: ModuleSummary;
  inProgress: boolean;
}) {
  return (
    <Link to={`/modules/${module.id}`} className="curriculum-row">
      <div className="curriculum-row-ordinal">
        {String(module.ordinal).padStart(2, '0')}
      </div>
      <div>
        <h3 className="curriculum-row-title">{module.title}</h3>
        <p className="text-muted curriculum-row-desc">{module.description}</p>
      </div>
      <div className="curriculum-row-status">
        <StatusTag inProgress={inProgress} />
      </div>
      <div className="curriculum-row-icon">
        <ArrowRightIcon />
      </div>
    </Link>
  );
}

/**
 * The row's one tag. Two states, both about the reader's own Self-Check
 * answers and neither a judgement: answers saved, or none yet.
 */
function StatusTag({ inProgress }: { inProgress: boolean }) {
  const s = useStrings();
  if (inProgress) {
    return <span className="tag tag-outline">{s['status.inProgress']}</span>;
  }
  return <span className="tag tag-neutral">{s['status.readyToStart']}</span>;
}

// Icons copied from the design reference (design/DevGym.dc.html § Curriculum).

function ArrowRightIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
