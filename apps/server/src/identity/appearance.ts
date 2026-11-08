import type { FastifyInstance } from 'fastify';
import type { Database } from '../platform/database.js';
import {
  assertObject,
  DomainError,
  validateAppearance,
  type AppearancePreference,
} from '../../../../packages/contracts/src/index.js';

/** Personal presentation is account data, never a workspace-wide mutation. */
export function appearanceRoutes(app: FastifyInstance, db: Database) {
  app.get('/api/preferences/appearance', async (request): Promise<AppearancePreference> => {
    const [preference] = await db.query<AppearancePreference>(
      'SELECT revision,overrides FROM appearance_preferences WHERE user_id=$1',
      [request.actor.userId],
    );
    return preference ?? { revision: 0, overrides: {} };
  });
  app.patch('/api/preferences/appearance', async (request) => {
    assertObject(request.body);
    const { revision } = request.body;
    if (!Number.isSafeInteger(revision) || Number(revision) < 0)
      throw new DomainError('INVALID', 'A valid appearance revision is required.');
    const overrides = validateAppearance(request.body.overrides);
    const [saved] =
      Number(revision) === 0
        ? await db.query<AppearancePreference>(
            'INSERT INTO appearance_preferences(user_id,revision,overrides) VALUES($1,1,$2) ON CONFLICT(user_id) DO NOTHING RETURNING revision,overrides',
            [request.actor.userId, JSON.stringify(overrides)],
          )
        : await db.query<AppearancePreference>(
            'UPDATE appearance_preferences SET revision=revision+1,overrides=$2 WHERE user_id=$1 AND revision=$3 RETURNING revision,overrides',
            [request.actor.userId, JSON.stringify(overrides), revision],
          );
    if (saved) return saved;
    throw new DomainError(
      'CONFLICT',
      'Appearance changed in another window. Reload the latest settings before retrying.',
    );
  });
}
