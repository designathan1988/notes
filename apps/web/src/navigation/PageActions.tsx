import {
  Copy,
  ExternalLink,
  FileText,
  FolderInput,
  Plus,
  Star,
  Trash2,
  Type,
  History,
  MessageSquare,
} from 'lucide-react';
import type { Page } from '../../../../packages/contracts/src/index.js';
import { useWorkspace } from '../state/store.js';
import { Popover } from '../ui/Popover.js';
import { download } from '../settings/DataSettings.js';
export function PageActions({
  page,
  anchor,
  close,
}: {
  page: Page;
  anchor: HTMLElement | null;
  close(): void;
}) {
  const state = useWorkspace(),
    readOnly = state.workspaces.find((item) => item.id === state.workspaceId)?.role === 'viewer';
  const run = (action: () => void | Promise<void>) => {
    close();
    void Promise.resolve(action()).catch(useWorkspace.getState().setError);
  };
  return (
    <Popover label="Page actions" anchor={anchor} close={close}>
      <div className="menu-list">
        <button onClick={() => run(() => state.openTab(page.id))}>
          <ExternalLink />
          Open in new tab
        </button>
        <button
          disabled={readOnly}
          onClick={() =>
            run(() => {
              state.navigate(page.id);
              state.focusPageTitle();
            })
          }
        >
          <Type />
          Rename
        </button>
        <button onClick={() => run(() => state.toggleFavorite(page.id))}>
          <Star />
          {state.favorites.includes(page.id) ? 'Remove favorite' : 'Add to favorites'}
        </button>
        <button
          disabled={readOnly || page.kind !== 'document'}
          onClick={() => run(() => state.createQuickPage(page.id))}
        >
          <Plus />
          Add subpage
        </button>
        <button
          disabled={readOnly || page.kind === 'record'}
          onClick={() => {
            close();
            state.navigate(page.id);
            state.openDialog('move');
          }}
        >
          <FolderInput />
          Move page
        </button>
        <button
          onClick={() =>
            run(() =>
              navigator.clipboard.writeText(
                `${location.origin}/#${page.id}/${page.kind === 'database' ? 'database' : 'document'}`,
              ),
            )
          }
        >
          <Copy />
          Copy page link
        </button>
        <button
          onClick={() => run(() => download(`/api/pages/${page.id}/markdown`, page.title + '.md'))}
        >
          <FileText />
          Export text as Markdown
        </button>
        <hr />
        <button
          onClick={() =>
            run(() => {
              state.navigate(page.id);
              state.openPagePanel('discussion');
            })
          }
        >
          <MessageSquare />
          Comments
        </button>
        <button
          onClick={() =>
            run(() => {
              state.navigate(page.id);
              state.openPagePanel('history');
            })
          }
        >
          <History />
          Version history
        </button>
        <hr />
        <button
          className="danger"
          disabled={readOnly}
          onClick={() => run(() => state.trashPage(page.id))}
        >
          <Trash2 />
          Move to trash
        </button>
      </div>
    </Popover>
  );
}
