import type { FastifyInstance } from 'fastify';import type { Access } from './service.js';
export function workspaceEvents(app:FastifyInstance,access:Access){
  const streams=new Set<()=>void>();app.addHook('onClose',async()=>{for(const close of streams)close();streams.clear();});
  app.get<{Params:{workspace:string}}>('/api/workspaces/:workspace/events',async(request,reply)=>{
    await access.requireWorkspace(request.actor,request.params.workspace);reply.hijack();reply.raw.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});reply.raw.write(': connected\n\n');
    let signature='';let busy=false;let closed=false;
    const tick=async()=>{if(busy || closed)return;busy=true;try{const scope=await access.scope(request.actor,request.params.workspace);const [row]=await access.db.query<{signature:string}>(`${scope.sql} SELECT count(*)::text || ':' || coalesce(sum(index_revision),0)::text || ':' || coalesce(sum(revision),0)::text AS signature FROM visible`,scope.params);const role=await access.requireWorkspace(request.actor,request.params.workspace);const current=row.signature+role;if(!signature || current!==signature)reply.raw.write('event: refresh\ndata: {}\n\n');else reply.raw.write(': heartbeat\n\n');signature=current;}catch{reply.raw.write('event: access-changed\ndata: {}\n\n');reply.raw.end();}finally{busy=false;}};
    const timer=setInterval(()=>{void tick();},2000);timer.unref();void tick();const close=()=>{closed=true;clearInterval(timer);streams.delete(close);reply.raw.end();};streams.add(close);request.raw.on('close',close);reply.raw.on('close',close);
  });
}
