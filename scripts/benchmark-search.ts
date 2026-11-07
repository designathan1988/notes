import { fixture } from '../tests/helpers.js';
import { Knowledge } from '../apps/server/src/knowledge/service.js';
const db = await fixture();
try {
  await db.query(
    `INSERT INTO pages(id,workspace_id,title,created_by) SELECT 'benchmark-'||g,'studio','Research note '||g,'owner' FROM generate_series(1,10000) g`,
  );
  await db.query(
    `INSERT INTO search_projection(page_id,version,body,tokens) SELECT id,1,'Interview evidence on capture, navigation, collaboration and connected knowledge. A useful product starts with clear research and reliable editing.',setweight(to_tsvector('simple',title),'A') || setweight(to_tsvector('simple','Interview evidence on capture, navigation, collaboration and connected knowledge. A useful product starts with clear research and reliable editing.'),'B') FROM pages`,
  );
  await db.query('ANALYZE pages');
  await db.query('ANALYZE search_projection');
  const knowledge = new Knowledge(db);
  const terms = [
    'interview',
    '"reliable editing"',
    'Research note 9876',
    'Reserch note',
    'missing-term-xyz',
  ];
  for (const term of terms) await knowledge.search({ userId: 'owner' }, 'studio', term);
  const measurements = [];
  for (let i = 0; i < 25; i++) {
    const term = terms[i % terms.length];
    const start = performance.now();
    const result = await knowledge.search({ userId: 'owner' }, 'studio', term);
    measurements.push({
      term,
      ms: Number((performance.now() - start).toFixed(2)),
      results: result.results.length,
    });
  }
  const times = measurements.map((item) => item.ms).sort((a, b) => a - b);
  process.stdout.write(
    JSON.stringify(
      {
        engine: 'PGlite 0.5.15; isolated in-memory PostgreSQL WASM; warmed queries; one process',
        pages: 10000,
        queries: 25,
        p50: times[Math.ceil(times.length * 0.5) - 1],
        p95: times[Math.ceil(times.length * 0.95) - 1],
        targetMs: 300,
        measurements,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await db.close();
}
