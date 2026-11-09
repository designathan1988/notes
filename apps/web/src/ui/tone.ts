/** Stable palette slot (0–4) for a label, so the same option always gets the same color. */
export function toneOf(label: unknown): number | undefined {
  const text = String(label ?? '')
    .trim()
    .toLowerCase();
  if (!text) return undefined;
  let hash = 0;
  for (let index = 0; index < text.length; index++)
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  return hash % 5;
}
