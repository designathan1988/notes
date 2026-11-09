import { t } from '../i18n/index.js';
import { Select } from '../ui/Select.js';
import { useState } from 'react';
import { Dialog } from '../ui/Dialog.js';
import { useWorkspace } from '../state/store.js';
export function MovePage() {
  const state = useWorkspace();
  const page = state.pages.find((item) => item.id === (state.pendingMove?.id ?? state.selectedId))!;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const descendants = new Set([page.id]);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const candidate of state.pages)
      if (
        candidate.parentId &&
        descendants.has(candidate.parentId) &&
        !descendants.has(candidate.id)
      ) {
        descendants.add(candidate.id);
        expanded = true;
      }
  }
  return (
    <Dialog
      title={t('Move {{title}}', { title: page.title })}
      onClose={() => state.openDialog(null)}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          const data = new FormData(event.currentTarget);
          try {
            const parentId = String(data.get('parent')) || null;
            const moved = await state.movePage(
              page.id,
              parentId,
              parentId === state.pendingMove?.parentId ? state.pendingMove.beforeId : undefined,
              data.get('confirmed') === 'on',
            );
            if (moved) state.openDialog(null);
            else setError('Confirm the access change to continue.');
            setBusy(false);
          } catch (error) {
            setError((error as Error).message);
            setBusy(false);
          }
        }}
      >
        <label>
          {t('Destination')}
          <Select
            name="parent"
            defaultValue={(state.pendingMove ? state.pendingMove.parentId : page.parentId) ?? ''}
          >
            {!page.templateRootId && <option value="">{t('Workspace root')}</option>}
            {state.pages
              .filter(
                (item) =>
                  item.kind !== 'database' &&
                  !descendants.has(item.id) &&
                  (item.templateRootId ?? null) === (page.templateRootId ?? null),
              )
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
          </Select>
        </label>
        <label className="checkbox-label">
          <input name="confirmed" type="checkbox" />
          {t('I understand that moving between roots may change who can access this page.')}
        </label>
        {error && (
          <p className="form-error" role="alert">
            {t(error)}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {t('Move page')}
        </button>
      </form>
    </Dialog>
  );
}
