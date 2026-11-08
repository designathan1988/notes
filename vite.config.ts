import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'apps/web',
  plugins: [react()],
  resolve: {
    // Avoid Windows native realpath failures while keeping shared runtimes single-instance.
    preserveSymlinks: process.platform === 'win32',
    dedupe: ['react', 'react-dom', 'yjs'],
  },
  optimizeDeps: { include: ['fflate', 'y-prosemirror'] },
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
