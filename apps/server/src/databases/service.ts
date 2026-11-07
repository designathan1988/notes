import type { Database } from '../platform/database.js';
import { DomainError,type Actor,type RecordField,type DatabaseRecord } from '../../../../packages/contracts/src/index.js';
import { Access } from '../access/service.js';
import { Pages } from '../pages/service.js';
import { defaultFields,validateFields,validateValues } from './values.js';
import { randomUUID } from 'node:crypto';
interface RecordRow{page_id:string;title:string;values:Record<string,unknown>;revision:number;updated_at:string|Date}
const map=(row:RecordRow):DatabaseRecord=>({pageId:row.page_id,title:row.title,values:row.values,revision:row.revision,updatedAt:new Date(row.updated_at).toISOString()});
export class Databases {
  constructor(readonly db:Database){}
  async fields(actor:Actor,id:string){await new Access(this.db).requirePage(actor,id,'read');const [row]=await this.db.query<{fields:RecordField[]}>('SELECT fields FROM database_definitions WHERE page_id=$1',[id]);if(!row)throw new DomainError('INVALID','This page is not a database.');return row.fields.length ? row.fields : defaultFields;}
  async setFields(actor:Actor,id:string,fields:RecordField[]):Promise<void>{
    await new Access(this.db).requirePage(actor,id,'write');validateFields(fields);
    await this.db.transaction(async tx=>{const rows=await tx.query<{values:Record<string,unknown>}>('SELECT values FROM records WHERE database_id=$1',[id]);for(const row of rows)validateValues(fields,row.values);await tx.query('UPDATE database_definitions SET fields=$2 WHERE page_id=$1',[id,JSON.stringify(fields)]);});
  }
  private async check(actor:Actor,id:string,values:Record<string,unknown>){
    const access=new Access(this.db);const database=await access.requirePage(actor,id,'write');const fields=await this.fields(actor,id);validateValues(fields,values);
    for(const field of fields.filter(item=>item.type==='relation'))if(values[field.id]){const target=await access.requirePage(actor,String(values[field.id]),'read');if(target.workspaceId!==database.workspaceId || target.kind!=='record')throw new DomainError('INVALID','Relations must target accessible records in this workspace.');}
  }
  async createRecord(actor:Actor,id:string,input:{title:string;values:Record<string,unknown>}):Promise<DatabaseRecord>{
    await this.check(actor,id,input.values);const database=await new Access(this.db).requirePage(actor,id,'write');
    return this.db.transaction(async tx=>{const page=await new Pages(tx).create(actor,database.workspaceId,{title:input.title,parentId:id,kind:'record'});await tx.query('INSERT INTO records (page_id,database_id,values) VALUES ($1,$2,$3)',[page.id,id,JSON.stringify(input.values)]);return{pageId:page.id,title:page.title,values:input.values,revision:1,updatedAt:page.updatedAt};});
  }
  async updateRecord(actor:Actor,id:string,pageId:string,input:{title?:string;values:Record<string,unknown>;revision:number}):Promise<DatabaseRecord>{
    const [current]=await this.db.query<RecordRow>('SELECT r.*,p.title,p.updated_at FROM records r JOIN pages p ON p.id=r.page_id WHERE r.page_id=$1 AND r.database_id=$2',[pageId,id]);if(!current)throw new DomainError('NOT_FOUND','Record not found.');
    const values={...current.values,...input.values};await this.check(actor,id,values);
    return this.db.transaction(async tx=>{const [row]=await tx.query<RecordRow>('UPDATE records SET values=$3,revision=revision+1 WHERE page_id=$1 AND database_id=$2 AND revision=$4 RETURNING *',[pageId,id,JSON.stringify(values),input.revision]);if(!row)throw new DomainError('CONFLICT','This record changed. Reload it before editing again.');const pages=new Pages(tx);const page=await pages.get(actor,pageId);const updated=await pages.update(actor,pageId,{title:input.title ?? page.title,revision:page.revision});return{...map({...row,title:updated.title,updated_at:updated.updatedAt}),values};});
  }
  async records(actor:Actor,id:string,options:{sort?:string;filter?:string;direction?:string;offset?:number;limit?:number}={}):Promise<{records:DatabaseRecord[];total:number}>{
    const access=new Access(this.db);await access.requirePage(actor,id,'read');const fields=await this.fields(actor,id);const direction=options.direction==='desc'?'DESC':'ASC';const field=fields.find(item=>item.id===options.sort);
    const order=field ? field.type==='number' ? "(r.values->>$5)::numeric" : 'r.values->>$5' : options.sort==='updated'?'p.updated_at':options.sort==='title'?'p.title':'p.position';
    const filter=String(options.filter ?? '').slice(0,1000);const params:unknown[]=[id,`%${filter}%`,Math.min(200,Math.max(1,Number(options.limit)||50)),Math.max(0,Math.min(100000,Number(options.offset)||0))];if(field)params.push(field.id);
    const rows=await this.db.query<RecordRow>(`SELECT r.*,p.title,p.updated_at FROM records r JOIN pages p ON p.id=r.page_id WHERE r.database_id=$1 AND p.deleted_at IS NULL AND (p.title ILIKE $2 OR r.values::text ILIKE $2) ORDER BY ${order} ${direction},p.id LIMIT $3 OFFSET $4`,params);
    const [count]=await this.db.query<{total:string}>('SELECT count(*)::text AS total FROM records r JOIN pages p ON p.id=r.page_id WHERE r.database_id=$1 AND p.deleted_at IS NULL AND (p.title ILIKE $2 OR r.values::text ILIKE $2)',params.slice(0,2));
    const relations=fields.filter(item=>item.type==='relation');const records=await Promise.all(rows.map(async row=>{const record=map(row);for(const field of relations)if(record.values[field.id]){try{await access.requirePage(actor,String(record.values[field.id]),'read');}catch{record.values={...record.values,[field.id]:null};}}return record;}));return{records,total:Number(count.total)};
  }
  async views(actor:Actor,id:string){await new Access(this.db).requirePage(actor,id,'read');return this.db.query<{id:string;name:string;config:Record<string,unknown>}>('SELECT id,name,config FROM table_views WHERE database_id=$1 ORDER BY name',[id]);}
  async saveView(actor:Actor,id:string,name:string,config:{filter?:string;sort?:string;direction?:string}){await new Access(this.db).requirePage(actor,id,'write');if(!name.trim() || name.length>100)throw new DomainError('INVALID','Use a short view name.');const view={id:randomUUID(),name,config:{filter:String(config.filter ?? '').slice(0,1000),sort:String(config.sort ?? '').slice(0,64),direction:config.direction==='desc'?'desc':'asc'}};await this.db.query('INSERT INTO table_views (id,database_id,name,config) VALUES ($1,$2,$3,$4)',[view.id,id,name,JSON.stringify(view.config)]);return view;}
}
