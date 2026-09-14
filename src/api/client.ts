/** JSON client for the Content Machine API, served under /api on the same origin. */

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(response.status, payload?.error ?? response.statusText);
  }
  return (await response.json()) as T;
}

export const apiGet = <T>(path: string) => request<T>('GET', path);

export const apiPost = <T>(path: string, body?: unknown) => request<T>('POST', path, body);

export const isUnauthorized = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 401;
