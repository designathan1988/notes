import { expect, test } from 'vitest';
import { openDatabase, migrate } from '../apps/server/src/platform/database.js';
import { createApp } from '../apps/server/src/app.js';

test('unexpected server errors are logged as structured JSON without credentials', async () => {
  const db = await openDatabase();
  await migrate(db);
  const lines: string[] = [];
  const app = await createApp({
    db,
    logLevel: 'error',
    logStream: { write: (l) => lines.push(l) },
  });
  app.get('/boom', async () => {
    throw new Error('disk exploded');
  });
  try {
    const response = await app.inject({
      method: 'GET',
      url: '/boom',
      headers: { cookie: 'session=secret-token' },
    });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      code: 'INTERNAL',
      message: 'The operation could not be completed.',
    });
    const entries = lines.map((line) => JSON.parse(line));
    const entry = entries.find((e) => e.msg === 'Unhandled request error');
    expect(entry?.err?.message).toBe('disk exploded');
    expect(lines.join('\n')).not.toContain('secret-token');
  } finally {
    await app.close();
    await db.close();
  }
});
