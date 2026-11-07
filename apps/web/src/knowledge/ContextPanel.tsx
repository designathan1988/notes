import { X,FileText,Link2 } from 'lucide-react';
import { useWorkspace } from '../state/store.js';
import { IconButton } from '../ui/IconButton.js';
import { useEffect } from 'react';
export function ContextPanel(){
  const outline=useWorkspace(state=>state.outline);const links=useWorkspace(state=>state.linkedPageIds);const pages=useWorkspace(state=>state.pages);const selectedId=useWorkspace(state=>state.selectedId);
  const mentions=useWorkspace(state=>state.mentions[selectedId ?? '']);const load=useWorkspace(state=>state.loadMentions);
  useEffect(()=>{if(!selectedId)return;const refresh=()=>{void load(selectedId).catch(()=>{});};refresh();const timer=setInterval(refresh,3500);return()=>clearInterval(timer);},[selectedId,load]);
  const connected=links.map(id=>pages.find(page=>page.id===id)).filter((page):page is NonNullable<typeof page>=>!!page);const current=pages.find(page=>page.id===selectedId);
  return <aside className="context-panel" aria-label="Page details"><header><h2>Page details</h2><IconButton label="Close page details" onClick={()=>useWorkspace.setState({contextOpen:false})}><X/></IconButton></header>
    <section><h3>On this page</h3><nav>{outline.map((heading,index)=><button key={index} onClick={()=>document.querySelectorAll('.note-editor h1,.note-editor h2,.note-editor h3')[index]?.scrollIntoView({behavior:'smooth',block:'center'})}><FileText/>{heading.text}</button>)}</nav></section>
    <section><h3>Connections</h3><div className="local-graph"><svg viewBox="0 0 300 210" role="img" aria-label="Connected pages">{connected.slice(0,3).map((page,index)=>{const positions=[[150,30],[70,175],[235,175]];const [x,y]=positions[index];return <g key={page.id}><path d={`M150 105L${x} ${y}`} stroke="#6b9581" fill="none"/><g className="graph-node" role="link" tabIndex={0} onClick={()=>useWorkspace.getState().navigate(page.id)} onKeyDown={event=>{if(event.key==='Enter')useWorkspace.getState().navigate(page.id);}}><rect x={x-60} y={y-13} width="120" height="27" rx="6" fill="#e7f0e9" stroke="#b8cdc1"/><text x={x} y={y+4} textAnchor="middle">{page.title.length>19 ? page.title.slice(0,17)+'…' : page.title}</text></g></g>;})}<rect x="70" y="88" width="160" height="32" rx="6" fill="#dfeae2" stroke="#b8cdc1"/><text x="150" y="109" textAnchor="middle">{current?.title.slice(0,23)}</text></svg></div></section>
    <section className="mentions-section"><h3>Linked mentions</h3>{mentions?.length?mentions.map(mention=><button className="mention" key={mention.sourceId} onClick={()=>useWorkspace.getState().navigate(mention.sourceId)}><FileText/><span><strong>{mention.title}</strong><small>{mention.excerpt}</small></span></button>):<p className="muted-text">No linked mentions yet.</p>}</section><button className="context-connect" onClick={()=>document.querySelector<HTMLButtonElement>('[aria-label="Insert link"]')?.click()}><Link2/>Connect an idea</button>
  </aside>;
}
