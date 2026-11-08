import * as Y from 'yjs';

/** Repair only references made inconsistent by a collaborative merge. Rich children
 * retain their Yjs identities; schema, IDs, geometry and imports remain validated. */
export function reconcileCanvasTopology(document: Y.Doc): number {
  const fragment = document.getXmlFragment('default');
  if (fragment.length !== 1) return 0;
  const root = fragment.get(0);
  if (!(root instanceof Y.XmlElement) || root.nodeName !== 'canvasRoot') return 0;
  const children = root.toArray(),
    items = new Map<string, Y.XmlElement>();
  for (const child of children) {
    if (
      !(child instanceof Y.XmlElement) ||
      !['canvasCard', 'canvasGroup', 'canvasEdge'].includes(child.nodeName)
    )
      return 0;
    const id = child.getAttribute('id');
    if (typeof id !== 'string' || !/^[\w-]{1,128}$/.test(id) || items.has(id)) return 0;
    items.set(id, child);
  }
  let changed = 0;
  document.transact(() => {
    const groups = new Map([...items].filter(([, item]) => item.nodeName === 'canvasGroup'));
    const parents = new Map<string, string | null>();
    for (const [id, item] of items) {
      if (item.nodeName === 'canvasEdge') continue;
      const parent = item.getAttribute('groupId');
      if (typeof parent === 'string' && /^[\w-]{1,128}$/.test(parent) && !groups.has(parent)) {
        item.setAttribute('groupId', null as unknown as string);
        changed++;
      }
      if (item.nodeName === 'canvasGroup') parents.set(id, groups.has(parent!) ? parent! : null);
    }
    const complete = new Set<string>();
    for (const id of [...groups.keys()].sort()) {
      let current: string | null = id;
      const path: string[] = [],
        visited = new Map<string, number>();
      while (current !== null && !complete.has(current)) {
        const repeated = visited.get(current);
        if (repeated !== undefined) {
          const release = path.slice(repeated).sort().at(-1)!;
          groups.get(release)!.setAttribute('groupId', null as unknown as string);
          parents.set(release, null);
          changed++;
          break;
        }
        visited.set(current, path.length);
        path.push(current);
        current = parents.get(current) ?? null;
      }
      for (const value of path) complete.add(value);
    }
    for (let index = children.length - 1; index >= 0; index--) {
      const item = children[index] as Y.XmlElement;
      if (item.nodeName !== 'canvasEdge') continue;
      const endpoints = [item.getAttribute('fromNode'), item.getAttribute('toNode')];
      if (
        endpoints.every((id) => typeof id === 'string' && /^[\w-]{1,128}$/.test(id)) &&
        endpoints.some((id) => !items.has(id!) || items.get(id!)!.nodeName === 'canvasEdge')
      ) {
        root.delete(index, 1);
        changed++;
      }
    }
  });
  return changed;
}
