// The browser tests' servers, kept warm between runs.
//
// Starting a server pair (API + Vite) and compiling the app for its first page costs far more
// than most tests, so the servers start once and stay up: every later run reuses them and pays
// only for its tests. Both watch the source, so a reused server always serves the current code.
// They restart by themselves only when what they were started with changes (the Vite config, the
// dev script, the dependencies).
//
//   node scripts/test-servers.mjs           start whatever is not running yet, wait until ready
//   node scripts/test-servers.mjs --fresh   stop, wipe the test data, start again
//   node scripts/test-servers.mjs --stop    stop them (the whole process tree, not just a shell)
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cpus } from 'node:os';

const root = fileURLToPath(new URL('..', import.meta.url));
const state = `${root}.runtime-e2e-servers.json`;

// Kept in step with e2e/servers.ts, which the specs use to find their worker's server.
export const workers = Math.max(
  1,
  Number(process.env.E2E_WORKERS) || Math.min(4, Math.floor(cpus().length / 5)),
);
export function server(index) {
  const web = 5183 + index * 10,
    api = 3101 + index * 10,
    content = 3102 + index * 10;
  return {
    web,
    api,
    content,
    origin: `http://127.0.0.1:${web}`,
    runtime: `.runtime-e2e/${index}`,
    impactLog: `.runtime-e2e-impact-${index}.log`,
  };
}

/** What a running server was started with; when it changes, the server must restart. */
function fingerprint() {
  const hash = createHash('sha1');
  for (const file of ['vite.config.ts', 'scripts/dev.mjs', 'package-lock.json'])
    if (existsSync(root + file)) hash.update(readFileSync(root + file));
  return hash.digest('hex');
}

async function healthy(origin) {
  try {
    const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

/** Every process listening on a port, so even servers left by an older run can be stopped. */
function listeners(ports) {
  if (process.platform !== 'win32') return [];
  const out = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' });
  const pids = new Set();
  for (const line of out.split('\n')) {
    const match = line.match(/:(\d+)\s+\S+\s+LISTENING\s+(\d+)/);
    if (match && ports.includes(Number(match[1]))) pids.add(Number(match[2]));
  }
  return [...pids];
}

function kill(pid) {
  try {
    if (process.platform === 'win32')
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-pid, 'SIGTERM');
  } catch {
    // already gone
  }
}

function readState() {
  try {
    return JSON.parse(readFileSync(state, 'utf8'));
  } catch {
    return { fingerprint: '', pids: {} };
  }
}

export function stop() {
  const saved = readState();
  for (const pid of Object.values(saved.pids)) kill(pid);
  const ports = Array.from({ length: 8 }, (_, index) => {
    const own = server(index);
    return [own.web, own.api, own.content];
  }).flat();
  for (const pid of listeners(ports)) kill(pid);
  rmSync(state, { force: true });
}

function start(index) {
  const own = server(index);
  mkdirSync(`${root}.runtime-e2e`, { recursive: true });
  const log = openSync(`${root}.runtime-e2e/server-${index}.log`, 'w');
  const child = spawn(process.execPath, ['scripts/dev.mjs'], {
    cwd: root,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', log, log],
    env: {
      ...process.env,
      WEB_PORT: String(own.web),
      API_PORT: String(own.api),
      USER_CONTENT_PORT: String(own.content),
      USER_CONTENT_ORIGIN_TEMPLATE: `http://preview-{token}.localhost:${own.content}`,
      APP_ORIGIN: own.origin,
      NOTE_RUNTIME: own.runtime,
      IMPACT_LOG: own.impactLog,
    },
  });
  child.unref();
  return child.pid;
}

/** Starts the servers that are not up, then waits until every one answers. */
export async function ensure({ fresh = false } = {}) {
  const began = Date.now();
  const print = fingerprint();
  let saved = readState();
  if (fresh || (saved.fingerprint && saved.fingerprint !== print)) {
    stop();
    if (fresh) rmSync(`${root}.runtime-e2e`, { recursive: true, force: true });
    saved = { fingerprint: '', pids: {} };
  }
  const started = [];
  const up = await Promise.all(
    Array.from({ length: workers }, (_, index) => healthy(server(index).origin)),
  );
  for (let index = 0; index < workers; index++) {
    if (up[index]) continue;
    const own = server(index);
    // A half-started or crashed pair holds its ports; clear them before starting again.
    for (const pid of listeners([own.web, own.api, own.content])) kill(pid);
    if (saved.pids[index]) kill(saved.pids[index]);
    saved.pids[index] = start(index);
    started.push(index);
  }
  writeFileSync(state, JSON.stringify({ fingerprint: print, pids: saved.pids }, null, 1));
  const deadline = Date.now() + 120000;
  for (const index of started) {
    while (!(await healthy(server(index).origin))) {
      if (Date.now() > deadline)
        throw new Error(`Test server ${index} did not start; see .runtime-e2e/server-${index}.log`);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  // A cold Vite compiles the app on its first page load; do it now, once, for all servers.
  if (started.length)
    await Promise.all(
      started.map((index) => fetch(`${server(index).origin}/src/main.tsx`).catch(() => undefined)),
    );
  return { started, ms: Date.now() - began };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--stop')) {
    stop();
    console.log('test servers stopped');
  } else {
    const { started, ms } = await ensure({ fresh: process.argv.includes('--fresh') });
    console.log(
      started.length
        ? `started test server(s) ${started.join(', ')} in ${(ms / 1000).toFixed(1)}s`
        : `test servers already running (checked in ${ms}ms)`,
    );
  }
}
