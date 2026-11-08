import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const packages = fileURLToPath(new URL('./packages/', import.meta.url));

export default defineConfig({
  root: 'apps/web',
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
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:3001',
      '/collaboration': { target: 'ws://127.0.0.1:3001', ws: true },
    },
  },
  build: { outDir: '../../dist/web', emptyOutDir: true },
});
