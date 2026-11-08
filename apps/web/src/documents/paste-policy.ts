export function classifyPaste(input: { text?: string; html?: string; mode?: string }): {
  mode: 'text' | 'html' | 'markdown' | 'code' | 'table';
  preserveOriginal: boolean;
} {
  const text = input.text ?? '';
  const html = input.html ?? '';
  if (input.mode === 'code') return { mode: 'code', preserveOriginal: false };
  if (input.mode === 'text') return { mode: 'text', preserveOriginal: false };
  if (input.mode === 'markdown') return { mode: 'markdown', preserveOriginal: false };
  if (html)
    return {
      mode: 'html',
      preserveOriginal:
        /<(?:script|style|iframe|object|embed|canvas|svg|button|input|form|img|video|audio|[\w]+-[\w]+)\b|\bon\w+\s*=|\bstyle\s*=/i.test(
          html,
        ),
    };
  try {
    if (/^[[{]/.test(text.trim())) {
      JSON.parse(text);
      return { mode: 'code', preserveOriginal: false };
    }
  } catch {
    /* Ordinary prose can start with a bracket. */
  }
  if (/(^|\n)(#{1,6} |```|~~~|[-*+] |\d+\. |\|.*\|)/.test(text))
    return { mode: 'markdown', preserveOriginal: false };
  if (text.includes('\t') && text.includes('\n')) return { mode: 'table', preserveOriginal: false };
  return { mode: 'text', preserveOriginal: false };
}
