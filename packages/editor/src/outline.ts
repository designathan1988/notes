import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { projectWebsite } from './web-projection.js';

/** Mirrors the existing outline order with positions in the current canonical document.
 * Website headings reveal their source component; source code is never a rich heading. */
export function headingPositions(doc: ProseMirrorNode): number[] {
  const positions: number[] = [];
  doc.descendants((node, position) => {
    if (node.type.name === 'heading') positions.push(position);
    if (node.type.name === 'webPage' || node.type.name === 'webComponent') {
      for (const _heading of projectWebsite(node.toJSON()).headings) positions.push(position);
      return false;
    }
  });
  return positions;
}
