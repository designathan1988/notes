import { expect, request } from '@playwright/test';

// Vite may remain available while the API watcher is restarting shared modules.
export default async function ready() {
  const api = await request.newContext({ baseURL: 'http://127.0.0.1:5173' });
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
        { timeout: 60000, message: 'Wait for the real API health endpoint before signing in' },
      )
      .toBe(200);
  } finally {
    await api.dispose();
  }
}
