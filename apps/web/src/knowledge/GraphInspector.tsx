import { formatNumber, t } from '../i18n/index.js';
import { ArrowRight, PinOff, X } from 'lucide-react';
import type { GraphData } from '@note/contracts';
import { useWorkspace } from '../state/store.js';

const kindNames: Record<string, string> = {
  document: 'Page',
  database: 'Database',
  canvas: 'Canvas',
  record: 'Record',
};

/** The selected page, docked at the right of the graph as the Grafo board draws it. */
export function GraphInspector({
  node,
  nodes,
  edges,
  placed,
  onOpen,
  onFocus,
  onRelease,
  onClose,
}: {
  node: GraphData['nodes'][number];
  nodes: GraphData['nodes'];
  edges: GraphData['edges'];
  placed: boolean;
  onOpen(node: GraphData['nodes'][number]): void;
  onFocus(): void;
  onRelease(): void;
  onClose(): void;
}) {
  const page = useWorkspace((state) => state.pages.find((item) => item.id === node.id));
  const parent = useWorkspace((state) => state.pages.find((item) => item.id === page?.parentId));
  const incoming = edges.filter((edge) => edge.target === node.id);
  const outgoing = edges.filter((edge) => edge.source === node.id);
  const related = new Set([
    ...incoming.map((edge) => edge.source),
    ...outgoing.map((edge) => edge.target),
  ]);
  const linked = nodes.filter((item) => related.has(item.id));
  return (
    <aside className="graph-inspector" data-spatial-control aria-label={t('Graph connections')}>
      <header>
        <div className="graph-inspector-kind" data-kind={node.kind}>
          <i aria-hidden="true" />
          {t(kindNames[node.kind] ?? 'Page')}
          {parent && ` · ${parent.title || t('Untitled')}`}
        </div>
        <h3>{node.title || t('Untitled')}</h3>
        <button
          className="graph-inspector-close"
          aria-label={t('Close graph connections')}
          title={t('Close graph connections')}
          onClick={onClose}
        >
          <X />
        </button>
      </header>
      {page?.description && <p>{page.description}</p>}
      <div className="graph-stats">
        <div>
          <b>{formatNumber(related.size)}</b>
          <small>{t(related.size === 1 ? 'connection' : 'connections')}</small>
        </div>
        <div>
          <b>{formatNumber(incoming.length)}</b>
          <small>{t('incoming')}</small>
        </div>
        <div>
          <b>{formatNumber(outgoing.length)}</b>
          <small>{t('outgoing')}</small>
        </div>
      </div>
      <section>
        <h5>{t('Linked to')}</h5>
        {linked.length > 0 ? (
          <ul className="graph-linked">
            {linked.slice(0, 8).map((item) => (
              <li key={item.id}>
                <button data-kind={item.kind} onClick={() => onOpen(item)}>
                  <i aria-hidden="true" />
                  <span>{item.title || t('Untitled')}</span>
                  <small>
                    {incoming.some((edge) => edge.source === item.id) &&
                    outgoing.some((edge) => edge.target === item.id)
                      ? t('Both')
                      : incoming.some((edge) => edge.source === item.id)
                        ? t('Incoming')
                        : t('Outgoing')}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('No links yet. Link this page from another note to connect it.')}</p>
        )}
        {linked.length > 8 && (
          <p>
            {linked.length - 8}
            {t('more · Focus connections to explore')}
          </p>
        )}
      </section>
      <div className="graph-inspector-actions">
        <button className="button primary" onClick={() => onOpen(node)}>
          {t('Open page')}
          <ArrowRight />
        </button>
        <button className="button" aria-label={t('Focus connections')} onClick={onFocus}>
          {t('Focus')}
        </button>
        {placed && (
          <button
            className="button quiet"
            aria-label={t('Release node position')}
            title={t('Release node position')}
            onClick={onRelease}
          >
            <PinOff />
          </button>
        )}
      </div>
    </aside>
  );
}
