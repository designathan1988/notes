import { test as base, expect, type BrowserContext } from '@playwright/test';

export { expect };
export type { Browser, BrowserContext, Locator, Page } from '@playwright/test';

/**
 * Every spec imports `test` from here. It watches every page any context opens during the test
 * (the specs create their own contexts) and fails the test when the browser reports an uncaught
 * exception or a console error: a page that throws or React that complains is a broken page,
 * even when the element the test looks for still shows up.
 *
 * Network failures a test provokes on purpose (offline, a refused write) are reported by the
 * browser as resource errors; those are the app handling a failure, not the app failing, so they
 * are left out. A test that expects a specific console error declares it with
 * `allowBrowserErrors(/pattern/)`.
 */
const network = [
  /^Failed to load resource/,
  /net::ERR_/,
  /WebSocket connection to .* failed/,
  /WebSocket is closed before the connection is established/,
];
let allowed: RegExp[] = [];
export function allowBrowserErrors(...patterns: RegExp[]) {
  allowed.push(...patterns);
}

export const test = base.extend<{ browserErrors: string[] }>({
  browserErrors: [
    async ({ browser }, use, testInfo) => {
      const errors: string[] = [];
      allowed = [];
      const watch = (context: BrowserContext) => {
        context.on('weberror', (error) => {
          // A test's init script also runs on the blank page a new tab starts on; that is not the app.
          if (error.page()?.url() === 'about:blank') return;
          errors.push(`uncaught: ${error.error().stack ?? error.error().message}`);
        });
        context.on('console', (message) => {
          if (message.type() !== 'error') return;
          const text = message.text();
          if (network.some((pattern) => pattern.test(text))) return;
          const where = message.location();
          errors.push(
            `console.error: ${text}${where.url ? `\n    at ${where.url}:${where.lineNumber}` : ''}`,
          );
        });
      };
      const newContext = browser.newContext.bind(browser);
      browser.newContext = async (options) => {
        const context = await newContext(options);
        watch(context);
        return context;
      };
      for (const context of browser.contexts()) watch(context);
      try {
        await use(errors);
      } finally {
        browser.newContext = newContext;
      }
      const unexpected = errors.filter((error) => !allowed.some((pattern) => pattern.test(error)));
      if (unexpected.length && testInfo.status === testInfo.expectedStatus)
        throw new Error(
          `The browser reported ${unexpected.length} error(s) during this test:\n\n` +
            unexpected.slice(0, 10).join('\n\n'),
        );
      if (unexpected.length)
        await testInfo.attach('browser errors', { body: unexpected.join('\n\n') });
    },
    { auto: true },
  ],
});
