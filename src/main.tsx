import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';

// design/styles.css is the app stylesheet — the single source of styling truth
// (docs/engineering.md § 1). app.css only adds the app-layer layout on top.
import '../design/styles.css';
import './styles/app.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Root element #root is missing from index.html');
}

createRoot(container).render(
  <StrictMode>
    {/* Hash routing: GitHub Pages serves static files only, so a reloaded
        deep link has to resolve to /Kata/index.html. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
