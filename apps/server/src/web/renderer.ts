import Fastify from 'fastify';
import { parse, serialize, defaultTreeAdapter, html, type DefaultTreeAdapterTypes } from 'parse5';
import { DomainError } from '../../../../packages/contracts/src/index.js';
import type { WebPreviews } from './service.js';
import { sendAttachment } from '../attachments/http.js';

function renderedHTML(source: string, runtimeURL: string) {
  const document = parse(source);
  function head(node: DefaultTreeAdapterTypes.Node): DefaultTreeAdapterTypes.Element | undefined {
    if ('tagName' in node && node.tagName === 'head') return node;
    if ('childNodes' in node)
      for (const child of node.childNodes) {
        const found = head(child);
        if (found) return found;
      }
  }
  const target = head(document)!;
  const script = defaultTreeAdapter.createElement('script', html.NS.HTML, [
    { name: 'src', value: runtimeURL },
  ]);
  if (target.childNodes.length)
    defaultTreeAdapter.insertBefore(target, script, target.childNodes[0]);
  else defaultTreeAdapter.appendChild(target, script);
  return serialize(document);
}
const contentTypes: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  cjs: 'text/javascript',
  json: 'application/json',
  svg: 'image/svg+xml',
  txt: 'text/plain',
  xml: 'application/xml',
  webmanifest: 'application/manifest+json',
};

/** Separate listener and origin: this server never mounts application/session endpoints. */
export function createWebRenderer(previews: WebPreviews) {
  const app = Fastify({ logger: false, bodyLimit: 1024 });
  app.setErrorHandler((error, _request, reply) => {
    const code = error instanceof DomainError ? error.code : 'INVALID';
    return reply
      .header('Cache-Control', 'no-store')
      .type('text/plain')
      .code(code === 'FORBIDDEN' ? 403 : code === 'CONFLICT' ? 409 : 404)
      .send('This website preview is unavailable. Return to the page and run its current source.');
  });
  app.get('/*', async (request, reply) => {
    const token = previews.tokenFromHost(request.headers.host);
    if (!token) throw new DomainError('NOT_FOUND', 'Unknown preview origin.');
    const preview = await previews.read(token);
    reply.header('Cache-Control', 'private, no-store');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Cross-Origin-Resource-Policy', 'same-origin');
    reply.header(
      'Content-Security-Policy',
      `sandbox allow-scripts allow-same-origin allow-forms allow-downloads allow-modals allow-popups; default-src 'self' https: http: data: blob:; script-src 'self' https: http: 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' https: http: 'unsafe-inline'; connect-src 'self' https: http: wss: ws:; object-src 'none'; frame-ancestors ${previews.configuration.appOrigin} 'self'`,
    );
    let path: string;
    try {
      path = decodeURIComponent(new URL(request.url, 'http://preview.invalid').pathname);
    } catch {
      throw new DomainError('INVALID', 'Invalid preview path.');
    }
    const asset = /^\/(?:\.note\/assets\/|api\/attachments\/)([\w-]+)(?:\/content)?$/.exec(path);
    if (asset)
      return sendAttachment(reply, await previews.asset(token, asset[1]), request.headers.range);
    if (path === '/.note/runtime.js') {
      const target = JSON.stringify(previews.configuration.appOrigin),
        instance = JSON.stringify(token);
      return reply
        .type('text/javascript')
        .send(
          `(() => { let count = 0; const report = message => { if (count++ >= 32) return; parent.postMessage({ type: 'note-runtime-error', instance: ${instance}, message: String(message).slice(0,4096) }, ${target}); }; addEventListener('error', event => report(event.message || 'Resource failed to load'), true); addEventListener('unhandledrejection', event => report(event.reason?.message || event.reason || 'Unhandled promise rejection')); })();`,
        );
    }
    const name = path === '/' ? preview.source.entry : path.slice(1);
    const file = preview.source.files.find((file) => file.path === name);
    if (!file) throw new DomainError('NOT_FOUND', 'Source file not found.');
    const extension = name.split('.').at(-1)?.toLowerCase() ?? '',
      type =
        name === preview.source.entry ? 'text/html' : (contentTypes[extension] ?? 'text/plain');
    return reply
      .type(type + '; charset=utf-8')
      .send(
        type === 'text/html'
          ? renderedHTML(
              file.text,
              new URL(
                '/.note/runtime.js',
                previews.configuration.originTemplate.replace('{token}', token),
              ).href,
            )
          : file.text,
      );
  });
  return app;
}
