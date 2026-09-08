import { Link, Outlet } from 'react-router-dom';
import { KataMark } from './KataMark';

/**
 * The chrome every screen sits in: the fixed nav with the Kata lockup, then
 * the one scroll area the screens render into.
 *
 * The nav carries the lockup and nothing else. It is a way back to the
 * Curriculum, not a readout: a tally in permanent chrome would measure the
 * reader on every screen, and nothing here measures the reader.
 */
export function AppShell() {
  return (
    <div className="app-shell">
      <header className="nav app-nav">
        <Link to="/" className="nav-brand app-nav-brand">
          <KataMark size={18} />
          Kata
        </Link>
      </header>
      <main className="app-main">
        <div className="app-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
