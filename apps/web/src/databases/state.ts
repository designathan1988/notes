import type { DatabaseRecord,RecordField } from '../../../../packages/contracts/src/index.js';
import { api,json } from '../state/api.js';
import type { WorkspaceState } from '../state/store.js';
export interface TableOptions{filter?:string;sort?:string;direction?:string;offset?:number;limit?:number}
export interface TableSnapshot{fields:RecordField[];records:DatabaseRecord[];total:number;views:{id:string;name:string;config:TableOptions}[]}
export interface DatabaseSlice{tables:Record<string,TableSnapshot>;loadTable(id:string,options?:TableOptions):Promise<void>;editRecord(databaseId:string,pageId:string,patch:{title?:string;values?:Record<string,unknown>}):Promise<void>}
export function databaseSlice(set:(partial:Partial<WorkspaceState>)=>void,get:()=>WorkspaceState):DatabaseSlice{return{
  tables:{},
  async loadTable(id,options={}){const user=get().user?.id;const workspace=get().workspaceId;const query=new URLSearchParams(Object.entries(options).filter(([,value])=>value!==undefined).map(([key,value])=>[key,String(value)]));const result=await api<TableSnapshot>(`/databases/${id}?${query}`);if(user===get().user?.id && workspace===get().workspaceId)set({tables:{...get().tables,[id]:result}});},
  async editRecord(id,pageId,patch){const record=get().tables[id]?.records.find(row=>row.pageId===pageId);if(!record)return;await api(`/databases/${id}/records/${pageId}`,{method:'PATCH',body:json({...patch,values:patch.values ?? {},revision:record.revision})});},
};}
