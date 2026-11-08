import type { FastifyInstance } from 'fastify';
import type { Auth } from '../identity/auth.js';
import type { Access } from './service.js';
import { requestHeaders } from '../platform/http.js';
import { assertObject, type Role } from '../../../../packages/contracts/src/index.js';
export function accessRoutes(app: FastifyInstance, access: Access, auth: Auth) {
  app.get('/api/session', async (request) => {
    const session = await auth.api.getSession({ headers: requestHeaders(request) });
    return { user: session!.user, workspaces: await access.workspaces(request.actor) };
  });
  app.post('/api/workspaces', (request) => {
    assertObject(request.body);
    return access.createWorkspace(request.actor, String(request.body.name ?? 'My workspace'));
  });
  app.get<{ Params: { workspace: string } }>(
    '/api/workspaces/:workspace/members',
    async (request) => {
      return access.members(request.actor, request.params.workspace);
    },
  );
  app.patch<{ Params: { workspace: string; user: string } }>(
    '/api/workspaces/:workspace/members/:user',
    async (request) => {
      assertObject(request.body);
      await access.changeRole(
        request.actor,
        request.params.workspace,
        request.params.user,
        request.body.role as Role | null,
      );
      return { ok: true };
    },
  );
}
