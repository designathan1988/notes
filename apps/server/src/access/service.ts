import type { Database } from '../platform/database.js';
import {
  DomainError,
  roleRank,
  validateTitle,
  type Actor,
  type Page,
  type Role,
  type Workspace,
} from '../../../../packages/contracts/src/index.js';
import { toPage, toVisiblePage, type VisiblePageRow, type PageRow } from '../pages/model.js';
import { randomUUID } from 'node:crypto';
export class Access {
  onChanged: (workspace: string) => void = () => {};
  constructor(readonly db: Database) {}
  async guardWorkspace(workspace: string) {
    if (!this.db.transactional) throw new Error('Workspace write guards require a transaction.');
    await this.db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [workspace]);
  }
  async lockPage(actor: Actor, id: string, includeDeleted = false): Promise<Page> {
    const [location] = await this.db.query<{ workspace_id: string }>(
      'SELECT workspace_id FROM pages WHERE id=$1',
      [id],
    );
    if (!location) throw new DomainError('FORBIDDEN', 'This page is unavailable.');
    await this.guardWorkspace(location.workspace_id);
    return this.requirePage(actor, id, 'write', includeDeleted);
  }
  async members(actor: Actor, workspace: string) {
    await this.requireWorkspace(actor, workspace);
    return this.db.query<{ id: string; name: string; email: string; role: Role }>(
      'SELECT u.id,u.name,u.email,m.role FROM member m JOIN "user" u ON u.id=m.user_id WHERE m.organization_id=$1 ORDER BY m.created_at',
      [workspace],
    );
  }
  async requireWorkspace(actor: Actor, workspace: string, minimum: Role = 'viewer'): Promise<Role> {
    const [member] = await this.db.query<{ role: Role }>(
      'SELECT role FROM member WHERE organization_id=$1 AND user_id=$2',
      [workspace, actor.userId],
    );
    if (!member || roleRank[member.role] === undefined || roleRank[member.role] < roleRank[minimum])
      throw new DomainError('FORBIDDEN', 'You do not have access to this workspace or operation.');
    return member.role;
  }
  async requirePage(
    actor: Actor,
    id: string,
    mode: 'read' | 'write',
    includeDeleted = false,
  ): Promise<Page> {
    const lineage = await this.db.query<PageRow>(
      `WITH RECURSIVE lineage AS (
      SELECT * FROM pages WHERE id=$1 UNION ALL SELECT p.* FROM pages p JOIN lineage c ON p.id=c.parent_id
    ) SELECT * FROM lineage`,
      [id],
    );
    const row = lineage.find((page) => page.id === id);
    const root = lineage.find((page) => page.parent_id === null);
    if (!row || !root) throw new DomainError('FORBIDDEN', 'This page is unavailable.');
    await this.requireWorkspace(actor, row.workspace_id, mode === 'write' ? 'editor' : 'viewer');
    if (
      (!includeDeleted && lineage.some((page) => page.deleted_at)) ||
      (root.visibility === 'private' && (root.private_owner_id ?? root.created_by) !== actor.userId)
    )
      throw new DomainError('FORBIDDEN', 'This page is unavailable.');
    return {
      ...toPage(row),
      visibility: root.visibility,
      accessOwnerId: root.private_owner_id ?? root.created_by,
    };
  }
  async visiblePages(actor: Actor, workspace: string, trash = false): Promise<Page[]> {
    const scope = await this.scope(actor, workspace, trash);
    const rows = await this.db.query<VisiblePageRow>(
      `${scope.sql} SELECT * FROM visible ${trash ? 'WHERE deleted_at IS NOT NULL' : ''} ORDER BY position,title LIMIT 5000`,
      scope.params,
    );
    return rows.map(toVisiblePage);
  }
  async scope(actor: Actor, workspace: string, trash = false) {
    await this.requireWorkspace(actor, workspace);
    return {
      sql: `WITH RECURSIVE visible AS (
      SELECT p.*,p.visibility AS inherited_visibility,coalesce(p.private_owner_id,p.created_by) AS visibility_owner FROM pages p WHERE workspace_id=$1 AND parent_id IS NULL AND (visibility='workspace' OR coalesce(private_owner_id,created_by)=$2) ${trash ? '' : 'AND deleted_at IS NULL'}
      UNION ALL SELECT p.*,v.inherited_visibility,v.visibility_owner FROM pages p JOIN visible v ON p.parent_id=v.id ${trash ? '' : 'WHERE p.deleted_at IS NULL'}
    )`,
      params: [workspace, actor.userId],
    };
  }
  async workspaces(actor: Actor): Promise<Workspace[]> {
    return this.db.query<Workspace>(
      'SELECT o.id,o.name,m.role FROM organization o JOIN member m ON m.organization_id=o.id WHERE m.user_id=$1 ORDER BY o.created_at',
      [actor.userId],
    );
  }
  async createWorkspace(actor: Actor, name: string): Promise<Workspace> {
    const id = randomUUID();
    const title = validateTitle(name);
    await this.db.transaction(async (tx) => {
      await tx.query('INSERT INTO organization (id,name,slug) VALUES ($1,$2,$1)', [id, title]);
      await tx.query(
        "INSERT INTO member (id,organization_id,user_id,role) VALUES ($1,$2,$3,'owner')",
        [randomUUID(), id, actor.userId],
      );
      await tx.query('INSERT INTO beta_entitlements (workspace_id) VALUES ($1)', [id]);
    });
    return { id, name: title, role: 'owner' };
  }
  async changeRole(actor: Actor, workspace: string, user: string, role: Role | null) {
    if (role !== null && !(role in roleRank))
      throw new DomainError('INVALID', 'Unknown workspace role.');
    await this.db.transaction(async (tx) => {
      await new Access(tx).guardWorkspace(workspace);
      await tx.query('SELECT id FROM organization WHERE id=$1 FOR UPDATE', [workspace]);
      const access = new Access(tx);
      const callerRole = await access.requireWorkspace(actor, workspace, 'admin');
      const [target] = await tx.query<{ role: Role }>(
        'SELECT role FROM member WHERE organization_id=$1 AND user_id=$2',
        [workspace, user],
      );
      if (!target) throw new DomainError('NOT_FOUND', 'Member not found.');
      if ((target.role === 'owner' || role === 'owner') && callerRole !== 'owner')
        throw new DomainError('FORBIDDEN', 'Only owners can manage ownership.');
      if (target.role === 'owner' && role !== 'owner') {
        const owners = await tx.query(
          "SELECT id FROM member WHERE organization_id=$1 AND role='owner'",
          [workspace],
        );
        if (owners.length < 2)
          throw new DomainError('CONFLICT', 'A workspace must keep at least one owner.');
      }
      if (role)
        await tx.query('UPDATE member SET role=$3 WHERE organization_id=$1 AND user_id=$2', [
          workspace,
          user,
          role,
        ]);
      else
        await tx.query('DELETE FROM member WHERE organization_id=$1 AND user_id=$2', [
          workspace,
          user,
        ]);
    });
    this.onChanged(workspace);
  }
}
