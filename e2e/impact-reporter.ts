import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { server, workers } from './servers.js';

/**
 * Test impact analysis. Each worker's dev server logs every module and API request with a
 * timestamp (see vite.config.ts); this reporter knows when each spec ran and on which worker.
 * Joining a worker's log with that worker's time windows gives, per spec, the exact source
 * files and API routes it exercises. `scripts/check.mjs` reads the map to run only the specs a
 * change can affect, instead of the whole suite.
 */
export const impactMap = resolve('e2e/impact-map.json');
const logs = Array.from({ length: workers }, (_, index) => resolve(server(index).impactLog));
type Entry = { ms: number; files: string[]; api: string[] };
type Window = { spec: string; worker: number; start: number; end: number; ok: boolean };

export default class ImpactReporter implements Reporter {
  private windows: Window[] = [];
  onBegin() {
    for (const log of logs) rmSync(log, { force: true });
  }
  onTestEnd(test: TestCase, result: TestResult) {
    const start = result.startTime.getTime();
    this.windows.push({
      spec: relative(process.cwd(), test.location.file).replaceAll('\\', '/'),
      worker: result.parallelIndex,
      start,
      end: start + result.duration,
      ok: result.status === 'passed',
    });
  }
  onEnd() {
    const root = process.cwd().replaceAll('\\', '/');
    const seen = new Map<
      string,
      { ms: number; files: Set<string>; api: Set<string>; ok: boolean }
    >();
    for (const window of this.windows) {
      const entry = seen.get(window.spec) ?? {
        ms: 0,
        files: new Set<string>(),
        api: new Set<string>(),
        ok: true,
      };
      entry.ms += window.end - window.start;
      entry.ok &&= window.ok;
      seen.set(window.spec, entry);
    }
    logs.forEach((log, worker) => {
      if (!existsSync(log)) return;
      const own = this.windows.filter((item) => item.worker === worker);
      for (const line of readFileSync(log, 'utf8').split('\n')) {
        const [time, method, url] = line.split('\t');
        if (!url) continue;
        const at = Number(time);
        const window = own.find((item) => at >= item.start - 50 && at <= item.end + 50);
        if (!window) continue;
        const entry = seen.get(window.spec)!;
        const path = decodeURIComponent(url.split('?')[0]!);
        if (path.startsWith('/api/')) entry.api.add(`${method} ${path}`);
        else if (path.startsWith('/src/')) entry.files.add(`apps/web${path}`);
        else if (path.startsWith('/@fs/')) {
          const file = path.slice(5).replace(/^\/?/, '');
          const local = file.toLowerCase().startsWith(root.toLowerCase())
            ? file.slice(root.length + 1)
            : null;
          if (local && !local.startsWith('node_modules/')) entry.files.add(local);
        }
      }
      rmSync(log, { force: true });
    });
    // Merge: a spec's record is replaced only when it ran and passed.
    const map: Record<string, Entry> = existsSync(impactMap)
      ? (JSON.parse(readFileSync(impactMap, 'utf8')) as Record<string, Entry>)
      : {};
    for (const [spec, entry] of seen)
      if (entry.ok && entry.files.size)
        map[spec] = { ms: entry.ms, files: [...entry.files].sort(), api: [...entry.api].sort() };
    writeFileSync(
      impactMap,
      JSON.stringify(Object.fromEntries(Object.entries(map).sort()), null, 1) + '\n',
    );
  }
}
