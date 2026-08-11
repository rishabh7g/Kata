import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './app/AppShell';

/**
 * Routes. Everything renders inside the app shell.
 *
 * Hash routing (see main.tsx) keeps every URL under /Kata/, so a reloaded deep
 * link is always served by index.html and never hits a GitHub Pages 404.
 * Unknown paths fall back to the root route rather than a dead end.
 *
 * The screens land here as they are built: Curriculum at the index route,
 * then Module and Exercise.
 */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={null} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
