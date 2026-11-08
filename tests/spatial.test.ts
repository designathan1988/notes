import { expect, test } from 'vitest';
import {
  fitCamera,
  screenToWorld,
  worldToScreen,
  zoomAt,
  pinchCamera,
} from '../apps/web/src/spatial/geometry.js';
import { layoutGraph } from '../apps/web/src/knowledge/layout.js';
import type { GraphData } from '../packages/contracts/src/index.js';
import { graphLabels } from '../apps/web/src/knowledge/labels.js';

test('spatial transforms round-trip at different viewport sizes and zoom around the actual pointer', () => {
  for (const size of [
    { width: 1200, height: 700 },
    { width: 360, height: 540 },
  ]) {
    const camera = { x: -140, y: 92, zoom: 0.67 },
      point = { x: 211, y: 43 };
    const screen = worldToScreen(point, camera, size);
    expect(screenToWorld(screen, camera, size).x).toBeCloseTo(point.x);
    expect(screenToWorld(screen, camera, size).y).toBeCloseTo(point.y);
    const next = zoomAt(camera, size, screen, 1.7);
    expect(worldToScreen(point, next, size).x).toBeCloseTo(screen.x);
    expect(worldToScreen(point, next, size).y).toBeCloseTo(screen.y);
    expect(zoomAt(camera, size, screen, 100).zoom).toBe(3);
  }
});

test('two-finger pinch keeps its world anchor under the moving midpoint, including zoom limits', () => {
  const size = { width: 360, height: 600 },
    camera = { x: 10, y: -20, zoom: 1 };
  const start = [
    { x: 60, y: 100 },
    { x: 160, y: 100 },
  ] as const;
  const current = [
    { x: 30, y: 150 },
    { x: 230, y: 150 },
  ] as const;
  const anchor = screenToWorld({ x: 110, y: 100 }, camera, size);
  const next = pinchCamera(camera, size, start, current);
  expect(next.zoom).toBe(2);
  expect(worldToScreen(anchor, next, size)).toEqual({ x: 130, y: 150 });
  expect(
    pinchCamera(camera, size, start, [
      { x: -2000, y: 200 },
      { x: 2000, y: 200 },
    ]).zoom,
  ).toBe(3);
});

test('fit camera contains all graph labels on desktop and mobile, with safe empty and single-node views', () => {
  const points = [
    { x: -480, y: -170 },
    { x: 550, y: 420 },
  ];
  for (const size of [
    { width: 1200, height: 700 },
    { width: 320, height: 480 },
  ]) {
    const camera = fitCamera(points, size, 70);
    for (const point of points) {
      const screen = worldToScreen(point, camera, size);
      expect(screen.x).toBeGreaterThanOrEqual(20);
      expect(screen.x).toBeLessThanOrEqual(size.width - 20);
      expect(screen.y).toBeGreaterThanOrEqual(20);
      expect(screen.y).toBeLessThanOrEqual(size.height - 20);
    }
  }
  expect(fitCamera([], { width: 0, height: 0 })).toEqual({ x: 0, y: 0, zoom: 1 });
  expect(fitCamera([{ x: 100, y: 80 }], { width: 360, height: 500 }).zoom).toBeLessThanOrEqual(1);
});

test('force layout is deterministic, finite and immutable for cycles, disconnected nodes and invalid edges', () => {
  const data: GraphData = {
    nodes: ['c', 'a', 'b', 'alone'].map((id) => ({ id, title: id, kind: 'document' })),
    edges: [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'c', target: 'a' },
      { source: 'a', target: 'a' },
      { source: 'missing', target: 'c' },
    ],
  };
  const before = structuredClone(data),
    first = layoutGraph(data);
  expect(first).toEqual(
    layoutGraph({ nodes: [...data.nodes].reverse(), edges: [...data.edges].reverse() }),
  );
  expect(data).toEqual(before);
  expect(Object.keys(first).sort()).toEqual(['a', 'alone', 'b', 'c']);
  for (const point of Object.values(first))
    expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
  expect(first.a).not.toEqual(first.b);
  expect(layoutGraph({ nodes: [], edges: [] })).toEqual({});
});

test('graph labels prioritize the selected note and remove overlapping narrow-view labels without moving nodes', () => {
  const nodes = [
    { id: 'neighbor', title: 'Design principles', x: 30, y: 0, priority: 1 },
    { id: 'selected', title: 'Product direction', x: 0, y: 0, priority: 0 },
    { id: 'far', title: 'Reading room', x: -400, y: 200, priority: 1 },
  ];
  const before = structuredClone(nodes);
  const labels = graphLabels(nodes, { x: 0, y: 0, zoom: 0.3 }, { width: 360, height: 600 });
  expect(labels.has('selected')).toBe(true);
  expect(labels.has('neighbor')).toBe(false);
  expect(labels.has('far')).toBe(true);
  expect(
    graphLabels([...nodes].reverse(), { x: 0, y: 0, zoom: 0.3 }, { width: 360, height: 600 }),
  ).toEqual(labels);
  expect(nodes).toEqual(before);
  const desktop = graphLabels(nodes, { x: 0, y: 0, zoom: 3 }, { width: 1536, height: 1000 });
  expect(desktop.has('selected')).toBe(true);
  expect(graphLabels([], { x: 0, y: 0, zoom: 1 }, { width: 360, height: 600 }).size).toBe(0);
});

test('the active graph label moves clear of another node instead of covering its circle', () => {
  const labels = graphLabels(
    [
      { id: 'active', title: 'Product direction', x: 0, y: 0, priority: 0 },
      { id: 'below', title: 'Research', x: 0, y: 22, priority: 1 },
    ],
    { x: 0, y: 0, zoom: 1 },
    { width: 360, height: 600 },
  );
  const baseline = labels.get('active')!;
  expect(Number.isFinite(baseline)).toBe(true);
  expect(baseline - 13 >= 31 || baseline + 4 <= 13).toBe(true);
});

test('fit includes all 180 permitted disconnected graph nodes on a narrow viewport', () => {
  const nodes: GraphData['nodes'] = Array.from({ length: 180 }, (_, i) => ({
    id: `page-${i}`,
    title: `Representative page ${i}`,
    kind: 'document',
  }));
  const points = Object.values(layoutGraph({ nodes, edges: [] })),
    size = { width: 360, height: 600 };
  const camera = fitCamera(points, size);
  for (const point of points) {
    const screen = worldToScreen(point, camera, size);
    expect(screen.x).toBeGreaterThanOrEqual(15);
    expect(screen.x).toBeLessThanOrEqual(345);
    expect(screen.y).toBeGreaterThanOrEqual(15);
    expect(screen.y).toBeLessThanOrEqual(585);
  }
});
