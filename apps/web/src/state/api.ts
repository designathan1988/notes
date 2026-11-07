export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public readFailure = false,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const request = () =>
    fetch(`/api${path}`, {
      ...options,
      credentials: 'same-origin',
      headers: {
        ...(typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
        'X-Note-Request': '1',
        ...options.headers,
      },
    });
  const read = !options.method || options.method.toUpperCase() === 'GET';
  let response: Response;
  try {
    response = await request();
  } catch {
    if (!read)
      throw new ApiError(
        'UNAVAILABLE',
        'The server is temporarily unavailable. Please retry.',
        503,
      );
    await new Promise((resolve) => setTimeout(resolve, 350));
    try {
      response = await request();
    } catch {
      throw new ApiError(
        'UNAVAILABLE',
        'The server is temporarily unavailable. Please retry.',
        503,
        true,
      );
    }
  }
  if (read && [500, 502, 503, 504].includes(response.status)) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    try {
      response = await request();
    } catch {
      throw new ApiError(
        'UNAVAILABLE',
        'The server is temporarily unavailable. Please retry.',
        503,
        true,
      );
    }
  }
  let body: Record<string, unknown>;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(
      'UNAVAILABLE',
      'The server is temporarily unavailable. Please retry.',
      response.status || 503,
      read,
    );
  }
  if (!response.ok)
    throw new ApiError(
      String(body.code ?? 'REQUEST_FAILED'),
      String(body.message ?? 'The request failed.'),
      response.status,
      read && response.status >= 500,
    );
  return body as T;
}
export const json = (body: unknown) => JSON.stringify(body);
