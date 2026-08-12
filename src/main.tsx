import { startKata } from './app/bootstrap';
import { registerServiceWorker } from './pwa/register';

// design/styles.css is the app stylesheet — the single source of styling truth
// (docs/engineering.md § 1). app.css only adds the app-layer layout on top.
import '../design/styles.css';
import './styles/app.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Root element #root is missing from index.html');
}

// Everything the browser entry does is in startKata (src/app/bootstrap.tsx),
// which renders either the app or, if IndexedDB will not open, the message
// that explains why (#68). Nothing here is left to reject unhandled.
void startKata(container, import.meta.env.BASE_URL);

// Only a production build emits sw.js (src/pwa/service-worker-plugin.ts), and a
// worker left over from a dev session would only serve stale files.
if (import.meta.env.PROD) {
  registerServiceWorker();
}
