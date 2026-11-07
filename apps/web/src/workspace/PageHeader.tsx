import { Clock3,FileText,Database,Network } from 'lucide-react';
import type { Page } from '../../../../packages/contracts/src/index.js';
import { useWorkspace } from '../state/store.js';
export function PageHeader({page,connections=0}: {page:Page;connections?:number}) {
  const Icon = page.kind === 'database' ? Database : FileText;
  const readOnly=useWorkspace(state=>state.workspaces.find(item=>item.id===state.workspaceId)?.role==='viewer');
  return <header className="page-heading"><div className="title-row"><Icon className="page-icon"/><input key={page.id+page.title} readOnly={readOnly} aria-label="Page title" className="page-title" defaultValue={page.title} maxLength={300} onBlur={event => { if (event.target.value.trim() !== page.title) void useWorkspace.getState().updatePage(page.id,{title:event.target.value}).catch(useWorkspace.getState().setError); }}/></div>
    <input key={page.id+page.description} readOnly={readOnly} aria-label="Page description" className="page-description" placeholder="Add a description…" defaultValue={page.description} maxLength={2000} onBlur={event => { if (event.target.value !== page.description) void useWorkspace.getState().updatePage(page.id,{description:event.target.value}).catch(useWorkspace.getState().setError); }}/>
    <div className="page-meta"><span><Clock3/>Updated just now</span><span><Network/>{connections} connections</span></div>
  </header>;
}
