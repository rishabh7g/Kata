import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '../app/ArrowRightIcon';
import { ordinalLabel } from '../app/ordinalLabel';
import { useAsyncValue } from '../app/useAsyncValue';
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
 * Modules in order, every row a link.
 *
 * The order is a suggested reading order and nothing else; no Module waits on
 * another. A Category is a heading over rows, never a route: the only way
 * into a Module is its own row.
 */
export function CurriculumScreen() {
  const curriculum = useCurriculum();
  const modules = useModuleSummaries(curriculum);
  const sections = groupIntoSections(useCategories(curriculum), modules);
  const answeredModuleIds = useAnsweredModuleIds(useProgress(), modules);
  // The home screen is the app itself: the tab reads plain `Kata`.
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
 * Files each Module under its Category. Both orders arrive sorted from
 * ICurriculum, so nothing here re-sorts.
 *
 * `null` until both reads are in — a heading with no rows, or rows with no
 * heading, is a half-drawn screen. A Category with no Modules renders
 * nothing: an empty heading is furniture over a void.
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
 * One Category heading and its rows. The `h2` over `h3` titles is the outline
 * a screen reader walks: the shelf, then its Modules. The language is named
 * once here rather than on every row — every Module in a Category practises
 * the same one.
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

const NO_ANSWERED_IDS: ReadonlySet<ModuleId> = new Set();

/**
 * The Modules carrying saved Self-Check answers — the rows that show a tag.
 * Empty until the read is in, and empty when it fails: nothing read, no tag,
 * and every row still links.
 */
function useAnsweredModuleIds(
  progress: IProgress,
  modules: readonly ModuleSummary[] | null,
): ReadonlySet<ModuleId> {
  const answeredIds = useAsyncValue(
    () => readAnsweredModuleIds(progress, modules),
    [progress, modules],
    'Failed to read the stored Self-Check answers',
  );
  return answeredIds ?? NO_ANSWERED_IDS;
}

/** The ids of the Modules IProgress holds a record for — none until the index is here. */
async function readAnsweredModuleIds(
  progress: IProgress,
  modules: readonly ModuleSummary[] | null,
): Promise<ReadonlySet<ModuleId>> {
  if (modules === null) return NO_ANSWERED_IDS;
  const answered = await Promise.all(
    modules.map((module) => answeredModuleId(progress, module.id)),
  );
  return new Set(answered.filter((id) => id !== null));
}

/** The Module's id when IProgress holds a record for it, `null` otherwise. */
async function answeredModuleId(
  progress: IProgress,
  id: ModuleId,
): Promise<ModuleId | null> {
  const record = await progress.getSelfCheckAnswers(id);
  return record === null ? null : id;
}

/**
 * One row, always a link: nothing blocks the reader, so there is no inert
 * state, no disabled cursor and no icon but the arrow into the Module.
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
 * The row's one tag, and only when there is something to say. No answers is
 * not a state: on a fresh install it would be the same word on every row.
 */
function StatusTag({ inProgress }: { inProgress: boolean }) {
  if (!inProgress) return null;
  return <span className="tag tag-outline">{copy.status.inProgress}</span>;
}
