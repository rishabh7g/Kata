import { Link, Outlet } from 'react-router-dom';
import { KataMark } from './KataMark';

/**
 * The chrome every screen sits in: the fixed nav with the Kata lockup, then
 * the one scroll area (.app-main) the screens render into
 * (design/README.md § Brand and § Screens; #104).
 *
 * The nav carries the lockup and nothing else (#156). It used to carry a
 * count of the reader beside it, which the Library has no place for: reading
 * is self-paced, nothing is recorded but the reader's own Self-Check answers
 * (docs/ubiquitous-language.md § Library), and a running tally in permanent
 * chrome measures the reader on every screen. The nav is a way back to the
 * Curriculum, not a readout.
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
