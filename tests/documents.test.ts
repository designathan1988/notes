import { afterAll,beforeAll,expect,test } from 'vitest';
import * as Y from 'yjs';
import { fixture,rawPage } from './helpers.js';
import type { Database } from '../apps/server/src/platform/database.js';
import { Documents } from '../apps/server/src/documents/service.js';
import { acknowledgementCovers,snapshotAcknowledgementCovers } from '../apps/web/src/documents/durability.js';
import { openRecovery } from '../apps/web/src/documents/recovery.js';
let db:Database;let documents:Documents;let page:string;
const actor={userId:'owner'};
beforeAll(async()=>{db=await fixture();page=await rawPage(db);documents=new Documents(db);});
afterAll(async()=>{await db.close();});
test('merges concurrent updates and reloads the durable result',async()=>{
  const first=await documents.load(page);const second=new Y.Doc();Y.applyUpdate(second,Y.encodeStateAsUpdate(first));
  first.getText('probe').insert(0,'Alpha');second.getText('probe').insert(0,'Beta');
  await Promise.all([documents.save(actor,page,Y.encodeStateAsUpdate(first),1),documents.save(actor,page,Y.encodeStateAsUpdate(second),1)]);
  const reopened=await new Documents(db).load(page);
  expect(reopened.getText('probe').toString()).toContain('Alpha');expect(reopened.getText('probe').toString()).toContain('Beta');
  const ack=await documents.acknowledgement(actor,page);
  expect(acknowledgementCovers(Y.encodeStateVector(first),ack.stateVector)).toBe(true);
  first.destroy();second.destroy();reopened.destroy();
});
test('does not persist rejected viewer or revoked-member updates',async()=>{
  const content=await documents.load(page);content.getText('probe').insert(0,'UNAUTHORIZED');
  await expect(documents.save({userId:'viewer'},page,Y.encodeStateAsUpdate(content),1)).rejects.toMatchObject({code:'FORBIDDEN'});
  await db.query("DELETE FROM member WHERE user_id='editor'");
  await expect(documents.save({userId:'editor'},page,Y.encodeStateAsUpdate(content),1)).rejects.toMatchObject({code:'FORBIDDEN'});
  expect((await documents.load(page)).getText('probe').toString()).not.toContain('UNAUTHORIZED');content.destroy();
});
test('rejects replay from an obsolete document generation',async()=>{
  const content=await documents.load(page);
  await expect(documents.save(actor,page,Y.encodeStateAsUpdate(content),0)).rejects.toMatchObject({code:'CONFLICT'});content.destroy();
});
test('never considers a partial state-vector acknowledgement fully saved',()=>{
  const local=new Y.Doc();local.getText('body').insert(0,'Locally typed');
  const empty=new Y.Doc();
  expect(acknowledgementCovers(Y.encodeStateVector(local),Buffer.from(Y.encodeStateVector(empty)).toString('base64'))).toBe(false);
  expect(acknowledgementCovers(Y.encodeStateVector(local),Buffer.from(Y.encodeStateVector(local)).toString('base64'))).toBe(true);
  local.destroy();empty.destroy();
});
test('does not acknowledge a save before the actual database transaction commits',async()=>{
  let release!:()=>void;let reached!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});const entered=new Promise<void>(resolve=>{reached=resolve;});
  const delayed:Database={...db,transaction:fn=>db.transaction(async tx=>{const result=await fn(tx);reached();await gate;return result;})};
  const content=await documents.load(page);content.getText('probe').insert(0,'Durable ');let acknowledged=false;
  const saving=new Documents(delayed).save(actor,page,Y.encodeStateAsUpdate(content),1).then(result=>{acknowledged=true;return result;});
  await entered;expect(acknowledged).toBe(false);release();const result=await saving;expect(acknowledged).toBe(true);expect(result.type).toBe('durable');content.destroy();
});
test('reports unsupported recovery storage instead of claiming a local save',async()=>{
  await expect(openRecovery()).rejects.toThrow('Local recovery is unavailable');
});
test('durable acknowledgements cover deletions even when state-vector clocks do not change',()=>{
  const doc=new Y.Doc();doc.getText('body').insert(0,'Keep or remove');
  const before=Buffer.from(Y.encodeSnapshot(Y.snapshot(doc))).toString('base64');const clocks=Y.encodeStateVector(doc);
  doc.getText('body').delete(0,5);
  expect(Y.encodeStateVector(doc)).toEqual(clocks);
  expect(snapshotAcknowledgementCovers(Y.encodeStateAsUpdate(doc),before)).toBe(false);
  expect(snapshotAcknowledgementCovers(Y.encodeStateAsUpdate(doc),Buffer.from(Y.encodeSnapshot(Y.snapshot(doc))).toString('base64'))).toBe(true);doc.destroy();
});
