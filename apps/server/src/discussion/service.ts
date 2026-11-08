import { randomUUID } from 'node:crypto';
import type { Database } from '../platform/database.js';
import { Access } from '../access/service.js';
import {
  DomainError,
  ACTIVITY_PAGE_SIZE,
  type Actor,
  type DiscussionMessage,
  type DiscussionThread,
} from '@note/contracts';

const text = (value: unknown, max: number, name: string) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0'))
    throw new DomainError('INVALID', `${name} must contain between 1 and ${max} characters.`);
  return value.trim();
};
import { pageOffset } from '../platform/pagination.js';
const messageColumns = `m.id,m.thread_id AS "threadId",m.author_id AS "authorId",coalesce(u.name,'Former member') AS "authorName",m.body,m.created_at AS "createdAt"`;
export class Discussions {
  constructor(readonly db: Database) {}
  async list(actor: Actor, page: string, resolved = false, offset = 0) {
    await new Access(this.db).requirePage(actor, page, 'read');
    const threads = await this.db.query<DiscussionThread>(
      `SELECT t.id,t.page_id AS "pageId",t.quote,t.resolved,t.revision,t.updated_at AS "updatedAt",
      (SELECT count(*)::integer FROM discussion_messages WHERE thread_id=t.id) AS "messageCount",
      (SELECT json_build_object('id',m.id,'threadId',m.thread_id,'authorId',m.author_id,'authorName',coalesce(u.name,'Former member'),'body',m.body,'createdAt',m.created_at)
       FROM discussion_messages m LEFT JOIN "user" u ON u.id=m.author_id WHERE m.thread_id=t.id ORDER BY m.created_at,m.id LIMIT 1) AS "firstMessage"
      FROM discussion_threads t WHERE t.page_id=$1 AND t.resolved=$2 ORDER BY t.updated_at DESC,t.id LIMIT ${ACTIVITY_PAGE_SIZE + 1} OFFSET $3`,
      [page, resolved, pageOffset(offset)],
    );
    return {
      threads: threads.slice(0, ACTIVITY_PAGE_SIZE),
      hasMore: threads.length > ACTIVITY_PAGE_SIZE,
    };
  }
  async messages(actor: Actor, page: string, thread: string, offset = 0, before?: string) {
    await new Access(this.db).requirePage(actor, page, 'read');
    const currentThread = await this.requireThread(page, thread);
    const messages = await this.db.query<DiscussionMessage>(
      `SELECT ${messageColumns} FROM discussion_messages m LEFT JOIN "user" u ON u.id=m.author_id WHERE m.thread_id=$1
      ${before ? 'AND (m.created_at,m.id)<(SELECT created_at,id FROM discussion_messages WHERE id=$3 AND thread_id=$1)' : ''}
      ORDER BY m.created_at DESC,m.id DESC LIMIT 51 OFFSET $2`,
      before ? [thread, pageOffset(offset), before] : [thread, pageOffset(offset)],
    );
    return {
      messages: messages.slice(0, 50).reverse(),
      hasMore: messages.length > 50,
      thread: currentThread,
    };
  }
  private async requireThread(page: string, thread: string) {
    const [row] = await this.db.query<
      Pick<DiscussionThread, 'id' | 'pageId' | 'quote' | 'resolved' | 'revision'>
    >(
      'SELECT id,page_id AS "pageId",quote,resolved,revision FROM discussion_threads WHERE id=$1 AND page_id=$2',
      [thread, page],
    );
    if (!row) throw new DomainError('NOT_FOUND', 'This discussion is unavailable.');
    return row;
  }
  async create(actor: Actor, page: string, body: unknown, quote: unknown = '') {
    const content = text(body, 10000, 'Comment');
    if (typeof quote !== 'string' || quote.length > 1000 || quote.includes('\0'))
      throw new DomainError('INVALID', 'Quoted context must be at most 1000 characters.');
    const id = randomUUID();
    await this.db.transaction(async (tx) => {
      await new Access(tx).lockPage(actor, page);
      await tx.query('INSERT INTO discussion_threads (id,page_id,quote) VALUES ($1,$2,$3)', [
        id,
        page,
        quote,
      ]);
      await tx.query(
        'INSERT INTO discussion_messages (id,thread_id,author_id,body) VALUES ($1,$2,$3,$4)',
        [randomUUID(), id, actor.userId, content],
      );
    });
    return { id, pageId: page, revision: 1, resolved: false };
  }
  async reply(actor: Actor, page: string, thread: string, body: unknown) {
    const content = text(body, 10000, 'Reply');
    return this.db.transaction(async (tx) => {
      await new Access(tx).lockPage(actor, page);
      if ((await new Discussions(tx).requireThread(page, thread)).resolved)
        throw new DomainError('CONFLICT', 'Reopen this discussion before replying.');
      const id = randomUUID();
      await tx.query(
        'INSERT INTO discussion_messages (id,thread_id,author_id,body) VALUES ($1,$2,$3,$4)',
        [id, thread, actor.userId, content],
      );
      await tx.query('UPDATE discussion_threads SET updated_at=clock_timestamp() WHERE id=$1', [
        thread,
      ]);
      return { id };
    });
  }
  async resolve(actor: Actor, page: string, thread: string, resolved: unknown, revision: unknown) {
    if (typeof resolved !== 'boolean' || !Number.isSafeInteger(revision) || Number(revision) < 1)
      throw new DomainError('INVALID', 'Use a resolution state and current discussion revision.');
    return this.db.transaction(async (tx) => {
      await new Access(tx).lockPage(actor, page);
      await new Discussions(tx).requireThread(page, thread);
      const [row] = await tx.query<{ id: string; resolved: boolean; revision: number }>(
        'UPDATE discussion_threads SET resolved=$3,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1 AND page_id=$2 AND revision=$4 RETURNING id,resolved,revision',
        [thread, page, resolved, revision],
      );
      if (!row)
        throw new DomainError('CONFLICT', 'This discussion changed. Refresh before updating it.');
      return row;
    });
  }
}
