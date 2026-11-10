import { defineConfig } from '@playwright/test';
import { current, workers } from './e2e/servers.js';

// Browser tests use their own isolated servers, one per worker: separate ports and separate data
// directories, so they never touch the developer's workspace or each other. The servers stay warm
// between runs (scripts/test-servers.mjs, started from e2e/ready.ts), so a run pays only for its
// tests. Spec files are spread across the workers; tests inside a file still run in order.
//
// Timeouts are short on purpose: the app answers in milliseconds, so an element that has not
// appeared within a few seconds is missing, and the test should say so then, not a minute later.
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/ready.ts',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  workers,
  reporter: [['list'], ['./e2e/impact-reporter.ts']],
  use: {
    // Evaluated in each worker, where TEST_PARALLEL_INDEX picks that worker's server.
    baseURL: current.origin,
    viewport: { width: 1536, height: 1024 },
    actionTimeout: 5000,
    navigationTimeout: 15000,
    trace: 'retain-on-failure',
  },
});
