import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '../app/ArrowRightIcon';
import { ordinalLabel } from '../app/ordinalLabel';
import { useCategories } from '../app/useCategories';
import { useCurriculum } from '../app/CurriculumContext';
import { useProgress } from '../app/ProgressContext';
import { useDocumentTitle } from '../app/useDocumentTitle';
import { useModuleSummaries } from '../app/useModuleSummaries';
import type { Category, ModuleId, ModuleSummary } from '../curriculum';
import type { IProgress } from '../progress';
import { copy } from '../strings/copy';

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

  return (
    <>
      <header className="curriculum-header">
        <h1 className="curriculum-title">{copy.curriculum.title}</h1>
        <p className="curriculum-orientation text-muted">
          {copy.curriculum.orientation}
        </p>
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
 * A Category with no Modules renders nothing — an empty heading is furniture
 * over a void.
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
  const { category } = section;

  return (
    <section className="curriculum-category">
      <header className="curriculum-category-header">
        <h2 className="curriculum-category-title">{category.title}</h2>
        <span className="tag tag-neutral curriculum-category-language">
          {copy.language[category.language]}
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
      <div className="curriculum-row-ordinal">{ordinalLabel(module.ordinal)}</div>
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
 * The row's one tag, and only when there is something to say: a Module the
 * reader has answered anything in. No answers is not a state — every row on a
 * fresh install would carry the same word, which is the shelf saying nothing
 * eleven times.
 */
function StatusTag({ inProgress }: { inProgress: boolean }) {
  if (!inProgress) return null;
  return <span className="tag tag-outline">{copy.status.inProgress}</span>;
}
