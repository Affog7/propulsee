import { defineConfig } from 'vitest/config';

// Chaque workspace est un projet Vitest (il utilise son propre vite.config.ts s'il en a un).
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
  },
});
