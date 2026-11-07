export function safeEmbedSource(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    let id: string | null = null;
    if (['youtube.com', 'www.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname))
      id = url.pathname.startsWith('/embed/')
        ? url.pathname.split('/')[2]
        : url.searchParams.get('v');
    if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
    if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
    if (['vimeo.com', 'player.vimeo.com'].includes(url.hostname)) {
      const match = url.pathname.match(/\/(?:video\/)?(\d+)$/);
      if (match) return `https://player.vimeo.com/video/${match[1]}`;
    }
  } catch {
    /* Untrusted pasted values are not executable URLs. */
  }
  return null;
}
