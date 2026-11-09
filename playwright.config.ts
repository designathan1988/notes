import { defineConfig } from '@playwright/test';

// Browser tests start their own isolated server: separate ports and a separate data directory,
// so they never create, delete or revoke pages in the developer's workspace.
const web = 5183,
  api = 3101,
  content = 3102;
const origin = `http://127.0.0.1:${web}`;
process.env.E2E_ORIGIN = origin;
process.env.E2E_COLLABORATION = `ws://127.0.0.1:${api}/collaboration`;

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/ready.ts',
  timeout: 45000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: origin,
    viewport: { width: 1536, height: 1024 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/dev.mjs',
    url: origin,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      WEB_PORT: String(web),
      API_PORT: String(api),
      USER_CONTENT_PORT: String(content),
      USER_CONTENT_ORIGIN_TEMPLATE: `http://preview-{token}.localhost:${content}`,
      APP_ORIGIN: origin,
      NOTE_RUNTIME: '.runtime-e2e',
    },
  },
});
