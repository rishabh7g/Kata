import { startKata } from './app/bootstrap';
import { registerServiceWorker } from './pwa/register';

// base.css is the design system: tokens, type scale, and the components the
// prototype shipped. app.css adds the app-layer layout on top.
import './styles/base.css';
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
