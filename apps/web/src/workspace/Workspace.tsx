import { Check,CloudOff,LoaderCircle,MoreHorizontal,Menu,Users,X,Plus,FileText,Database,Star,Trash2,FolderInput } from 'lucide-react';
import { useState,type FormEvent } from 'react';
import { useWorkspace } from '../state/store.js';
import { Sidebar } from '../navigation/Sidebar.js';
import { IconButton } from '../ui/IconButton.js';
import { Dialog } from '../ui/Dialog.js';
import { PageHeader } from './PageHeader.js';
import { DocumentEditor } from '../documents/Editor.js';
import { ContextPanel } from '../knowledge/ContextPanel.js';
export function Workspace() {
  const state = useWorkspace();const page = state.pages.find(item => item.id === state.selectedId);const parent = state.pages.find(item => item.id === page?.parentId);
  const status = { saved:'Saved',saving:'Saving…',connecting:'Connecting…',local:'Saved locally',error:'Save failed','read-only':'Read only' }[state.saveStatus];
  return <div className="app-shell"><Sidebar/><main className="workspace-main">
    <header className="topbar"><div className="mobile-brand"><IconButton label="Open navigation" onClick={() => useWorkspace.setState({sidebarOpen:true})}><Menu/></IconButton><span className="brand-mark"><i/><i/><i/><i/></span><b>Note</b></div>
      <div className="breadcrumb">{parent && <><span>{parent.title}</span><span>/</span></>}<strong>{page?.title ?? 'Workspace'}</strong></div>
      <div className="topbar-actions"><span className={`save-status ${state.saveStatus}`}>{state.saveStatus === 'saved' ? <Check/> : state.saveStatus === 'local' || state.saveStatus === 'error' ? <CloudOff/> : <LoaderCircle className={state.saveStatus === 'saving' ? 'spin' : ''}/>}<span>{status}</span></span><span className="avatar small">{state.user?.name[0]}</span><button className="button share-button" onClick={() => state.openDialog('invite')}><Users/>Share</button></div>
    </header>
    <div className="tabsbar"><nav aria-label="Page views">{(['document','database','graph'] as const).map(view => <button className={state.view===view ? 'active' : ''} key={view} onClick={() => state.navigate(view === 'database' && page?.kind !== 'database' ? state.pages.find(p => p.kind === 'database')?.id ?? state.selectedId : state.selectedId,view)}>{view[0].toUpperCase()+view.slice(1)}</button>)}</nav><IconButton label="Page actions" onClick={() => state.openDialog('page-menu')}><MoreHorizontal/></IconButton></div>
    {state.error && <div className="error-banner" role="alert"><span>{state.error}</span><IconButton label="Dismiss error" onClick={() => useWorkspace.setState({error:null})}><X/></IconButton></div>}
    <div className="workspace-content">{page ? <><div className="document-scroll"><article className="document-canvas"><PageHeader page={page} connections={state.linkedPageIds.length}/><DocumentEditor key={page.id} page={page}/></article></div>{state.contextOpen && <ContextPanel/>}</> : <div className="empty-state"><FileText/><h1>A little space to think.</h1><p>Create a page and make it yours.</p><button className="button primary" onClick={() => state.openDialog('new-page')}><Plus/>New page</button></div>}</div>
  </main>
  {state.dialog === 'new-page' && <NewPage/>}
  {state.dialog === 'page-menu' && page && <Dialog title="Page actions" onClose={() => state.openDialog(null)}><div className="menu-list"><button onClick={() => {state.toggleFavorite(page.id);state.openDialog(null);}}><Star/>Toggle favorite</button><button onClick={() => state.openDialog('new-page')}><Plus/>Add subpage</button><button onClick={() => state.openDialog('move')}><FolderInput/>Move page</button><button className="danger" onClick={() => void state.trashPage(page.id).catch(state.setError)}><Trash2/>Move to trash</button></div></Dialog>}
  </div>;
}
function NewPage() {
  const state = useWorkspace();const [busy,setBusy] = useState(false);const [error,setError] = useState('');
  async function submit(event:FormEvent<HTMLFormElement>) { event.preventDefault();setBusy(true);const data = new FormData(event.currentTarget);
    try {await state.createPage({title:String(data.get('title')),parentId:String(data.get('parent')) || undefined,kind:String(data.get('kind')) as 'document'|'database',visibility:String(data.get('visibility')) as 'workspace'|'private'});}catch(error){setError((error as Error).message);setBusy(false);} }
  return <Dialog title="Create a page" onClose={() => state.openDialog(null)}><form onSubmit={submit}><label>Title<input name="title" autoFocus required maxLength={300} placeholder="Untitled"/></label><label>Page type<select name="kind"><option value="document">Document</option><option value="database">Database</option></select></label><label>Location<select name="parent" defaultValue={state.pages.find(p => p.id === state.selectedId)?.kind === 'document' ? state.selectedId ?? '' : ''}><option value="">Workspace root</option>{state.pages.filter(p => p.kind !== 'database').map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label><label>Root visibility<select name="visibility"><option value="workspace">Everyone in this workspace</option><option value="private">Private to me</option></select><small>Subpages inherit their root page’s access.</small></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary" disabled={busy}><Plus/>Create page</button></form></Dialog>;
}
