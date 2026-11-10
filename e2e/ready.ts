import { expect, request } from '@playwright/test';
import { server, workers } from './servers.js';

// Vite may remain available while the API watcher is restarting shared modules, so every
// worker's API must answer its health check before any spec signs in.
export default async function ready() {
  await Promise.all(
    Array.from({ length: workers }, async (_, index) => {
      const api = await request.newContext({ baseURL: server(index).origin });
      try {
        await expect
          .poll(
            async () => {
              try {
                return (await api.get('/api/health', { timeout: 2000 })).status();
              } catch {
                return 0;
              }
            },
            {
              timeout: 90000,
              message: `Wait for the API health endpoint of test server ${index}`,
            },
          )
          .toBe(200);
      } finally {
        await api.dispose();
      }
    }),
  );
}
