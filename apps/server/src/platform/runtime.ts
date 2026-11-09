import { resolve } from 'node:path';

/** Local data directory (embedded PostgreSQL, attachments, mail, secret). NOTE_RUNTIME isolates test servers. */
export const runtimeDir = resolve(process.env.NOTE_RUNTIME ?? '.runtime');
export const runtimePath = (...parts: string[]) => resolve(runtimeDir, ...parts);
