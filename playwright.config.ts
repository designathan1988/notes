import { defineConfig } from '@playwright/test';
import { current, server, workers } from './e2e/servers.js';

// Browser tests start their own isolated servers, one per worker: separate ports and separate
// data directories, so they never touch the developer's workspace or each other. Spec files are
// spread across the workers; tests inside a file still run in order.
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/ready.ts',
  timeout: 45000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers,
  reporter: [['list'], ['./e2e/impact-reporter.ts']],
  use: {
    // Evaluated in each worker, where TEST_PARALLEL_INDEX picks that worker's server.
    baseURL: current.origin,
    viewport: { width: 1536, height: 1024 },
    trace: 'retain-on-failure',
  },
  webServer: Array.from({ length: workers }, (_, index) => {
    const own = server(index);
    return {
      command: 'node scripts/dev.mjs',
      url: own.origin,
      reuseExistingServer: false,
      timeout: 180000,
      env: {
        WEB_PORT: String(own.web),
        API_PORT: String(own.api),
        USER_CONTENT_PORT: String(own.content),
        USER_CONTENT_ORIGIN_TEMPLATE: `http://preview-{token}.localhost:${own.content}`,
        APP_ORIGIN: own.origin,
        NOTE_RUNTIME: own.runtime,
        IMPACT_LOG: own.impactLog,
      },
    };
  }),
});
