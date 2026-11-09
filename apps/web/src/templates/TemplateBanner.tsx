import { LayoutTemplate, ArrowLeft } from 'lucide-react';
import type { Page } from '@note/contracts';
import { useWorkspace } from '../state/store.js';
import { useEffect } from 'react';
export function TemplateBanner({ page }: { page: Page }) {
  const root = useWorkspace((state) => state.pages.find((item) => item.id === page.templateRootId)),
    canUse = useWorkspace((state) => state.canUseTemplate(page.templateRootId ?? '')),
    version = useWorkspace((state) => state.knowledgeVersion);
  const rootId = root?.id,
    rootRevision = root?.revision,
    rootDatabase = root?.templateDatabaseId;
  useEffect(() => {
    if (rootId && rootDatabase && rootId !== page.id)
      void useWorkspace.getState().loadTemplateDefaults(rootId);
  }, [rootId, rootRevision, rootDatabase, page.id, version]);
  if (!page.templateRootId) return null;
  return (
    <section className="template-banner" aria-label="Template definition">
      <LayoutTemplate size={16} />
      <span>
        <strong>Editing template</strong>
        <small>
          {page.id === page.templateRootId
            ? `Changes apply to future copies.${!root?.templateDatabaseId ? ' New pages start private.' : ''}`
            : `Part of ${root?.title ?? 'this template'}. Changes apply to future copies.`}
        </small>
      </span>
      <button
        className="text-button"
        onClick={() => useWorkspace.getState().navigate(null, 'templates')}
      >
        <ArrowLeft size={13} />
        Library
      </button>
      <button
        className="button"
        disabled={!canUse}
        onClick={() =>
          void useWorkspace
            .getState()
            .useTemplate(page.templateRootId!)
            .catch(useWorkspace.getState().setError)
        }
      >
        Use template
      </button>
    </section>
  );
}
