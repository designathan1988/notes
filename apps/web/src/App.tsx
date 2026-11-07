import { useEffect } from 'react';
import { useWorkspace } from './state/store.js';
import { SignIn } from './identity/SignIn.js';
import { Workspace } from './workspace/Workspace.js';
export default function App() {
  const loading = useWorkspace(state => state.loading); const user = useWorkspace(state => state.user);
  useEffect(() => { void useWorkspace.getState().initialize();
    const online = () => useWorkspace.setState({online:navigator.onLine});
    const keys = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault();useWorkspace.getState().openDialog('search'); } };
    window.addEventListener('online',online);window.addEventListener('offline',online);window.addEventListener('keydown',keys);
    return () => { window.removeEventListener('online',online);window.removeEventListener('offline',online);window.removeEventListener('keydown',keys); };
  },[]);
  if (loading && !user) return <main className="loading-screen"><span className="brand">Note</span><p>Opening your workspace…</p></main>;
  return user ? <Workspace/> : <SignIn/>;
}
