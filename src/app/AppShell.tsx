import { Link, Outlet } from 'react-router-dom';
import { KataMark } from './KataMark';
import { useCurriculum } from './CurriculumContext';
import { useModuleSummaries } from './useModuleSummaries';

/**
 * The chrome every screen sits in: the sticky nav with the Kata lockup and the
 * Checkpoint count, then the container the screens render into
 * (design/README.md § Brand and § Screens).
 *
 * The count comes from `ICurriculum.getModules()`: Checkpoints recorded over
 * Modules in the index — both counted, never hard-coded, and never a
 * percentage (docs/engineering.md § 2). It is live (#18): ICurriculum reads
 * IProgress's Checkpoints on every call, and useModuleSummaries re-reads on
 * every navigation, so passing an Exit Gate moves the count on return.
 */
export function AppShell() {
  const modules = useModuleSummaries(useCurriculum());
  const passed = modules?.filter((m) => m.checkpointAt !== null).length;

  return (
    <div className="app-shell">
      <header className="nav app-nav">
        <Link to="/" className="nav-brand app-nav-brand">
          <KataMark size={18} />
          Kata
        </Link>
        <span className="text-muted app-nav-checkpoints">
          {modules !== null && `Checkpoints ${passed} / ${modules.length}`}
        </span>
      </header>
      <main className="app-main">
        <div className="app-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
