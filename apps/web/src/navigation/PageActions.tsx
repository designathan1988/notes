import { t } from '../i18n/index.js';
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
  LayoutTemplate,
  Files,
  Search,
  Maximize2,
  Users,
  PanelRight,
} from 'lucide-react';
import type { Page } from '@note/contracts';
import { useWorkspace } from '../state/store.js';
import { Popover } from '../ui/Popover.js';
import { download } from '../settings/DataSettings.js';
import { pageView } from '../workbench/route.js';
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
    <Popover label={t('Page actions')} anchor={anchor} close={close}>
      <div className="menu-list">
        <button onClick={() => run(() => state.openDialog('invite'))}>
          <Users />
          {t('Invite to workspace')}
        </button>
        {['document', 'record'].includes(page.kind) && (
          <>
            <button
              onClick={() =>
                run(() => {
                  state.navigate(page.id);
                  useWorkspace.getState().requestEditor('find');
                })
              }
            >
              <Search />
              {t('Find in page')}
            </button>
            {!readOnly && (
              <button
                onClick={() =>
                  run(() => {
                    state.navigate(page.id);
                    useWorkspace.getState().requestEditor('templates');
                  })
                }
              >
                <LayoutTemplate />
                {t('Insert template')}
              </button>
            )}
            <button
              onClick={() =>
                run(() => {
                  state.navigate(page.id);
                  useWorkspace.getState().toggleFocusMode();
                })
              }
            >
              <Maximize2 />
              {state.focusMode ? t('Leave focus mode') : t('Enter focus mode')}
            </button>
            <hr />
          </>
        )}
        <button onClick={() => run(() => state.openTab(page.id))}>
          <ExternalLink />
          {t('Open in new tab')}
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
          {t('Rename')}
        </button>
        <button onClick={() => run(() => state.toggleFavorite(page.id))}>
          <Star />
          {state.favorites.includes(page.id) ? t('Remove favorite') : t('Add to favorites')}
        </button>
        <button
          disabled={readOnly || page.kind === 'database'}
          onClick={() => run(() => state.createQuickPage(page.id))}
        >
          <Plus />
          {t('Add subpage')}
        </button>
        <button
          disabled={readOnly || page.kind === 'record' || page.templateRootId === page.id}
          onClick={() => {
            close();
            state.navigate(page.id);
            state.openDialog('move');
          }}
        >
          <FolderInput />
          {t('Move page')}
        </button>
        <button
          onClick={() =>
            run(() =>
              navigator.clipboard.writeText(
                `${location.origin}/#${page.id}/${pageView(page.kind)}`,
              ),
            )
          }
        >
          <Copy />
          {t('Copy page link')}
        </button>
        <button
          disabled={readOnly || !!state.copyBusy}
          onClick={() =>
            run(() => state.copyPage({ operation: 'duplicate', sourceId: page.id }).then(() => {}))
          }
        >
          <Files />
          {page.templateRootId === page.id ? t('Duplicate template') : t('Duplicate page')}
        </button>
        {!page.templateRootId && (
          <button
            disabled={readOnly || !!state.copyBusy}
            onClick={() => run(() => state.openSaveTemplate(page.id))}
          >
            <LayoutTemplate />
            {t('Save as template')}
          </button>
        )}
        <button
          onClick={() => run(() => download(`/api/pages/${page.id}/markdown`, page.title + '.md'))}
        >
          <FileText />
          {t('Export text as Markdown')}
        </button>
        <hr />
        <button
          onClick={() =>
            run(() => {
              state.navigate(page.id);
              state.openPagePanel('details');
            })
          }
        >
          <PanelRight />
          {t('Page details')}
        </button>
        <button
          onClick={() =>
            run(() => {
              state.navigate(page.id);
              state.openPagePanel('discussion');
            })
          }
        >
          <MessageSquare />
          {t('Comments')}
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
          {t('Version history')}
        </button>
        <hr />
        <button
          className="danger"
          disabled={readOnly}
          onClick={() => run(() => state.trashPage(page.id))}
        >
          <Trash2 />
          {t('Move to trash')}
        </button>
      </div>
    </Popover>
  );
}
