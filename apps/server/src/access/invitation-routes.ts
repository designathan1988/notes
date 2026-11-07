import type { FastifyInstance } from 'fastify';import type { Database } from '../platform/database.js';import { FileMail } from '../identity/mail.js';import { Invitations } from './invitations.js';import { assertObject,DomainError,type Role } from '../../../../packages/contracts/src/index.js';
export function invitationRoutes(app:FastifyInstance,db:Database){
  const mail=new FileMail();const invitations=new Invitations(db,mail);
  app.post<{Params:{workspace:string}}>('/api/workspaces/:workspace/invitations',async request=>{if(process.env.NODE_ENV==='production')throw new DomainError('INVALID','A production email transport must be connected before enabling invitations.');assertObject(request.body);const result=await invitations.create(request.actor,request.params.workspace,String(request.body.email ?? ''),request.body.role as Role);return{...result,delivery:'local-outbox'};});
  app.get<{Params:{id:string}}>('/api/invitations/:id',async request=>{const {invite,user}=await invitations.peek(request.actor,request.params.id);return{id:invite.id,workspaceName:invite.name,role:invite.role,status:invite.status,requiresVerification:!user.email_verified};});
  app.post<{Params:{id:string}}>('/api/invitations/:id/accept',request=>invitations.accept(request.actor,request.params.id));
  if(process.env.NODE_ENV!=='production')app.get('/api/local-mail',async request=>{const [user]=await db.query<{email:string}>('SELECT email FROM "user" WHERE id=$1',[request.actor.userId]);return mail.list(user.email);});
}
