import { execFileSync } from 'node:child_process';

// The test servers stay warm between runs (scripts/test-servers.mjs): this starts only the ones
// that are not up yet and returns once every worker's server answers its health check.
export default function ready() {
  execFileSync(process.execPath, ['scripts/test-servers.mjs'], { stdio: 'inherit' });
}
