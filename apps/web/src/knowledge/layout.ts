import type { GraphData } from '../../../../packages/contracts/src/index.js';
import type { Point } from '../spatial/geometry.js';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from 'd3-force';
interface Particle extends SimulationNodeDatum {
  id: string;
  radius: number;
}
/** D3 mutates its inputs; only disposable geometry enters the simulation. */
export function layoutGraph(data: GraphData): Record<string, Point> {
  const nodes: Particle[] = data.nodes
    .map((node) => ({ id: node.id, radius: Math.max(42, Math.min(88, node.title.length * 3.1)) }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const ids = new Set(nodes.map((node) => node.id));
  const edges = [
    ...new Map(
      data.edges
        .filter(
          (edge) => edge.source !== edge.target && ids.has(edge.source) && ids.has(edge.target),
        )
        .map((edge) => [
          JSON.stringify([edge.source, edge.target]),
          { source: edge.source, target: edge.target },
        ]),
    ).values(),
  ].sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target));
  if (!nodes.length) return {};
  const simulation = forceSimulation(nodes)
    .stop()
    .force(
      'link',
      forceLink<Particle, (typeof edges)[number]>(edges)
        .id((node) => node.id)
        .distance(155)
        .strength(0.38),
    )
    .force('charge', forceManyBody().strength(-380))
    .force('collide', forceCollide<Particle>((node) => node.radius).iterations(2))
    .force('x', forceX(0).strength(0.025))
    .force('y', forceY(0).strength(0.035));
  simulation.tick(180);
  return Object.fromEntries(nodes.map((node) => [node.id, { x: node.x!, y: node.y! }]));
}
