import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// docs/engineering.md § 1 Stack: Vite base '/Kata/' — the app is served from
// https://rishabh7g.github.io/Kata/. Every runtime URL is built from
// import.meta.env.BASE_URL, never hard-coded.
export default defineConfig({
  base: '/Kata/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
