import type { Database } from '../platform/database.js';
import {
  DomainError,
  validateTitle,
  type Actor,
  type Page,
  type PageKind,
  type PageUpdate,
} from '../../../../packages/contracts/src/index.js';
import { Access } from '../access/service.js';
import { randomUUID } from 'node:crypto';
import { toPage, type PageRow } from './model.js';
import { PageDetails } from './details.js';
type CreatePage = {
  title: string;
  parentId?: string | null;
  visibility?: 'workspace' | 'private';
  kind?: PageKind;
  description?: string;
};
export class Pages {
  onChanged: (workspace: string, pageId: string) => void = () => {};
  constructor(
    readonly db: Database,
    readonly access = new Access(db),
  ) {}
  async create(
    actor: Actor,
    workspace: string,
    input: CreatePage,
    internalId?: string,
  ): Promise<Page> {
    const title = validateTitle(input.title);
    if (input.kind && !['document', 'database', 'record'].includes(input.kind))
      throw new DomainError('INVALID', 'Unknown page type.');
    if (input.visibility && !['workspace', 'private'].includes(input.visibility))
      throw new DomainError('INVALID', 'Unknown visibility.');
    return this.db.transaction(async (tx) => {
      const access = new Access(tx);
      await access.guardWorkspace(workspace);
      await access.requireWorkspace(actor, workspace, 'editor');
      const parent = input.parentId
        ? await access.requirePage(actor, input.parentId, 'write')
        : null;
      if (parent && parent.workspaceId !== workspace)
        throw new DomainError('FORBIDDEN', 'Parent belongs to another workspace.');
      if (parent?.kind === 'database' && input.kind !== 'record')
        throw new DomainError('CONFLICT', 'Create database records with the record command.');
      if (input.kind === 'record' && parent?.kind !== 'database')
        throw new DomainError('CONFLICT', 'Records must belong to a database.');
      const id = internalId ?? randomUUID();
      const [row] = await tx.query<PageRow>(
        `INSERT INTO pages (id,workspace_id,parent_id,title,description,created_by,visibility,kind,private_owner_id,position)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,(SELECT coalesce(max(position),0)+1 FROM pages WHERE workspace_id=$2)) RETURNING *`,
        [
          id,
          workspace,
          parent?.id ?? null,
          title,
          String(input.description ?? '').slice(0, 2000),
          actor.userId,
          parent?.visibility ?? input.visibility ?? 'workspace',
          input.kind ?? 'document',
          parent?.accessOwnerId ?? actor.userId,
        ],
      );
      if (input.kind === 'database')
        await tx.query('INSERT INTO database_definitions (page_id) VALUES ($1)', [id]);
      await tx.query('INSERT INTO outbox (page_id,version) VALUES ($1,1)', [id]);
      return toPage(row);
    });
  }
  get(actor: Actor, id: string): Promise<Page> {
    return this.access.requirePage(actor, id, 'read');
  }
  list(actor: Actor, workspace: string, trash = false): Promise<Page[]> {
    return this.access.visiblePages(actor, workspace, trash);
  }
  async update(
    actor: Actor,
    id: string,
    input: PageUpdate & { revision: number },
  ): Promise<Page> {
    return new PageDetails(this.db).update(actor, id, input);
  }
  async move(
    actor: Actor,
    id: string,
    parentId: string | null,
    revision: number,
    confirmed: boolean,
    beforeId?: string | null,
  ): Promise<Page> {
    const result = await this.db.transaction(async (tx) => {
      const access = new Access(tx);
      const page = await access.lockPage(actor, id);
      if (page.kind === 'record')
        throw new DomainError('CONFLICT', 'Records remain inside their owning database.');
      const parent = parentId ? await access.requirePage(actor, parentId, 'write') : null;
      if (parent && (parent.workspaceId !== page.workspaceId || parent.kind === 'database'))
        throw new DomainError('CONFLICT', 'Choose a document in the same workspace.');
      const descendants = await tx.query<{ id: string }>(
        `WITH RECURSIVE branch AS (SELECT id FROM pages WHERE id=$1 UNION ALL SELECT p.id FROM pages p JOIN branch b ON p.parent_id=b.id) SELECT id FROM branch`,
        [id],
      );
      if (parentId && descendants.some((child) => child.id === parentId))
        throw new DomainError('CONFLICT', 'A page cannot be moved into its own subtree.');
      const siblings = await tx.query<{ id: string }>(
        'SELECT id FROM pages WHERE workspace_id=$1 AND parent_id IS NOT DISTINCT FROM $2 AND deleted_at IS NULL AND id<>$3 ORDER BY position,id',
        [page.workspaceId, parentId, id],
      );
      const insertion = beforeId
        ? siblings.findIndex((sibling) => sibling.id === beforeId)
        : siblings.length;
      if (insertion < 0)
        throw new DomainError(
          'CONFLICT',
          'The destination changed. Choose a sibling in the same location.',
        );
      const visibility = parent?.visibility ?? page.visibility;
      const privateOwner = parent?.accessOwnerId ?? page.accessOwnerId;
      if (
        (visibility !== page.visibility ||
          (visibility === 'private' && privateOwner !== page.accessOwnerId)) &&
        !confirmed
      )
        throw new DomainError(
          'CONFLICT',
          'This move changes access. Confirm the visibility change.',
        );
      const [row] = await tx.query<PageRow>(
        'UPDATE pages SET parent_id=$2,visibility=$3,private_owner_id=$5,revision=revision+1,updated_at=now() WHERE id=$1 AND revision=$4 RETURNING *',
        [id, parentId, visibility, revision, privateOwner],
      );
      if (!row) throw new DomainError('CONFLICT', 'The page changed. Reload before moving it.');
      siblings.splice(insertion, 0, { id });
      await tx.query(
        'UPDATE pages p SET position=s.ordinal FROM unnest($1::text[]) WITH ORDINALITY AS s(id,ordinal) WHERE p.id=s.id',
        [siblings.map((sibling) => sibling.id)],
      );
      row.position = insertion + 1;
      return toPage(row);
    });
    this.onChanged(result.workspaceId, id);
    return result;
  }
  private async setTrash(actor: Actor, id: string, trash: boolean) {
    const workspace = await this.db.transaction(async (tx) => {
      const page = await new Access(tx).lockPage(actor, id, !trash);
      if (!trash && page.parentId) await new Access(tx).requirePage(actor, page.parentId, 'write');
      await tx.query(
        `WITH RECURSIVE branch AS (SELECT id FROM pages WHERE id=$1 UNION ALL SELECT p.id FROM pages p JOIN branch b ON p.parent_id=b.id)
        UPDATE pages SET deleted_at=${trash ? 'now()' : 'NULL'},revision=revision+1,updated_at=now() WHERE id IN (SELECT id FROM branch)`,
        [id],
      );
      return page.workspaceId;
    });
    this.onChanged(workspace, id);
  }
  trash(actor: Actor, id: string) {
    return this.setTrash(actor, id, true);
  }
  restore(actor: Actor, id: string) {
    return this.setTrash(actor, id, false);
  }
}
