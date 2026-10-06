import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { buildManifest } from './manifest';

// Un seul .env, à la racine du dépôt.
const ROOT_DIR = fileURLToPath(new URL('../..', import.meta.url));

function manifest(apiUrl: string): Plugin {
  return {
    name: 'propulsee:manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: JSON.stringify(buildManifest(apiUrl), null, 2),
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const apiUrl = loadEnv(mode, ROOT_DIR, 'VITE_').VITE_API_URL || 'http://localhost:3000';
  const isDev = mode === 'development';

  return {
    envDir: ROOT_DIR,
    define: { __API_URL__: JSON.stringify(apiUrl) },
    plugins: [react(), manifest(apiUrl)],
    // Worker de pdf.js (import `?worker`) : module ES, comme le reste de l'extension.
    worker: { format: 'es' },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      minify: !isDev,
      sourcemap: isDev ? 'inline' : false,
      // Le polyfill injecterait du code inline, interdit par la CSP des extensions MV3.
      modulePreload: { polyfill: false },
      rollupOptions: {
        input: {
          sidepanel: fileURLToPath(new URL('sidepanel.html', import.meta.url)),
          background: fileURLToPath(new URL('src/background.ts', import.meta.url)),
        },
        // Noms stables : le manifest référence background.js.
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
  };
});
