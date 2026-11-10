import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization } from 'better-auth/plugins';
import { randomBytes } from 'node:crypto';
import type { Database } from '../platform/database.js';
import * as schema from './schema.js';
import { FileMail, type MailTransport } from './mail.js';

export function createAuth(
  db: Database,
  options: { secret?: string; origin?: string; mail?: MailTransport } = {},
) {
  const production = process.env.NODE_ENV === 'production';
  if (production && !options.secret) throw new Error('AUTH_SECRET is required in production.');
  const mail = options.mail ?? new FileMail();
  return betterAuth({
    database: drizzleAdapter(db.orm, { provider: 'pg', schema }),
    secret: options.secret ?? randomBytes(48).toString('base64url'),
    baseURL: options.origin ?? 'http://127.0.0.1:5173',
    trustedOrigins: [options.origin ?? 'http://127.0.0.1:5173'],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      requireEmailVerification: production,
    },
    emailVerification: {
      sendOnSignUp: false,
      autoSignInAfterVerification: true,
      async sendVerificationEmail({ user, url }) {
        if (production && !options.mail)
          throw new Error('A production email transport is required.');
        await mail.send({ to: user.email, subject: 'Verify your email for Mosaic', url });
      },
    },
    plugins: [organization()],
    advanced: { useSecureCookies: production },
  });
}
export type Auth = ReturnType<typeof createAuth>;
