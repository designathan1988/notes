import type { Database } from '../platform/database.js';
import { DomainError, validateTitle, type Actor, type Page, type PageKind } from '../../../../packages/contracts/src/index.js';
import { Access } from '../access/service.js';
import { randomUUID } from 'node:crypto';
import { toPage, type PageRow } from './model.js';
type CreatePage = { title: string; parentId?: string | null; visibility?: 'workspace' | 'private'; kind?: PageKind; description?: string };
export class Pages {
  onChanged: (workspace: string) => void = () => {};
  constructor(readonly db: Database, readonly access = new Access(db)) {}
  async create(actor: Actor, workspace: string, input: CreatePage): Promise<Page> {
    const title = validateTitle(input.title);
    if (input.kind && !['document','database','record'].includes(input.kind)) throw new DomainError('INVALID', 'Unknown page type.');
    if (input.visibility && !['workspace','private'].includes(input.visibility)) throw new DomainError('INVALID', 'Unknown visibility.');
    return this.db.transaction(async tx => {
      const access = new Access(tx); await access.requireWorkspace(actor, workspace, 'editor');
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [workspace]);
      const parent = input.parentId ? await access.requirePage(actor, input.parentId, 'write') : null;
      if (parent && parent.workspaceId !== workspace) throw new DomainError('FORBIDDEN', 'Parent belongs to another workspace.');
      if (parent?.kind === 'database' && input.kind !== 'record') throw new DomainError('CONFLICT', 'Create database records with the record command.');
      const id = randomUUID();
      const [row] = await tx.query<PageRow>(`INSERT INTO pages (id,workspace_id,parent_id,title,description,created_by,visibility,kind,position)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,(SELECT coalesce(max(position),0)+1 FROM pages WHERE workspace_id=$2)) RETURNING *`,
        [id, workspace, parent?.id ?? null, title, String(input.description ?? '').slice(0,2000), actor.userId, parent?.visibility ?? input.visibility ?? 'workspace', input.kind ?? 'document']);
      if (input.kind === 'database') await tx.query('INSERT INTO database_definitions (page_id) VALUES ($1)', [id]);
      return toPage(row);
    });
  }
  get(actor: Actor, id: string): Promise<Page> { return this.access.requirePage(actor, id, 'read'); }
  list(actor: Actor, workspace: string, trash = false): Promise<Page[]> { return this.access.visiblePages(actor, workspace, trash); }
  async update(actor: Actor, id: string, input: { title?: string; description?: string; revision: number }): Promise<Page> {
    const page = await this.access.requirePage(actor, id, 'write');
    const title = input.title === undefined ? page.title : validateTitle(input.title);
    const [row] = await this.db.query<PageRow>('UPDATE pages SET title=$2,description=$3,revision=revision+1,updated_at=now() WHERE id=$1 AND revision=$4 RETURNING *', [id,title, String(input.description ?? page.description).slice(0,2000),input.revision]);
    if (!row) throw new DomainError('CONFLICT', 'The page changed. Reload it before saving again.');
    await this.db.query('INSERT INTO outbox (page_id,version) SELECT page_id,version FROM documents WHERE page_id=$1', [id]);
    this.onChanged(page.workspaceId); return toPage(row);
  }
  async move(actor: Actor, id: string, parentId: string | null, revision: number, confirmed: boolean): Promise<Page> {
    const result = await this.db.transaction(async tx => {
      const access = new Access(tx); const page = await access.requirePage(actor,id,'write');
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [page.workspaceId]);
      if (page.kind === 'record') throw new DomainError('CONFLICT', 'Records remain inside their owning database.');
      const parent = parentId ? await access.requirePage(actor,parentId,'write') : null;
      if (parent && (parent.workspaceId !== page.workspaceId || parent.kind === 'database')) throw new DomainError('CONFLICT', 'Choose a document in the same workspace.');
      const descendants = await tx.query<{ id: string }>(`WITH RECURSIVE branch AS (SELECT id FROM pages WHERE id=$1 UNION ALL SELECT p.id FROM pages p JOIN branch b ON p.parent_id=b.id) SELECT id FROM branch`,[id]);
      if (parentId && descendants.some(child => child.id === parentId)) throw new DomainError('CONFLICT', 'A page cannot be moved into its own subtree.');
      const visibility = parent?.visibility ?? page.visibility;
      if (visibility !== page.visibility && !confirmed) throw new DomainError('CONFLICT', 'This move changes access. Confirm the visibility change.');
      const [row] = await tx.query<PageRow>('UPDATE pages SET parent_id=$2,visibility=$3,revision=revision+1,updated_at=now() WHERE id=$1 AND revision=$4 RETURNING *', [id,parentId,visibility,revision]);
      if (!row) throw new DomainError('CONFLICT', 'The page changed. Reload before moving it.');
      return toPage(row);
    });
    this.onChanged(result.workspaceId); return result;
  }
  private async setTrash(actor: Actor, id: string, trash: boolean) {
    const page = await this.access.requirePage(actor,id,'write',!trash);
    await this.db.transaction(async tx => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [page.workspaceId]);
      if (!trash && page.parentId) await new Access(tx).requirePage(actor,page.parentId,'write');
      await tx.query(`WITH RECURSIVE branch AS (SELECT id FROM pages WHERE id=$1 UNION ALL SELECT p.id FROM pages p JOIN branch b ON p.parent_id=b.id)
        UPDATE pages SET deleted_at=${trash ? 'now()' : 'NULL'},revision=revision+1,updated_at=now() WHERE id IN (SELECT id FROM branch)`,[id]);
    });
    this.onChanged(page.workspaceId);
  }
  trash(actor: Actor, id: string) { return this.setTrash(actor,id,true); }
  restore(actor: Actor, id: string) { return this.setTrash(actor,id,false); }
}
