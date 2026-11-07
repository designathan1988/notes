import * as Y from 'yjs';
export function snapshotAcknowledgementCovers(update:Uint8Array,durable:string):boolean {
  try{return Y.snapshotContainsUpdate(Y.decodeSnapshot(Uint8Array.from(atob(durable),char=>char.charCodeAt(0))),update);}catch{return false;}
}
export function acknowledgementCovers(local:Uint8Array,durable:string):boolean {
  try{const bytes=Uint8Array.from(atob(durable),char=>char.charCodeAt(0));const acknowledged=Y.decodeStateVector(bytes);
    for(const [client,clock] of Y.decodeStateVector(local))if((acknowledged.get(client) ?? 0)<clock)return false;return true;
  }catch{return false;}
}
