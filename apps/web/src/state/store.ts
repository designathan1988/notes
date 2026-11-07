import { create } from 'zustand';
import { api, ApiError, json } from './api.js';
import type { Page, SaveStatus, Workspace } from '../../../../packages/contracts/src/index.js';
import { databaseSlice,type DatabaseSlice } from '../databases/state.js';
import { knowledgeSlice,type KnowledgeSlice } from '../knowledge/state.js';
type User = { id: string; name: string; email: string };
export type View = 'document' | 'database' | 'graph' | 'all';
export type Dialog = 'search' | 'new-page' | 'page-menu' | 'settings' | 'invite' | 'move' | null;
export interface WorkspaceState extends DatabaseSlice,KnowledgeSlice {
  user: User | null; workspaces: Workspace[]; workspaceId: string | null; pages: Page[]; selectedId: string | null;
  view: View; loading: boolean; error: string | null; dialog: Dialog; sidebarOpen: boolean; contextOpen: boolean;
  saveStatus: SaveStatus; expanded: string[]; favorites: string[]; online: boolean;
  outline:{level:number;text:string}[]; linkedPageIds:string[];
  initialize(): Promise<void>; reload(): Promise<void>; chooseWorkspace(id: string): Promise<void>;
  navigate(id: string | null, view?: View): void; openDialog(dialog: Dialog): void; setError(error: unknown): void;
  createPage(input: { title: string; parentId?: string; kind?: 'document' | 'database'; visibility?: 'workspace' | 'private' }): Promise<void>;
  updatePage(id: string, patch: { title?: string; description?: string }): Promise<void>; trashPage(id: string): Promise<void>;
  toggleExpanded(id: string): void; toggleFavorite(id: string): void; signOut(): Promise<void>;
}
export const useWorkspace = create<WorkspaceState>((set,get) => ({
  ...databaseSlice(set,get),...knowledgeSlice(set,get),
  user: null, workspaces: [], workspaceId: null, pages: [], selectedId: null, view: 'document', loading: true, error: null,
  dialog: null, sidebarOpen: false, contextOpen: true, saveStatus: 'connecting', expanded: [], favorites: [], online: true,outline:[],linkedPageIds:[],
  async initialize() {
    try {
      const session = await api<{ user: User; workspaces: Workspace[] }>('/session');
      set({ user: session.user, workspaces: session.workspaces });
      if (session.workspaces.length) await get().chooseWorkspace(session.workspaces[0].id);
    } catch (error) { if (!(error instanceof ApiError && error.status === 401)) get().setError(error); }
    finally { set({ loading: false }); }
  },
  async chooseWorkspace(workspaceId) {
    set({ workspaceId, pages: [], selectedId: null, loading: true,tables:{},graphs:{},mentions:{},searchResults:[] });
    try {
      const pages = await api<Page[]>(`/workspaces/${workspaceId}/pages`);
      const fromHash = location.hash.slice(1).split('/');
      const selected = pages.find(page => page.id === fromHash[0]) ?? pages.find(page => page.title === 'Product direction') ?? pages[0];
      set({ pages, expanded: pages.filter(page => page.parentId === null).map(page => page.id), favorites: pages.filter(page => page.kind!=='record' && ['Product direction','Design principles'].includes(page.title)).map(page => page.id) });
      get().navigate(selected?.id ?? null, (['document','database','graph','all'].includes(fromHash[1]) ? fromHash[1] : 'document') as View);
    } catch (error) { get().setError(error); } finally { set({ loading: false }); }
  },
  async reload() {
    const id = get().workspaceId; if (!id) return;
    try { const pages = await api<Page[]>(`/workspaces/${id}/pages`); if (get().workspaceId === id) set({ pages }); }
    catch (error) { if (error instanceof ApiError && [401,403].includes(error.status)) set({ pages: [], selectedId: null }); get().setError(error); }
  },
  navigate(id,view = 'document') { set({ selectedId: id, view, sidebarOpen: false, dialog: null }); history.replaceState(null,'',`#${id ?? ''}/${view}`);if(id && !get().pages.some(page=>page.id===id)){const user=get().user?.id;const workspace=get().workspaceId;void api<Page>(`/pages/${id}`).then(page=>{if(get().user?.id===user && get().workspaceId===workspace && page.workspaceId===workspace)set({pages:[...get().pages.filter(item=>item.id!==id),page]});}).catch(get().setError);} },
  openDialog(dialog) { set({ dialog }); },
  setError(error) { set({ error: error instanceof Error ? error.message : String(error) }); },
  async createPage(input) {
    const id = get().workspaceId; if (!id) return;
    const page = await api<Page>(`/workspaces/${id}/pages`,{ method:'POST', body:json(input) });
    await get().reload(); set({ expanded: [...new Set([...get().expanded,...(page.parentId ? [page.parentId] : [])])] });
    get().navigate(page.id,page.kind === 'database' ? 'database' : 'document');
  },
  async updatePage(id,patch) {
    const current = get().pages.find(page => page.id === id); if (!current) return;
    const page = await api<Page>(`/pages/${id}`,{ method:'PATCH',body:json({ ...patch,revision:current.revision }) });
    set({ pages:get().pages.map(item => item.id === id ? page : item) });
  },
  async trashPage(id) { await api(`/pages/${id}`,{ method:'DELETE' }); await get().reload(); get().navigate(get().pages[0]?.id ?? null); },
  toggleExpanded(id) { set({ expanded:get().expanded.includes(id) ? get().expanded.filter(item => item !== id) : [...get().expanded,id] }); },
  toggleFavorite(id) { set({ favorites:get().favorites.includes(id) ? get().favorites.filter(item => item !== id) : [...get().favorites,id] }); },
  async signOut() {
    await api('/auth/sign-out',{ method:'POST',body:'{}' });
    // Recovery sessions clear their IndexedDB cache when the identity disappears.
    set({ user:null,pages:[],workspaceId:null,selectedId:null,dialog:null,workspaces:[],favorites:[],expanded:[],tables:{},graphs:{},mentions:{},searchResults:[],outline:[],linkedPageIds:[] });
  },
}));
