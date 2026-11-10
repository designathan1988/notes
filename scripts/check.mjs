// Impact-based check: verify what a change can affect instead of everything, every time.
//
//   node scripts/check.mjs            changed files since HEAD (staged, unstaged, untracked)
//   node scripts/check.mjs --since X  changed files since commit/branch X
//   node scripts/check.mjs --full     everything (CI, or to refresh e2e/impact-map.json)
//   node scripts/check.mjs --budget N seconds of browser tests to run (default 90)
//
// Types are checked incrementally, lint and format only on changed files, unit tests only where
// the module graph reaches a changed file, and browser specs only where the recorded impact
// map (e2e/impact-map.json, written by e2e/impact-reporter.ts) says the spec loads a changed
// file or calls a route declared next to one. Affected specs that do not fit the time budget
// are listed, never silently skipped.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const full = flag('--full');
const since = option('--since', 'HEAD');
const budget = Number(option('--budget', '90')) * 1000;
const started = Date.now();

const git = (...parameters) =>
  spawnSync('git', parameters, { encoding: 'utf8' })
    .stdout.split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
const changed = full
  ? []
  : [
      ...new Set([
        ...git('diff', '--name-only', since),
        ...git('ls-files', '--others', '--exclude-standard'),
      ]),
    ].filter((file) => existsSync(file));

const node = process.execPath;
const bin = (name) => join('node_modules', name);
const failures = [];
function run(label, script, parameters) {
  const at = Date.now();
  const result = spawnSync(node, [bin(script), ...parameters], { stdio: 'inherit' });
  const seconds = ((Date.now() - at) / 1000).toFixed(1);
  console.log(`${result.status === 0 ? 'ok  ' : 'FAIL'} ${label} (${seconds}s)`);
  if (result.status !== 0) failures.push(label);
}

if (!full && !changed.length) {
  console.log('Nothing changed since ' + since + '. Use --full to verify everything.');
  process.exit(0);
}
if (!full) console.log(`${changed.length} changed file(s) since ${since}`);

const code = changed.filter((file) => /\.(ts|tsx|mjs|cjs|js)$/.test(file));
const formatted = changed.filter((file) =>
  /^(apps|packages|tests|e2e)\/.*\.(ts|tsx)$|^eslint\.config\.mjs$/.test(file),
);

// 1. Types: incremental, so only files reached by the change are re-checked.
if (full || code.length)
  run('types', 'typescript/bin/tsc', [
    '--noEmit',
    '--incremental',
    '--tsBuildInfoFile',
    'node_modules/.cache/check.tsbuildinfo',
  ]);

// 2. Lint and format: only the files that changed.
if (full) {
  run('lint', 'eslint/bin/eslint.js', [
    '.',
    '--cache',
    '--cache-location',
    'node_modules/.cache/eslint',
  ]);
  run('format', 'prettier/bin/prettier.cjs', [
    '--check',
    'apps/**/*.{ts,tsx}',
    'packages/**/*.ts',
    'tests/**/*.ts',
    'e2e/**/*.ts',
    'eslint.config.mjs',
  ]);
} else {
  if (code.length) run('lint', 'eslint/bin/eslint.js', code);
  if (formatted.length) run('format', 'prettier/bin/prettier.cjs', ['--check', ...formatted]);
}

// 3. Unit tests: only those whose imports reach a changed file.
const unit = changed.filter((file) => /^(apps|packages|tests)\/.*\.(ts|tsx)$/.test(file));
if (full) run('unit tests', 'vitest/vitest.mjs', ['run']);
else if (unit.length)
  run('unit tests', 'vitest/vitest.mjs', ['related', ...unit, '--run', '--passWithNoTests']);

// 4. Browser specs: only those the impact map ties to a changed file.
const mapFile = 'e2e/impact-map.json';
const map = existsSync(mapFile) ? JSON.parse(readFileSync(mapFile, 'utf8')) : {};
const allSpecs = readdirSync('e2e')
  .filter((name) => name.endsWith('.spec.ts'))
  .map((name) => `e2e/${name}`);

