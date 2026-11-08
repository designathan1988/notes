import { layoutGraph } from './layout.js';
import type { GraphData } from '@note/contracts';

self.onmessage = (event: MessageEvent<GraphData>) => {
  self.postMessage(layoutGraph(event.data));
};
