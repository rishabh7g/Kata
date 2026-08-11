import { Link, Outlet } from 'react-router-dom';
import { KataMark } from './KataMark';

/**
 * The chrome every screen sits in: the sticky nav with the Kata lockup and the
 * Checkpoint count, then the container the screens render into
 * (design/README.md § Brand and § Screens).
 *
 * The count is static `0 / 5` until #18 wires it to
 * `IProgress.listCheckpoints()`; the denominator is then the number of Modules
 * in the index — counted, never hard-coded (docs/engineering.md § 2).
 */
export function AppShell() {
  return (
    <div className="app-shell">
      <header className="nav app-nav">
        <Link to="/" className="nav-brand app-nav-brand">
          <KataMark size={18} />
          Kata
        </Link>
        <span className="text-muted app-nav-checkpoints">Checkpoints 0 / 5</span>
      </header>
      <main className="app-main">
        <div className="app-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
