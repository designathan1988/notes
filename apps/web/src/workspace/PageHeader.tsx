import { Clock3, FileText, Database, Network, Shapes, ChevronDown } from 'lucide-react';
import type { Page } from '@note/contracts';
import { useWorkspace } from '../state/store.js';
import { useLayoutEffect, useRef, useState, useEffectEvent } from 'react';
import { PagePresentation, PageTags } from '../pages/PagePresentation.js';
import { PageProperties } from '../pages/PageProperties.js';
function fit(element: HTMLTextAreaElement) {
  element.style.height = 'auto';
  element.style.height = element.scrollHeight + 'px';
}
export function PageHeader({
  page,
  connections = 0,
  compact = false,
}: {
  page: Page;
  connections?: number;
  compact?: boolean;
}) {
  const title = useRef<HTMLTextAreaElement>(null),
    description = useRef<HTMLTextAreaElement>(null),
    metadata = useRef<HTMLDetailsElement>(null);
  const [editingDescription, setEditingDescription] = useState(false);
  // Details open by what the page holds when it is opened; later edits keep the person's choice.
  const hasDetails = useEffectEvent(
    () =>
      page.kind === 'record' ||
      !!page.templateDatabaseId ||
      !!page.tags?.length ||
      !!page.properties?.fields.some((field) => !field.archived),
  );
  useLayoutEffect(() => {
    if (metadata.current) {
      metadata.current.open = hasDetails();
      metadata.current
        .querySelector('summary')
        ?.setAttribute('aria-expanded', String(metadata.current.open));
    }
  }, [page.id]);
  const focusTitleId = useWorkspace((state) => state.focusTitleId);
  useLayoutEffect(() => {
    if (focusTitleId === page.id && title.current) {
      title.current.focus();
      title.current.select();
      useWorkspace.getState().clearTitleFocus();
    }
  }, [focusTitleId, page.id]);
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
  const parent = useWorkspace((state) => state.pages.find((item) => item.id === page.parentId));
  const Icon = page.kind === 'canvas' ? Shapes : page.kind === 'database' ? Database : FileText;
  const readOnly = useWorkspace(
    (state) => state.workspaces.find((item) => item.id === state.workspaceId)?.role === 'viewer',
  );
  return (
    <header
      className={`page-heading${compact ? ' page-heading-compact' : ''}${editingDescription ? ' description-visible' : ''}`}
    >
      {!compact && (
        <PagePresentation
          key={`presentation-${page.id}`}
          page={page}
          readOnly={readOnly}
          showDescription={() => {
            setEditingDescription(true);
            requestAnimationFrame(() => description.current?.focus());
          }}
          showProperties={() => {
            if (metadata.current) {
              metadata.current.open = true;
              metadata.current.querySelector<HTMLElement>('summary')?.focus();
            }
          }}
        />
      )}
      {parent && !compact && (
        <nav className="page-ancestry" aria-label="Page ancestry">
          <button onClick={() => useWorkspace.getState().navigate(parent.id)}>
            {parent.title}
          </button>
          <span>/</span>
        </nav>
      )}
      <div className="title-row">
        {page.icon ? (
          <span className="page-icon page-emoji">{page.icon}</span>
        ) : (
          <Icon className="page-icon default-page-icon" />
        )}
        <textarea
          ref={title}
          onInput={(event) => fit(event.currentTarget)}
          onKeyDown={(event) => {
            if (event.key === 'Tab' && !event.shiftKey && !compact) {
              event.preventDefault();
              setEditingDescription(true);
              requestAnimationFrame(() => description.current?.focus());
            } else if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
              document.querySelector<HTMLElement>('[aria-label="Page content"]')?.focus();
            }
          }}
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
      {!compact && (
        <>
          <textarea
            ref={description}
            onFocus={(event) => {
              setEditingDescription(true);
              fit(event.currentTarget);
            }}
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
              setEditingDescription(false);
              if (event.target.value !== page.description)
                void useWorkspace
                  .getState()
                  .updatePage(page.id, { description: event.target.value })
                  .catch(useWorkspace.getState().setError);
            }}
          />
          <div className="page-metadata-row">
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
            <details
              ref={metadata}
              className="page-properties-disclosure"
              onToggle={(event) =>
                event.currentTarget
                  .querySelector('summary')
                  ?.setAttribute('aria-expanded', String(event.currentTarget.open))
              }
            >
              <summary
                role="button"
                aria-label="Page properties"
                aria-controls={`page-properties-${page.id}`}
              >
                Properties <ChevronDown size={13} />
              </summary>
              <div className="page-metadata-content" id={`page-properties-${page.id}`}>
                <PageTags key={`tags-${page.id}`} page={page} readOnly={readOnly} />
                <PageProperties key={`properties-${page.id}`} page={page} readOnly={readOnly} />
              </div>
            </details>
          </div>
        </>
      )}
    </header>
  );
}
