import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './app/AppShell';
import { CurriculumScreen } from './screens/CurriculumScreen';
import { ModuleScreen } from './screens/ModuleScreen';

/**
 * Routes. Everything renders inside the app shell.
 *
 * Hash routing (see main.tsx) keeps every URL under /Kata/, so a reloaded deep
 * link is always served by index.html and never hits a GitHub Pages 404.
 * Unknown paths fall back to the root route rather than a dead end.
 *
 * The screens land here as they are built: Curriculum at the index route
 * (#10), Module (#11); the Exercise screen (#15) follows — until then an
 * Exercise link falls back to the Curriculum.
 */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<CurriculumScreen />} />
        <Route path="modules/:id" element={<ModuleScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
