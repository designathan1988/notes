import { createHash, randomBytes } from 'node:crypto';
import { getDomain } from 'tldts';
import type { Database } from '../platform/database.js';
import type { Storage } from '../attachments/storage.js';
import { Attachments } from '../attachments/service.js';
import { Access } from '../access/service.js';
import { Documents } from '../documents/service.js';
import { documentJSON, validateDocument } from '../../../../packages/editor/src/schema.js';
import {
  sourceFingerprint,
  webSource,
  type WebSource,
} from '../../../../packages/editor/src/web.js';
import { DomainError, type Actor } from '../../../../packages/contracts/src/index.js';

interface PreviewRow {
  id: string;
  user_id: string;
  page_id: string;
  generation: number;
  source: WebSource;
  expires_at: Date | string;
}
export interface PreviewTicket {
  token: string;
  url: string;
  expiresAt: string;
}
export interface PreviewConfiguration {
  appOrigin: string;
  originTemplate: string;
}
export function previewConfiguration(): PreviewConfiguration {
  if (process.env.NODE_ENV === 'production' && !process.env.USER_CONTENT_ORIGIN_TEMPLATE)
    throw new Error('Production website previews require a separate USER_CONTENT_ORIGIN_TEMPLATE.');
  return {
    appOrigin: process.env.APP_ORIGIN ?? 'http://127.0.0.1:5173',
    originTemplate:
      process.env.USER_CONTENT_ORIGIN_TEMPLATE ?? 'http://preview-{token}.localhost:3002',
  };
}
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const lifetime = 15 * 60 * 1000;

