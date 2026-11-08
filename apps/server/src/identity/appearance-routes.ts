import type { FastifyInstance } from 'fastify';
import type { Database } from '../platform/database.js';
import { assertObject } from '@note/contracts';
import { AppearancePreferences } from './appearance-service.js';

export function appearanceRoutes(app: FastifyInstance, db: Database) {
  const preferences = new AppearancePreferences(db);
  app.get('/api/preferences/appearance', (request) => preferences.get(request.actor.userId));
  app.patch('/api/preferences/appearance', (request) => {
    assertObject(request.body);
    return preferences.save(request.actor.userId, request.body.revision, request.body.overrides);
  });
}
