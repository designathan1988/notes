import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const packages = fileURLToPath(new URL('./packages/', import.meta.url));
const webPort = Number(process.env.WEB_PORT ?? 5173);
const api = `127.0.0.1:${process.env.API_PORT ?? 3001}`;

export default defineConfig({
  root: 'apps/web',
  // A second dev server (the isolated browser-test instance) keeps its own optimizer cache.
  cacheDir: webPort === 5173 ? undefined : `../../node_modules/.vite-${webPort}`,
  plugins: [react()],
  resolve: {
    // Workspace packages are TypeScript source. Resolve them to packages/ directly so Vite treats
    // them as application code: its dependency scanner then sees their imports up front instead
    // of discovering them at runtime (which re-optimizes and can load a second ProseMirror/Yjs).
    alias: [
      { find: /^@note\/contracts$/, replacement: `${packages}contracts/src/index.ts` },
      { find: /^@note\/(contracts|editor|data)\/(.+)$/, replacement: `${packages}$1/src/$2.ts` },
    ],
    // Avoid Windows native realpath failures while keeping shared runtimes single-instance.
    preserveSymlinks: process.platform === 'win32',
    dedupe: ['react', 'react-dom', 'yjs'],
  },
  // d3-force is only imported by the graph layout worker, which the dependency scanner skips.
  optimizeDeps: { include: ['fflate', 'y-prosemirror', 'd3-force'] },
  server: {
    port: webPort,
    strictPort: true,
    proxy: {
      '/api': `http://${api}`,
      '/collaboration': { target: `ws://${api}`, ws: true },
    },
  },
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // The source editor is already loaded on demand. Keep its reusable runtime
        // and language grammars in separate cacheable chunks instead of one 530 kB file.
        manualChunks(id) {
          const module = id.replaceAll('\\', '/');
          if (!module.includes('/node_modules/')) return;
          // React changes less often than workspace code and locale catalogs.
          // Cache its single shared runtime independently of the application entry.
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(module)) return 'ui-runtime';
          for (const language of ['html', 'css', 'javascript']) {
            if (
              module.includes(`/@codemirror/lang-${language}/`) ||
              module.includes(`/@lezer/${language}/`)
            )
              return `source-${language}`;
          }
          if (module.includes('/@codemirror/') || module.includes('/@lezer/'))
            return 'source-runtime';
        },
      },
    },
  },
});
