import { useEffect } from 'react';
import { useWorkspace } from './state/store.js';
import { SignIn } from './identity/SignIn.js';
import { Workspace } from './workspace/Workspace.js';
import { WorkspaceSetup, InvitationAccept } from './identity/Onboarding.js';
import { shortcutCommand } from './workbench/commands.js';
import { AppearanceProjection } from './appearance/projection.js';
export default function App() {
  const loading = useWorkspace((state) => state.loading);
  const user = useWorkspace((state) => state.user);
  const connectionError = useWorkspace((state) => state.connectionError);
  const workspaceCount = useWorkspace((state) => state.workspaces.length);
  const invitation = new URLSearchParams(location.search).get('invite');
  useEffect(() => {
    void useWorkspace.getState().initialize();
    const online = () => useWorkspace.getState().setOnline(navigator.onLine);
    const keys = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      const command = shortcutCommand(event, useWorkspace.getState());
      if (command) {
        event.preventDefault();
        void Promise.resolve(command.run(useWorkspace.getState())).catch(
          useWorkspace.getState().setError,
        );
      }
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', online);
    window.addEventListener('keydown', keys);
    const back = () => {
      const [id, view] = location.hash.slice(1).split('/');
      useWorkspace
        .getState()
        .navigate(
          id || null,
          ['document', 'database', 'graph', 'all', 'templates', 'canvas'].includes(view)
            ? (view as import('./state/store.js').View)
            : 'document',
          'none',
        );
    };
    window.addEventListener('popstate', back);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', online);
      window.removeEventListener('keydown', keys);
      window.removeEventListener('popstate', back);
    };
  }, []);
  if (loading)
    return (
      <main className="loading-screen">
        <span className="brand">Note</span>
        <p>Opening your workspace…</p>
      </main>
    );
  if (!user && connectionError)
    return (
      <main className="loading-screen">
        <span className="brand">Note</span>
        <p>We couldn’t reach your workspace.</p>
        <button
          className="button primary"
          onClick={() => void useWorkspace.getState().initialize()}
        >
          Retry connection
        </button>
      </main>
    );
  return user ? (
    invitation ? (
      <InvitationAccept id={invitation} />
    ) : !workspaceCount ? (
      <WorkspaceSetup />
    ) : (
      <>
        <AppearanceProjection />
        <Workspace />
      </>
    )
  ) : (
    <SignIn />
  );
}
