import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { api } from '../state/api.js';
import { useWorkspace } from '../state/store.js';
import { snapshotAcknowledgementCovers } from './durability.js';
import { openRecovery,type Recovery } from './recovery.js';
import type { Page,SaveStatus } from '../../../../packages/contracts/src/index.js';
export class DocumentSession {
  readonly doc=new Y.Doc();provider!:HocuspocusProvider;recovery:Recovery|null=null;destroyed=false;connected=false;readOnly=false;dirty=false;locallySaved=false;
  private readonly userId:string;private readonly key:string;private lastAcknowledgement='';
  constructor(readonly page:Page){this.userId=useWorkspace.getState().user!.id;this.key=`${this.userId}:${page.workspaceId}:${page.id}:${page.generation}`;}
  private setStatus(status:SaveStatus){if(!this.destroyed && useWorkspace.getState().selectedId===this.page.id)useWorkspace.setState({saveStatus:status});}
  async start(){
    this.setStatus('connecting');const config=await api<{generation:number;readOnly:boolean}>(`/pages/${this.page.id}/document`);this.readOnly=config.readOnly;
    if(config.generation!==this.page.generation)throw new Error('This document changed. Reload before recovering it.');
    try{this.recovery=await openRecovery();const update=await this.recovery.read(this.key);if(update)Y.applyUpdate(this.doc,update,'recovery');}
    catch{useWorkspace.getState().setError('Local recovery is unavailable. Keep this tab open until changes are saved to the server.');}
    if(this.destroyed){this.recovery?.close();return;}
    this.doc.on('update',this.onUpdate);
    const protocol=location.protocol==='https:' ? 'wss:' : 'ws:';
    this.provider=new HocuspocusProvider({url:`${protocol}//${location.host}/collaboration`,name:`${this.page.id}:${this.page.generation}`,document:this.doc,token:'cookie-session',
      onStatus:({status})=>{this.connected=status==='connected';if(!this.connected)this.setStatus(this.readOnly ? 'read-only' : this.locallySaved ? 'local' : 'connecting');},
      onSynced:()=>{if(this.readOnly)this.setStatus('read-only');else this.provider.sendStateless('checkpoint');},
      onStateless:({payload})=>{try{const ack=JSON.parse(payload);if(ack.type==='save-error'){this.setStatus('error');useWorkspace.getState().setError(ack.message);}else if(ack.type==='durable' && ack.pageId===this.page.id && ack.generation===this.page.generation){this.lastAcknowledgement=ack.snapshot;if(snapshotAcknowledgementCovers(Y.encodeStateAsUpdate(this.doc),ack.snapshot)){this.dirty=false;this.setStatus(this.readOnly?'read-only':'saved');}}}catch{/* Ignore unrelated protocol messages. */}},
      onAuthenticationFailed:()=>{this.setStatus('error');useWorkspace.getState().setError('Access to this document changed. Your local draft has not been sent.');},
    });
    this.provider.setAwarenessField('user',{name:useWorkspace.getState().user!.name,color:'#39745f'});
    window.addEventListener('beforeunload',this.beforeUnload);
  }
  private beforeUnload=(event:BeforeUnloadEvent)=>{if(this.dirty){event.preventDefault();event.returnValue='';}};
  private onUpdate=()=>{
    if(this.destroyed)return;this.dirty=!snapshotAcknowledgementCovers(Y.encodeStateAsUpdate(this.doc),this.lastAcknowledgement);this.locallySaved=false;
    if(!this.readOnly)this.setStatus(this.dirty ? this.connected?'saving':'connecting' : 'saved');
    if(this.recovery)void this.recovery.write(this.key,Y.encodeStateAsUpdate(this.doc)).then(()=>{this.locallySaved=true;if(!this.connected && this.dirty)this.setStatus('local');}).catch(()=>{this.locallySaved=false;if(!this.connected)this.setStatus('error');useWorkspace.getState().setError('Local recovery storage is full or unavailable.');});
  };
  async destroy(){this.destroyed=true;this.doc.off('update',this.onUpdate);window.removeEventListener('beforeunload',this.beforeUnload);this.provider?.destroy();if(this.recovery){if(!useWorkspace.getState().user)await this.recovery.clearIdentity(this.userId);this.recovery.close();}this.doc.destroy();}
}
