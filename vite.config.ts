import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { serviceWorkerPlugin } from './src/pwa/service-worker-plugin.ts';

// docs/engineering.md § 1 Stack: Vite base '/Kata/' — the app is served from
// https://rishabh7g.github.io/Kata/. Every runtime URL is built from
// import.meta.env.BASE_URL, never hard-coded.
export default defineConfig({
  base: '/Kata/',
  // serviceWorkerPlugin emits sw.js from src/pwa/sw.js, with the built shell's
  // URLs precached — production builds only, so dev never installs a worker.
  plugins: [react(), serviceWorkerPlugin()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // scripts/ carries the check-script tests (scripts/README.md).
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
});
