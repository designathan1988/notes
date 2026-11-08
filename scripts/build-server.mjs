import { build } from 'esbuild';

// Bundle workspace packages (@note/*, TypeScript source) into the server; keep npm dependencies external.
await build({
  entryPoints: ['apps/server/src/main.ts'],
  outfile: 'dist/server/main.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  plugins: [
    {
      name: 'external-npm-dependencies',
      setup(build) {
        build.onResolve({ filter: /^[^./]/ }, (args) =>
          args.path.startsWith('@note/') ? undefined : { path: args.path, external: true },
        );
      },
    },
  ],
});