/** Routes declared in the same server folder as a changed file, as matchers for recorded calls. */
function routesNear(file) {
  const folder = dirname(file);
  const patterns = [];
  for (const name of readdirSync(folder)) {
    if (!name.endsWith('.ts')) continue;
    for (const match of readFileSync(join(folder, name), 'utf8').matchAll(
      /['"`](\/api\/[^'"`\s]+)['"`]/g,
    ))
      patterns.push(
        new RegExp('^\\w+ ' + match[1].replace(/:[A-Za-z]+/g, '[^/]+').replace(/\*/g, '.*') + '$'),
      );
  }
  return patterns;
}
function affectedSpecs() {
  const hit = new Map();
  const add = (spec, reason) => hit.set(spec, hit.get(spec) ?? reason);
  for (const file of changed) {
    if (/^e2e\/.*\.spec\.ts$/.test(file)) add(file, 'spec changed');
    else if (
      /^e2e\/|^playwright\.config|^vite\.config|^package(-lock)?\.json$|^scripts\/dev\.mjs$/.test(
        file,
      )
    )
      for (const spec of allSpecs) add(spec, `${file} affects every spec`);
    else if (/^apps\/web\/|^packages\//.test(file)) {
      for (const [spec, entry] of Object.entries(map))
        if (entry.files.includes(file)) add(spec, `loads ${file}`);
      // A new source file is unknown to the map: specs loading its folder are the best evidence.
      if (!Object.values(map).some((entry) => entry.files.includes(file)))
        for (const [spec, entry] of Object.entries(map))
          if (entry.files.some((known) => dirname(known) === dirname(file)))
            add(spec, `loads files beside new ${file}`);
    }
    if (/^apps\/server\//.test(file) || /^packages\//.test(file)) {
      const patterns = /^apps\/server\/src\/[^/]+\//.test(file) ? routesNear(file) : [];
      for (const [spec, entry] of Object.entries(map))
        if (!patterns.length || entry.api.some((call) => patterns.some((p) => p.test(call))))
          add(spec, patterns.length ? `calls routes beside ${file}` : `${file} affects the server`);
    }
  }
  // Specs never recorded cannot be ruled out.
  if (hit.size) for (const spec of allSpecs) if (!map[spec]) add(spec, 'not in the impact map yet');
  return hit;
}

const clean = () => rmSync('.runtime-e2e', { recursive: true, force: true });
if (full) {
  clean();
  run('browser specs (all)', '@playwright/test/cli.js', ['test']);
} else {
  const hit = affectedSpecs();
  if (!hit.size) console.log('ok   browser specs: no spec is affected by this change');
  else {
    // The narrowest specs first: the fewer files a spec loads, the more it is about the change.
    const ordered = [...hit.keys()].sort(
      (a, b) => (map[a]?.files.length ?? 0) - (map[b]?.files.length ?? 0),
    );
    const chosen = [];
    let spent = 0;
    for (const spec of ordered) {
      const cost = map[spec]?.ms ?? 15000;
      if (chosen.length && spent + cost > budget) continue;
      chosen.push(spec);
      spent += cost;
    }
    const skipped = ordered.filter((spec) => !chosen.includes(spec));
    console.log(`${hit.size} affected spec(s); running ${chosen.length} within ${budget / 1000}s`);
    clean();
    run(`browser specs (${chosen.length})`, '@playwright/test/cli.js', ['test', ...chosen]);
    if (skipped.length) {
      console.log(
        `NOT RUN (over the ${budget / 1000}s budget), still affected: ${skipped.length} spec(s)`,
      );
      for (const spec of skipped) console.log(`  ${spec}  (${hit.get(spec)})`);
      console.log('Run them with: node scripts/check.mjs --budget 600   or   --full');
    }
  }
}

const total = ((Date.now() - started) / 1000).toFixed(1);
if (failures.length) {
  console.log(`\nFAILED: ${failures.join(', ')} (${total}s)`);
  process.exit(1);
}
console.log(`\nAll checks passed (${total}s)`);
