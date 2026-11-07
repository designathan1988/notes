import type { FastifyInstance } from 'fastify';
import type { Auth } from '../identity/auth.js';
import type { Access } from './service.js';
import { requestHeaders } from '../platform/http.js';
import { assertObject, type Role } from '../../../../packages/contracts/src/index.js';
export function accessRoutes(app: FastifyInstance, access: Access, auth: Auth) {
  app.get('/api/session', async request => {
    const session = await auth.api.getSession({ headers: requestHeaders(request) });
    return { user: session!.user, workspaces: await access.workspaces(request.actor) };
  });
  app.post('/api/workspaces', request => { assertObject(request.body); return access.createWorkspace(request.actor,String(request.body.name ?? 'My workspace')); });
  app.get<{ Params: { workspace: string } }>('/api/workspaces/:workspace/members', async request => {
    await access.requireWorkspace(request.actor,request.params.workspace);
    return access.db.query('SELECT u.id,u.name,u.email,m.role FROM member m JOIN "user" u ON u.id=m.user_id WHERE m.organization_id=$1 ORDER BY m.created_at',[request.params.workspace]);
  });
  app.patch<{ Params: { workspace: string; user: string } }>('/api/workspaces/:workspace/members/:user', async request => {
    assertObject(request.body); await access.changeRole(request.actor,request.params.workspace,request.params.user,request.body.role as Role | null); return { ok: true };
  });
}
