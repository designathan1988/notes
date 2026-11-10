import { t, formatDate, formatNumber } from '../i18n/index.js';
import { AlignLeft, Clock3, FileText, Database, Shapes, ChevronDown, Undo2 } from 'lucide-react';
import { usePageStatistics } from '../documents/statistics.js';
import type { Page } from '@note/contracts';
import { useWorkspace } from '../state/store.js';
import { useEffect, useLayoutEffect, useRef, useState, useEffectEvent } from 'react';
import { PagePresentation, PageTags } from '../pages/PagePresentation.js';
import { PageProperties } from '../pages/PageProperties.js';
import { MosaicPattern } from '../ui/MosaicPattern.js';
function fit(element: HTMLTextAreaElement) {
  // An empty description that is not being written takes no room (see sinapta-system.css).
  if (
    !element.value &&
    document.activeElement !== element &&
    element.classList.contains('page-description')
  ) {
    element.style.height = '';
    return;
  }
  element.style.height = 'auto';
  element.style.height = element.scrollHeight + 'px';
}
/** "hoje, 09:42", "ontem, 18:10" or a short date, the way the design writes edits. */
function edited(iso: string) {
  const date = new Date(iso),
    today = new Date();
  const time = formatDate(date, { hour: '2-digit', minute: '2-digit' });
  const days = Math.round(
    (new Date(today.toDateString()).getTime() - new Date(date.toDateString()).getTime()) / 86400000,
  );
  if (days === 0) return t('today, {{time}}', { time });
  if (days === 1) return t('yesterday, {{time}}', { time });
  return formatDate(date, { day: 'numeric', month: 'short', year: 'numeric' });
}

const kindNames: Record<string, string> = {
  document: 'Page',
  database: 'Database',
  canvas: 'Canvas',
  record: 'Record',
};

export function PageHeader({
  page,
  connections,
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
  const backlinks = useWorkspace((state) => state.mentions[page.id]?.length);
  const statistics = usePageStatistics(page.id);
  const chips = connections !== undefined;
  useEffect(() => {
    if (!chips) return;
    void useWorkspace
      .getState()
      .loadMentions(page.id)
      .catch(() => {});
  }, [page.id, chips]);
  const Icon = page.kind === 'canvas' ? Shapes : page.kind === 'database' ? Database : FileText;
  const readOnly = useWorkspace(
    (state) => state.workspaces.find((item) => item.id === state.workspaceId)?.role === 'viewer',
  );
  return (
    <header
      className={`page-heading${compact ? ' page-heading-compact' : ''}${!compact && !page.cover && page.kind === 'document' ? ' has-band' : ''}${page.cover ? ' has-cover' : ''}${editingDescription ? ' description-visible' : ''}`}
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
      {!compact && !page.cover && page.kind === 'document' && (
        <MosaicPattern className="page-band" mark />
      )}
      {/* The kind line: what this is and where it lives, with the signal dot. */}
      {!compact && (
        <nav className="page-ancestry page-kind" aria-label={t('Page ancestry')}>
          <i aria-hidden="true" />
          <span>{t(kindNames[page.kind] ?? 'Page')}</span>
          {parent && (
            <>
              <span aria-hidden="true">·</span>
              <button onClick={() => useWorkspace.getState().navigate(parent.id)}>
                {parent.title}
              </button>
            </>
          )}
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
              document.querySelector<HTMLElement>('.note-editor[role="textbox"]')?.focus();
            }
          }}
          key={page.id + page.title}
          readOnly={readOnly}
          aria-label={t('Page title')}
          className="page-title"
          rows={1}
          defaultValue={page.title}
          maxLength={300}
          onBlur={(event) => {
            if (event.target.value.trim() !== page.title)
              void useWorkspace
                .getState()
                .updatePage(page.id, { title: event.target.value })
                .catch((error) => useWorkspace.getState().setPageError(page.id, error));
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
            aria-label={t('Page description')}
            className="page-description"
            rows={1}
            placeholder={t('Add a description…')}
            defaultValue={page.description}
            maxLength={2000}
            onBlur={(event) => {
              setEditingDescription(false);
              fit(event.currentTarget);
              if (event.target.value !== page.description)
                void useWorkspace
                  .getState()
                  .updatePage(page.id, { description: event.target.value })
                  .catch((error) => useWorkspace.getState().setPageError(page.id, error));
            }}
          />
          <div className="page-metadata-row">
            <div className="page-meta">
              {/* A page's chips: when it was edited, who cites it, how long it is. Other kinds of
                  page show none of them (they would carry a stale count). */}
              {connections !== undefined && (
                <>
                  <span>
                    <Clock3 />
                    {t('Edited {{when}}', { when: edited(page.updatedAt) })}
                  </span>
                  <span className="chip-link">
                    <Undo2 />
                    <b>{formatNumber(backlinks ?? 0)}</b>
                    {t(backlinks === 1 ? 'backlink' : 'backlinks')}
                  </span>
                  {statistics && (
                    <span>
                      <AlignLeft />
                      {t(statistics.words === 1 ? '{{count}} word' : '{{count}} words', {
                        count: formatNumber(statistics.words),
                      })}
                      {' · '}
                      {t('{{count}} min', { count: formatNumber(statistics.minutes) })}
                    </span>
                  )}
                </>
              )}
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
                aria-label={t('Page properties')}
                aria-controls={`page-properties-${page.id}`}
              >
                {t('Properties')} <ChevronDown size={13} />
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
