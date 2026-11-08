import type { Database } from '../platform/database.js';
import { DomainError } from '@note/contracts';

export async function emailOf(db: Database, userId: string): Promise<string> {
  const [user] = await db.query<{ email: string }>('SELECT email FROM "user" WHERE id=$1', [
    userId,
  ]);
  if (!user) throw new DomainError('UNAUTHENTICATED', 'Sign in to open your workspace.');
  return user.email;
}
