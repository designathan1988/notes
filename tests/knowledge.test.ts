import { afterAll,beforeAll,expect,test } from 'vitest';
import { fixture,rawPage } from './helpers.js';
import type { Database } from '../apps/server/src/platform/database.js';
import { Knowledge } from '../apps/server/src/knowledge/service.js';
let db:Database;let knowledge:Knowledge;const actor={userId:'owner'};
beforeAll(async()=>{db=await fixture();knowledge=new Knowledge(db);});afterAll(async()=>{await db.close();});
test('out-of-order projections cannot replace newer text or graph edges',async()=>{
  const source=await rawPage(db,{title:'Source'});const target=await rawPage(db,{title:'Current target'});const obsolete=await rawPage(db,{title:'Obsolete target'});
  await knowledge.applyProjection(source,2,{text:'currentneedle',links:[target]});await knowledge.applyProjection(source,1,{text:'oldneedle',links:[obsolete]});
  expect((await knowledge.search(actor,'studio','currentneedle')).results.some(row=>row.id===source)).toBe(true);
  expect((await knowledge.search(actor,'studio','oldneedle')).results.some(row=>row.id===source)).toBe(false);
  expect((await knowledge.backlinks(actor,target)).some(link=>link.sourceId===source)).toBe(true);
  expect((await knowledge.backlinks(actor,obsolete)).some(link=>link.sourceId===source)).toBe(false);
});
test('search snippets and graph immediately respect private roots and membership revocation',async()=>{
  const publicPage=await rawPage(db,{title:'Public needle'});const secret=await rawPage(db,{title:'Private needle',visibility:'private'});
  await knowledge.applyProjection(publicPage,1,{text:'needle public',links:[secret]});await knowledge.applyProjection(secret,1,{text:'needle PRIVATE CONTENT',links:[publicPage]});
  const result=await knowledge.search({userId:'admin'},'studio','needle');expect(result.results.some(row=>row.id===secret)).toBe(false);expect(JSON.stringify(result)).not.toContain('PRIVATE CONTENT');
  const graph=await knowledge.graph({userId:'admin'},'studio');expect(graph.nodes.some(node=>node.id===secret)).toBe(false);expect(graph.edges.some(edge=>edge.target===secret || edge.source===secret)).toBe(false);
  await db.query("DELETE FROM member WHERE user_id='viewer'");await expect(knowledge.search({userId:'viewer'},'studio','needle')).rejects.toMatchObject({code:'FORBIDDEN'});
});
