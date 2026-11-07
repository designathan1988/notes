import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'apps/web',
  plugins: [react()],
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
