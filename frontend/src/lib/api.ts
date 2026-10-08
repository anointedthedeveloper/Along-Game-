const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:5000/api';
const TOKEN_KEY = 'along.token';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const apiBase = BASE;
export const socketUrl = BASE.replace(/\/api$/, '');

export const tokenStore = {
  get: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string | null) => {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable (private mode) — session lasts until reload */
    }
  },
};

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

async function request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(auth && token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the ALONG server. Check your connection and try again.', 'NETWORK');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error ?? {};
    if (res.status === 401 && auth && token) onUnauthorized?.();
    throw new ApiError(res.status, err.message ?? `Request failed (${res.status})`, err.code ?? 'ERROR', err.details);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, auth = true) => request<T>('GET', path, undefined, auth),
  post: <T>(path: string, body?: unknown, auth = true) => request<T>('POST', path, body ?? {}, auth),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  del: <T>(path: string) => request<T>('DELETE', path),
};
