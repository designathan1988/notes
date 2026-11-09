/** Browser tests run against their own server and data directory, never the developer's. */
export const APP_ORIGIN = process.env.E2E_ORIGIN ?? 'http://127.0.0.1:5183';
export const COLLABORATION_URL =
  process.env.E2E_COLLABORATION ?? 'ws://127.0.0.1:3101/collaboration';
