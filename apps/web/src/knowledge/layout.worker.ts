import { layoutGraph } from './layout.js';
import type { GraphData } from '../../../../packages/contracts/src/index.js';

self.onmessage = (event: MessageEvent<GraphData>) => {
  self.postMessage(layoutGraph(event.data));
};
