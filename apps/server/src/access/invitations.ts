import type { Database } from '../platform/database.js';import type { MailTransport } from '../identity/mail.js';import {DomainError,type Actor,type Role} from '../../../../packages/contracts/src/index.js';import { Access } from './service.js';import { randomUUID } from 'node:crypto';
interface Invite{id:string;organization_id:string;email:string;role:Role;status:string;expires_at:Date|string;name:string}
export class Invitations{
  constructor(readonly db:Database,readonly mail:MailTransport){}
  async create(actor:Actor,workspace:string,email:string,role:Role):Promise<{id:string}>{
    await new Access(this.db).requireWorkspace(actor,workspace,'admin');if(!['admin','editor','viewer'].includes(role))throw new DomainError('FORBIDDEN','Invite members as admin, editor, or viewer.');
    email=email.trim().toLowerCase();if(email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new DomainError('INVALID','Enter a valid email address.');
    const id=randomUUID();await this.db.query("INSERT INTO invitation (id,organization_id,email,role,status,expires_at,inviter_id) VALUES ($1,$2,$3,$4,'pending',now()+interval '7 days',$5)",[id,workspace,email,role,actor.userId]);
    const [organization]=await this.db.query<{name:string}>('SELECT name FROM organization WHERE id=$1',[workspace]);const url=`${process.env.APP_ORIGIN ?? 'http://127.0.0.1:5173'}/?invite=${id}`;
    await this.mail.send({to:email,subject:`Join ${organization.name} in Note`,url});return{id};
  }
  async peek(actor:Actor,id:string){
    const [invite]=await this.db.query<Invite>('SELECT i.*,o.name FROM invitation i JOIN organization o ON o.id=i.organization_id WHERE i.id=$1',[id]);const [user]=await this.db.query<{email:string;email_verified:boolean}>('SELECT email,email_verified FROM "user" WHERE id=$1',[actor.userId]);
    if(!invite || !user || invite.email.toLowerCase()!==user.email.toLowerCase())throw new DomainError('FORBIDDEN','This invitation belongs to another account.');return{invite,user};
  }
  async accept(actor:Actor,id:string):Promise<{workspaceId:string}>{
    return this.db.transaction(async tx=>{
      await tx.query('SELECT id FROM invitation WHERE id=$1 FOR UPDATE',[id]);const {invite,user}=await new Invitations(tx,this.mail).peek(actor,id);
      if(invite.status!=='pending' || new Date(invite.expires_at).getTime()<=Date.now())throw new DomainError('CONFLICT','This invitation has expired or was already used.');
      if(!user.email_verified)throw new DomainError('FORBIDDEN','Verify your email before accepting the invitation.');
      await tx.query('INSERT INTO member (id,organization_id,user_id,role) VALUES ($1,$2,$3,$4) ON CONFLICT (organization_id,user_id) DO NOTHING',[randomUUID(),invite.organization_id,actor.userId,invite.role]);await tx.query("UPDATE invitation SET status='accepted' WHERE id=$1",[id]);return{workspaceId:invite.organization_id};
    });
  }
}
