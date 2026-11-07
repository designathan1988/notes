import { Clock3, FileText, Database, Network } from 'lucide-react';
import type { Page } from '../../../../packages/contracts/src/index.js';
import { useWorkspace } from '../state/store.js';
import { useLayoutEffect, useRef } from 'react';
function fit(element: HTMLTextAreaElement) {
  element.style.height = 'auto';
  element.style.height = element.scrollHeight + 'px';
}
export function PageHeader({ page, connections = 0 }: { page: Page; connections?: number }) {
  const title = useRef<HTMLTextAreaElement>(null),
    description = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const resize = () => {
      if (title.current) fit(title.current);
      if (description.current) fit(description.current);
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (title.current) observer.observe(title.current.parentElement!);
    return () => observer.disconnect();
  }, [page.id, page.title, page.description]);
  const Icon = page.kind === 'database' ? Database : FileText;
  const readOnly = useWorkspace(
    (state) => state.workspaces.find((item) => item.id === state.workspaceId)?.role === 'viewer',
  );
  return (
    <header className="page-heading">
      <div className="title-row">
        <Icon className="page-icon" />
        <textarea
          ref={title}
          onInput={(event) => fit(event.currentTarget)}
          key={page.id + page.title}
          readOnly={readOnly}
          aria-label="Page title"
          className="page-title"
          rows={1}
          defaultValue={page.title}
          maxLength={300}
          onBlur={(event) => {
            if (event.target.value.trim() !== page.title)
              void useWorkspace
                .getState()
                .updatePage(page.id, { title: event.target.value })
                .catch(useWorkspace.getState().setError);
          }}
        />
      </div>
      <textarea
        ref={description}
        onInput={(event) => fit(event.currentTarget)}
        key={page.id + page.description}
        readOnly={readOnly}
        aria-label="Page description"
        className="page-description"
        rows={1}
        placeholder="Add a description…"
        defaultValue={page.description}
        maxLength={2000}
        onBlur={(event) => {
          if (event.target.value !== page.description)
            void useWorkspace
              .getState()
              .updatePage(page.id, { description: event.target.value })
              .catch(useWorkspace.getState().setError);
        }}
      />
      <div className="page-meta">
        <span>
          <Clock3 />
          {new Date(page.updatedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
        <span>
          <Network />
          {connections} connections
        </span>
      </div>
    </header>
  );
}
