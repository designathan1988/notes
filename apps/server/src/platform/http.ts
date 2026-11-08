import type { FastifyRequest } from 'fastify';
import type { Actor } from '@note/contracts';
declare module 'fastify' {
  interface FastifyRequest {
    actor: Actor;
  }
}
export function requestHeaders(request: FastifyRequest) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers))
    if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  return headers;
}
