import type { Page } from '@note/contracts';
import type { WorkspaceState } from '../state/store.js';
import type { CopyInput, PendingCopy } from './commands.js';
import { commandPreferences, type PreferenceStorage } from '../workbench/preferences.js';
import { copyKey, readCopies, sameCopy, writeCopies } from './commands.js';
import { api, ApiError, json } from '../state/api.js';
import { mergeDefinition, type TableDefinition } from '../databases/state.js';
export interface TemplateFilters {
  q?: string;
  kind?: string;
  database?: string;
}
export interface DefaultsReview {
  databaseId: string;
  templateRevision: number;
  fieldsRevision: number;
  issues: { fieldId: string; name: string; message: string }[];
}
export interface TemplateSlice {
  setTemplateFilters(filters: TemplateFilters): void;
  closeTemplateDialog(): void;
  templateIds: string[];
  templateFilters: TemplateFilters;
  templateCursor: { after: string; id: string } | null;
  templateLoading: boolean;
  templateError: string | null;
  templatePreview: { pageId: string; state: string } | null;
  templateReviews: Record<string, DefaultsReview>;
  templateDefaultsErrors: Record<string, string>;
  pendingCopies: PendingCopy[];
  copyBusy: string | null;
  templateDialog: { sourceId: string } | null;
  openSaveTemplate(sourceId: string): Promise<void>;
  canUseTemplate(sourceId: string): boolean;
  useTemplate(sourceId: string): Promise<void>;
  restoreTemplateCommands(): void;
  invalidateTemplateReads(): void;
  dismissCopy(requestId: string): void;
  loadTemplates(filters?: TemplateFilters, more?: boolean): Promise<void>;
  previewTemplate(id: string): Promise<void>;
  loadTemplateDefaults(id: string): Promise<void>;
  copyPage(input: CopyInput, options?: { navigate?: boolean }): Promise<Page | null>;
}
export function templateSlice(
  set: (patch: Partial<WorkspaceState>) => void,
  get: () => WorkspaceState,
  storage: PreferenceStorage = commandPreferences,
  dependencies?: { prepareSource(user: string, workspace: string, source: string): Promise<void> },
): TemplateSlice {
  let epoch = 0,
    scopeEpoch = 0,
    listSequence = 0,
    previewSequence = 0;
  const defaultsSequences = new Map<string, number>();
  const scope = () => ({ user: get().user?.id, workspace: get().workspaceId });
  const guard = () => {
    const { user, workspace } = scope(),
      version = get().knowledgeVersion,
      generation = epoch;
    return () =>
      user === get().user?.id &&
      workspace === get().workspaceId &&
      version === get().knowledgeVersion &&
      generation === epoch;
  };
  const mergePages = (incoming: Page[]) => {
    const pages = new Map(get().pages.map((page) => [page.id, page]));
    for (const page of incoming)
      if ((pages.get(page.id)?.revision ?? -1) <= page.revision)
        pages.set(page.id, { ...pages.get(page.id), ...page });
    return [...pages.values()];
  };
  const prepare =
    dependencies?.prepareSource ??
    (async (user: string, workspace: string, source: string) => {
      const context = await api<{
        userId: string;
        workspaceId: string;
        pages: { id: string; generation: number; title: string }[];
      }>(`/pages/${source}/copy-context`);
      if (context.userId !== user || context.workspaceId !== workspace)
        throw new Error('The active account changed. Reopen the source before copying.');
      const { ensureCopySourcesSaved } = await import('../documents/session.js');
      const ids = context.pages.map((page) => page.id);
      await Promise.all([get().settlePageWrites(ids), get().settleRecordWrites(ids)]);
      await ensureCopySourcesSaved(user, workspace, context.pages);
    });
  return {
    setTemplateFilters(filters) {
      set({ templateFilters: filters });
    },
    closeTemplateDialog() {
      set({ templateDialog: null });
    },
    templateIds: [],
    templateFilters: {},
    templateCursor: null,
    templateLoading: false,
    templateError: null,
    templatePreview: null,
    templateReviews: {},
    templateDefaultsErrors: {},
    pendingCopies: [],
    copyBusy: null,
    templateDialog: null,
    async openSaveTemplate(sourceId) {
      const { user, workspace } = scope(),
        generation = scopeEpoch;
      const current = () =>
        user === get().user?.id && workspace === get().workspaceId && generation === scopeEpoch;
      try {
        await Promise.all([
          get().settlePageWrites([sourceId]),
          get().settleRecordWrites([sourceId]),
        ]);
        if (!current()) return;
        const page = await api<Page>(`/pages/${sourceId}`);
        if (current())
          set({ pages: mergePages([page]), templateDialog: { sourceId }, dialog: null });
      } catch (error) {
        if (current()) throw error;
      }
    },
    canUseTemplate(sourceId) {
      const page = get().pages.find((page) => page.id === sourceId),
        role = get().workspaces.find((item) => item.id === get().workspaceId)?.role;
      if (
        !role ||
        role === 'viewer' ||
        get().online === false ||
        get().copyBusy ||
        !page ||
        page.templateRootId !== page.id
      )
        return false;
      if (!page.templateDatabaseId) return true;
      const review = get().templateReviews[page.id];
      return (
        !!review &&
        !get().templateDefaultsErrors[page.id] &&
        !review.issues.length &&
        review.templateRevision === page.revision &&
        review.fieldsRevision === get().tables[page.templateDatabaseId]?.fieldsRevision
      );
    },
    async useTemplate(sourceId) {
      if (!get().canUseTemplate(sourceId))
        throw new Error('Review this template and its current defaults before using it.');
      const { user, workspace } = scope(),
        generation = scopeEpoch,
        source = get().pages.find((page) => page.id === sourceId)!;
      const page = await get().copyPage({
        operation: 'use',
        sourceId,
        ...(!source.templateDatabaseId ? { visibility: 'private' as const } : {}),
      });
      if (
        page &&
        generation === scopeEpoch &&
        user === get().user?.id &&
        workspace === get().workspaceId &&
        get().selectedId === page.id
      )
        get().focusPageTitle();
    },
    restoreTemplateCommands() {
      epoch++;
      scopeEpoch++;
      listSequence++;
      previewSequence++;
      defaultsSequences.clear();
      const { user, workspace } = scope();
      set({
        templateIds: [],
        templateFilters: {},
        templateCursor: null,
        templateLoading: false,
        templateError: null,
        templatePreview: null,
        templateReviews: {},
        templateDefaultsErrors: {},
        templateDialog: null,
        copyBusy: null,
        pendingCopies: user && workspace ? readCopies(storage, copyKey(user, workspace)) : [],
      });
    },
    invalidateTemplateReads() {
      epoch++;
      listSequence++;
      previewSequence++;
      defaultsSequences.clear();
      set({
        templatePreview: null,
        templateReviews: {},
        templateDefaultsErrors: {},
        templateLoading: false,
      });
    },
    dismissCopy(requestId) {
      const { user, workspace } = scope();
      if (!user || !workspace) return;
      const items = get().pendingCopies.filter((item) => item.requestId !== requestId);
      writeCopies(storage, copyKey(user, workspace), items);
      set({ pendingCopies: items });
    },
    async loadTemplates(filters = get().templateFilters, more = false) {
      const { workspace } = scope();
      if (!workspace) return;
      const valid = guard(),
        sequence = ++listSequence,
        cursor = more ? get().templateCursor : null;
      if (more && !cursor) return;
      set({
        templateFilters: filters,
        templateLoading: true,
        templateError: null,
        ...(!more ? { templateIds: [] } : {}),
      });
      try {
        const params = new URLSearchParams({ ...filters, ...(cursor ?? {}) });
        const result = await api<{
          items: Page[];
          databases: Page[];
          nextCursor: { after: string; id: string } | null;
        }>(`/workspaces/${workspace}/templates?${params}`);
        if (!valid() || sequence !== listSequence) return;
        set({
          pages: mergePages([...result.items, ...result.databases]),
          templateIds: [
            ...new Set([
              ...(more ? get().templateIds : []),
              ...result.items.map((page) => page.id),
            ]),
          ],
          templateCursor: result.nextCursor,
        });
      } catch (error) {
        if (valid() && sequence === listSequence) set({ templateError: (error as Error).message });
      } finally {
        if (valid() && sequence === listSequence) set({ templateLoading: false });
      }
    },
    async previewTemplate(id) {
      const valid = guard(),
        sequence = ++previewSequence;
      set({ templatePreview: null, templateError: null });
      try {
        const preview = await api<{ pageId: string; state: string }>(`/templates/${id}/preview`);
        if (valid() && sequence === previewSequence && get().pages.some((page) => page.id === id))
          set({ templatePreview: preview });
      } catch (error) {
        if (valid() && sequence === previewSequence)
          set({ templateError: (error as Error).message });
      }
    },
    async loadTemplateDefaults(id) {
      const valid = guard(),
        sequence = (defaultsSequences.get(id) ?? 0) + 1;
      defaultsSequences.set(id, sequence);
      const current = () => valid() && defaultsSequences.get(id) === sequence;
      try {
        const [page, review] = await Promise.all([
          api<Page>(`/pages/${id}`),
          api<TableDefinition & DefaultsReview>(`/templates/${id}/defaults`),
        ]);
        if (!current()) return;
        set({ pages: mergePages([page]) });
        if (review.templateRevision !== get().pages.find((page) => page.id === id)?.revision)
          throw new Error('This template changed during the review. Refresh its defaults.');
        const errors = { ...get().templateDefaultsErrors };
        delete errors[id];
        set({
          tables: {
            ...get().tables,
            [review.databaseId]: mergeDefinition(get().tables[review.databaseId], review),
          },
          templateReviews: {
            ...get().templateReviews,
            [id]: {
              databaseId: review.databaseId,
              templateRevision: review.templateRevision,
              fieldsRevision: review.fieldsRevision,
              issues: review.issues,
            },
          },
          templateDefaultsErrors: errors,
        });
      } catch (error) {
        if (current())
          set({
            templateDefaultsErrors: {
              ...get().templateDefaultsErrors,
              [id]: (error as Error).message,
            },
          });
      }
    },
    async copyPage(input, options = {}) {
      const { user, workspace } = scope();
      if (!user || !workspace) throw new Error('Choose a workspace first.');
      if (get().copyBusy) throw new Error('Wait for the current copy to finish.');
      const generation = scopeEpoch,
        key = copyKey(user, workspace),
        current = () =>
          generation === scopeEpoch && user === get().user?.id && workspace === get().workspaceId;
      const existing = get().pendingCopies.find((item) =>
        input.requestId ? item.requestId === input.requestId : sameCopy(item, input),
      );
      if (!existing && get().pendingCopies.length >= 10)
        throw new Error('Review your unconfirmed copies before creating another.');
      const command: PendingCopy = existing ?? { ...input, requestId: crypto.randomUUID() };
      const pending = existing ? get().pendingCopies : [...get().pendingCopies, command];
      writeCopies(storage, key, pending);
      set({ pendingCopies: pending, copyBusy: command.requestId });
      const remove = () => {
        const retained = (current() ? get().pendingCopies : readCopies(storage, key)).filter(
          (item) => item.requestId !== command.requestId,
        );
        writeCopies(storage, key, retained);
        if (current()) set({ pendingCopies: retained });
      };
      let dispatched = false,
        confirmed = false;
      try {
        if (command.sourceId) {
          try {
            await prepare(user, workspace, command.sourceId);
          } catch (error) {
            if (!(existing && error instanceof ApiError && [403, 404].includes(error.status)))
              throw error;
          }
        }
        if (!current()) return null;
        const endpoint =
          command.operation === 'blank'
            ? `/workspaces/${workspace}/templates`
            : command.operation === 'save'
              ? `/pages/${command.sourceId}/templates`
              : command.operation === 'use'
                ? `/templates/${command.sourceId}/instances`
                : `/pages/${command.sourceId}/duplicate`;
        dispatched = true;
        const result = await api<Page>(endpoint, {
          method: 'POST',
          body: json({
            requestId: command.requestId,
            expectedUserId: user,
            title: command.title,
            visibility: command.visibility,
            parentId: command.parentId,
          }),
        });
        confirmed = true;
        remove();
        if (!current()) return null;
        let page: Page;
        try {
          page = await api<Page>(`/pages/${result.id}`);
        } catch {
          throw new Error(
            'The copy was created, but could not be opened. Refresh the workspace to find it.',
          );
        }
        if (!current()) return null;
        set({ pages: mergePages([page]) });
        await get().reload();
        if (!current()) return null;
        const visible = get().pages.find((item) => item.id === page.id);
        if (!visible)
          throw new Error(
            'The copy was created, but could not be opened. Refresh the workspace to find it.',
          );
        set({ templateDialog: null });
        if (options.navigate !== false)
          get().navigate(visible.id, visible.kind === 'database' ? 'database' : 'document');
        return visible;
      } catch (error) {
        if (
          !confirmed &&
          ((!dispatched && !existing) ||
            (dispatched && error instanceof ApiError && error.status < 500))
        )
          remove();
        if (current()) throw error;
        return null;
      } finally {
        if (!dispatched && !existing) remove();
        if (current() && get().copyBusy === command.requestId) set({ copyBusy: null });
      }
    },
  };
}
