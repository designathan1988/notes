import type { Database } from '../platform/database.js';
import { DomainError, validateAppearance, type AppearancePreference } from '@note/contracts';

/** Personal presentation is account data, never a workspace-wide mutation. */
export class AppearancePreferences {
  constructor(private readonly db: Database) {}

  async get(userId: string): Promise<AppearancePreference> {
    const [preference] = await this.db.query<AppearancePreference>(
      'SELECT revision,overrides FROM appearance_preferences WHERE user_id=$1',
      [userId],
    );
    return preference ?? { revision: 0, overrides: {} };
  }

  async save(userId: string, revision: unknown, input: unknown): Promise<AppearancePreference> {
    if (!Number.isSafeInteger(revision) || Number(revision) < 0)
      throw new DomainError('INVALID', 'A valid appearance revision is required.');
    const overrides = validateAppearance(input);
    const [saved] =
      Number(revision) === 0
        ? await this.db.query<AppearancePreference>(
            'INSERT INTO appearance_preferences(user_id,revision,overrides) VALUES($1,1,$2) ON CONFLICT(user_id) DO NOTHING RETURNING revision,overrides',
            [userId, JSON.stringify(overrides)],
          )
        : await this.db.query<AppearancePreference>(
            'UPDATE appearance_preferences SET revision=revision+1,overrides=$2 WHERE user_id=$1 AND revision=$3 RETURNING revision,overrides',
            [userId, JSON.stringify(overrides), revision],
          );
    if (saved) return saved;
    throw new DomainError(
      'CONFLICT',
      'Appearance changed in another window. Reload the latest settings before retrying.',
    );
  }
}