/** Disposable render revisions. Editable source belongs exclusively to Documents. */
export class WebPreviews {
  readonly configuration: PreviewConfiguration;
  private readonly hostPrefix: string;
  private readonly hostSuffix: string;
  constructor(
    readonly db: Database,
    readonly storage: Storage,
    configuration = previewConfiguration(),
  ) {
    this.configuration = configuration;
    if (configuration.originTemplate.split('{token}').length !== 2)
      throw new Error('The user-content origin must contain one {token} host placeholder.');
    const app = new URL(configuration.appOrigin),
      first = new URL(configuration.originTemplate.replace('{token}', 'a'.repeat(40))),
      second = new URL(configuration.originTemplate.replace('{token}', 'b'.repeat(40)));
    if (
      !['http:', 'https:'].includes(first.protocol) ||
      first.username ||
      first.password ||
      first.pathname !== '/' ||
      first.search ||
      first.hash ||
      first.host === second.host
    )
      throw new Error('Use a distinct user-content origin with a token in its hostname.');
    const appDomain = getDomain(app.hostname, { allowPrivateDomains: true }),
      contentDomain = getDomain(first.hostname, { allowPrivateDomains: true });
    if (
      app.hostname === first.hostname ||
      (appDomain && contentDomain && appDomain === contentDomain) ||
      first.hostname.endsWith('.' + app.hostname) ||
      app.hostname.endsWith('.' + first.hostname)
    )
      throw new Error('User-authored scripts must use a different site from the application.');
    const marker = 'a'.repeat(40),
      index = first.host.indexOf(marker);
    if (index < 0) throw new Error('The preview token must identify its hostname.');
    this.hostPrefix = first.host.slice(0, index);
    this.hostSuffix = first.host.slice(index + marker.length);
  }
  tokenFromHost(host: string | undefined) {
    if (!host || !host.startsWith(this.hostPrefix) || !host.endsWith(this.hostSuffix)) return null;
    const token = host.slice(
      this.hostPrefix.length,
      this.hostSuffix ? -this.hostSuffix.length : undefined,
    );
    return /^[a-f0-9]{40}$/.test(token) ? token : null;
  }
  async create(
    actor: Actor,
    pageId: string,
    input: { position: number; fingerprint: string },
  ): Promise<PreviewTicket> {
    if (
      !Number.isSafeInteger(input.position) ||
      input.position < 0 ||
      !/^[a-f0-9]{64}$/.test(input.fingerprint)
    )
      throw new DomainError('INVALID', 'Choose a saved web source to preview.');
    const page = await new Access(this.db).requirePage(actor, pageId, 'read'),
      document = await new Documents(this.db).load(page.id);
    let source: WebSource;
    try {
      const root = validateDocument(documentJSON(document), page.kind),
        node = root.nodeAt(input.position);
      if (!node || !['webPage', 'webComponent'].includes(node.type.name))
        throw new DomainError('NOT_FOUND', 'The web source was removed or moved.');
      source = webSource(node.toJSON());
      if ((await sourceFingerprint(source)) !== input.fingerprint)
        throw new DomainError(
          'CONFLICT',
          'The source is still saving or changed. Run the current saved source again.',
        );
    } finally {
      document.destroy();
    }
    const token = randomBytes(20).toString('hex'),
      expiresAt = new Date(Date.now() + lifetime).toISOString();
    await this.db.transaction(async (tx) => {
      await tx.query('DELETE FROM web_previews WHERE expires_at<now()');
      const [{ count }] = await tx.query<{ count: number }>(
        'SELECT count(*)::integer AS count FROM web_previews WHERE user_id=$1',
        [actor.userId],
      );
      if (count >= 128)
        throw new DomainError('LIMIT', 'Close older website previews before starting another.');
      await tx.query(
        'INSERT INTO web_previews(id,user_id,page_id,generation,source,expires_at) VALUES($1,$2,$3,$4,$5,$6)',
        [
          tokenHash(token),
          actor.userId,
          page.id,
          page.generation,
          JSON.stringify(source),
          expiresAt,
        ],
      );
    });
    return {
      token,
      url: this.configuration.originTemplate.replace('{token}', token) + '/',
      expiresAt,
    };
  }
  private async row(token: string): Promise<PreviewRow> {
    if (!/^[a-f0-9]{40}$/.test(token))
      throw new DomainError('NOT_FOUND', 'This website preview is unavailable.');
    const [row] = await this.db.query<PreviewRow>(
      'SELECT * FROM web_previews WHERE id=$1 AND expires_at>now()',
      [tokenHash(token)],
    );
    if (!row) throw new DomainError('NOT_FOUND', 'This website preview expired or stopped.');
    const page = await new Access(this.db).requirePage(
      { userId: row.user_id },
      row.page_id,
      'read',
    );
    if (page.generation !== row.generation)
      throw new DomainError('CONFLICT', 'This page was restored. Run its current source again.');
    return row;
  }
  async read(token: string) {
    const row = await this.row(token);
    return {
      source: row.source,
      pageId: row.page_id,
      actor: { userId: row.user_id },
      expiresAt: new Date(row.expires_at).toISOString(),
    };
  }
  async renew(actor: Actor, token: string) {
    const row = await this.row(token);
    if (row.user_id !== actor.userId)
      throw new DomainError('NOT_FOUND', 'This website preview is unavailable.');
    const expiresAt = new Date(Date.now() + lifetime).toISOString();
    await this.db.query('UPDATE web_previews SET expires_at=$2 WHERE id=$1', [row.id, expiresAt]);
    return { expiresAt };
  }
  async stop(actor: Actor, token: string) {
    // Stopping a derived revision must also work after its page access was revoked.
    await this.db.query('DELETE FROM web_previews WHERE id=$1 AND user_id=$2', [
      tokenHash(token),
      actor.userId,
    ]);
    return { stopped: true };
  }
  async asset(token: string, id: string) {
    const preview = await this.read(token);
    const [owned] = await this.db.query('SELECT id FROM attachments WHERE id=$1 AND page_id=$2', [
      id,
      preview.pageId,
    ]);
    if (!owned)
      throw new DomainError('NOT_FOUND', 'This asset does not belong to the previewed page.');
    return new Attachments(this.db, this.storage).read(preview.actor, id);
  }
}
