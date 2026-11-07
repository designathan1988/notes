import { afterEach, expect, test } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, migrate } from '../apps/server/src/platform/database.js';
import { createApp } from '../apps/server/src/app.js';
import { validateTitle } from '../packages/contracts/src/index.js';

const paths: string[] = [];
afterEach(async () => { for (const path of paths.splice(0)) await rm(path, { recursive: true, force: true }); });

test('persists rows across a disk-backed PostgreSQL reopen', async () => {
  const path = await mkdtemp(join(tmpdir(), 'note-pg-')); paths.push(path);
  const db = await openDatabase({ directory: path });
  await db.query('CREATE TABLE persistence_probe (title text NOT NULL)');
  await db.query('INSERT INTO persistence_probe VALUES ($1)', ['Studio workspace']);
  await db.close();
  const reopened = await openDatabase({ directory: path });
  expect(await reopened.query('SELECT title FROM persistence_probe')).toEqual([{ title: 'Studio workspace' }]);
  await reopened.close();
});

test('rejects blank, control-character, and oversized page titles', () => {
  expect(() => validateTitle('   ')).toThrow();
  expect(() => validateTitle('A'.repeat(301))).toThrow();
  expect(() => validateTitle('hidden\u0000title')).toThrow();
  expect(validateTitle('  Product direction  ')).toBe('Product direction');
});

test('migrations are repeatable and failed transactions do not leave partial data', async () => {
  const db = await openDatabase();
  await migrate(db); await migrate(db);
  await expect(db.transaction(async tx => {
    await tx.query('INSERT INTO organization (id,name,slug) VALUES ($1,$2,$3)', ['rollback', 'Rollback', 'rollback']);
    throw new Error('Interrupted transaction');
  })).rejects.toThrow('Interrupted');
  expect(await db.query('SELECT id FROM organization WHERE id=$1', ['rollback'])).toEqual([]);
  await db.close();
});

test('health responds only after an actual database connection', async () => {
  const db = await openDatabase(); await migrate(db);
  const app = await createApp({ db });
  const response = await app.inject({ method: 'GET', url: '/api/health' });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({ status: 'ok', storage: 'postgresql' });
  await app.close(); await db.close();
});
