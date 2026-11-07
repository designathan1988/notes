export class ApiError extends Error { constructor(public code: string, message: string, public status: number) { super(message); } }
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Note-Request': '1', ...options.headers } });
  const body = await response.json();
  if (!response.ok) throw new ApiError(body.code ?? 'REQUEST_FAILED', body.message ?? 'The request failed.',response.status);
  return body as T;
}
export const json = (body: unknown) => JSON.stringify(body);
