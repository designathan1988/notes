import { t } from '../i18n/index.js';
import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../state/store.js';
import { pageView } from '../workbench/route.js';

/**
 * The page's own thread, drawn in the margin: one tick per heading (the longer the tick, the
 * higher the heading) and one knot per page this note connects to. The thread is the note's
 * shape at a glance; hovering names a mark, a click travels there. Labels arrive at once and
 * linger a moment after the pointer leaves, so sweeping along the thread never flickers.
 */
export function ConnectionThread() {
  const outline = useWorkspace((state) => state.outline);
  const links = useWorkspace((state) => state.linkedPageIds);
  const pages = useWorkspace((state) => state.pages);
  const [active, setActive] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const leave = useRef(0);
  const connected = links
    .map((id) => pages.find((page) => page.id === id))
    .filter((page): page is NonNullable<typeof page> => !!page);

  // The heading being read is the last one that has passed the upper third of the view.
  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>('.document-scroll');
    if (!scroller) return;
    const spy = () => {
      const limit = scroller.getBoundingClientRect().top + scroller.clientHeight / 3;
      const headings = scroller.querySelectorAll('.note-editor :is(h1, h2, h3)');
      let current = 0;
      headings.forEach((heading, index) => {
        if (heading.getBoundingClientRect().top <= limit) current = index;
      });
      setActive(current);
    };
    spy();
    scroller.addEventListener('scroll', spy, { passive: true });
    return () => scroller.removeEventListener('scroll', spy);
  }, [outline.length]);

  if (outline.length + connected.length < 2) return null;
  const enter = (id: string) => {
    window.clearTimeout(leave.current);
    setHover(id);
  };
  const exit = () => {
    window.clearTimeout(leave.current);
    leave.current = window.setTimeout(() => setHover(null), 260);
  };
  return (
    <nav className="connection-thread" aria-label={t('Page thread')} onPointerLeave={exit}>
      {outline.length > 0 && <h4 className="thread-heading">{t('On this page')}</h4>}
      {outline.map((heading, index) => {
        const id = `h${index}`;
        return (
          <button
            key={id}
            className="thread-tick"
            data-level={heading.level}
            data-active={index === active || undefined}
            data-hover={hover === id || undefined}
            aria-label={heading.text}
            onPointerEnter={() => enter(id)}
            onFocus={() => enter(id)}
            onBlur={exit}
            onClick={() => useWorkspace.getState().requestEditor({ heading: index })}
          >
            <span className="thread-label">{heading.text || t('Untitled')}</span>
          </button>
        );
      })}
      {connected.length > 0 && <span className="thread-gap" aria-hidden="true" />}
      {connected.length > 0 && <h4 className="thread-heading">{t('Connections')}</h4>}
      {connected.map((page) => {
        const id = `p${page.id}`;
        return (
          <button
            key={id}
            className="thread-knot"
            data-kind={page.kind}
            data-hover={hover === id || undefined}
            aria-label={t('Open {{title}}', { title: page.title })}
            onPointerEnter={() => enter(id)}
            onFocus={() => enter(id)}
            onBlur={exit}
            onClick={() => useWorkspace.getState().navigate(page.id, pageView(page.kind))}
          >
            <span className="thread-label">{page.title || t('Untitled')}</span>
          </button>
        );
      })}
    </nav>
  );
}
