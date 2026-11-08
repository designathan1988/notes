import { useEffect, useRef, useState } from 'react';
import type { GraphData } from '../../../../packages/contracts/src/index.js';
import { validPoint, type Point } from '../spatial/geometry.js';

/** The worker owns disposable physics, never canonical pages, titles, or manual placements. */
export function useGraphLayout(data: GraphData | undefined) {
  const previous = useRef('');
  const signature = data
    ? JSON.stringify([
        data.nodes.map((node) => [node.id, Math.min(29, node.title.length)]).sort(),
        data.edges.map((edge) => [edge.source, edge.target]).sort(),
      ])
    : previous.current;
  const [attempt, setAttempt] = useState(0);
  const [layout, setLayout] = useState<{
    positions: Record<string, Point>;
    pending: boolean;
    error: boolean;
  }>({ positions: {}, pending: true, error: false });
  useEffect(() => {
    if (!data) return;
    previous.current = signature;
    let current = true,
      worker: Worker | undefined;
    setLayout((value) => ({ ...value, pending: true, error: false }));
    const fail = () => {
      if (current) setLayout((value) => ({ ...value, pending: false, error: true }));
      worker?.terminate();
    };
    try {
      worker = new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' });
      worker.onerror = (event) => {
        event.preventDefault();
        fail();
      };
      worker.onmessageerror = fail;
      worker.onmessage = (event: MessageEvent<Record<string, Point>>) => {
        if (!current) return;
        if (!event.data || Object.values(event.data).some((point) => !validPoint(point))) {
          fail();
          return;
        }
        setLayout({ positions: event.data, pending: false, error: false });
        worker?.terminate();
      };
      worker.postMessage({
        nodes: data.nodes.map((node) => ({
          id: node.id,
          kind: node.kind,
          title: 'x'.repeat(Math.min(29, node.title.length)),
        })),
        edges: data.edges,
      });
    } catch {
      fail();
    }
    return () => {
      current = false;
      worker?.terminate();
    };
    // Metadata refreshes with the same geometry must not restart physics. A cleared ACL
    // projection never renders cached nodes; this cache contains coordinates and IDs only.
  }, [signature, attempt]);
  return { ...layout, retry: () => setAttempt((value) => value + 1) };
}
