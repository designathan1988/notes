import { cpus } from 'node:os';

/**
 * Browser tests run in parallel, one isolated server per worker: its own ports, its own data
 * directory and its own impact log. A worker always talks to the server with its parallel index,
 * so specs keep the same isolation they had when the suite ran in one process.
 */
export const workers = Math.max(
  1,
  Number(process.env.E2E_WORKERS) || Math.min(4, Math.floor(cpus().length / 5)),
);

export function server(index: number) {
  const web = 5183 + index * 10,
    api = 3101 + index * 10,
    content = 3102 + index * 10;
  return {
    web,
    api,
    content,
    origin: `http://127.0.0.1:${web}`,
    collaboration: `ws://127.0.0.1:${api}/collaboration`,
    runtime: `.runtime-e2e/${index}`,
    impactLog: `.runtime-e2e-impact-${index}.log`,
  };
}

/** The server of the worker this code runs in (index 0 outside a worker). */
export const current = server(Number(process.env.TEST_PARALLEL_INDEX ?? 0));
