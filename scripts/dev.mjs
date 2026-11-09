import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const commands = [
  [require.resolve('tsx/cli'), 'watch', '--clear-screen=false', 'apps/server/src/main.ts'],
  [join(dirname(require.resolve('vite/package.json')), 'bin/vite.js'), '--host', '127.0.0.1'],
];
// Tools that launch dev servers often export PORT for the web port; the Vite proxy expects the
// API on 3001, so the dev API ignores an inherited PORT (set API_PORT to change it).
const apiEnv = { ...process.env, PORT: process.env.API_PORT ?? '3001' };
const children = commands.map((command, index) =>
  spawn(process.execPath, command, {
    stdio: ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
    env: index === 0 ? apiEnv : process.env,
  }),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    for (const child of children) child.kill(signal);
  });
for (const child of children)
  child.on('exit', (code) => {
    if (code && code !== 0) {
      for (const other of children) if (other !== child) other.kill();
      process.exitCode = code;
    }
  });
