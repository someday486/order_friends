import { getInitialSession } from '@/lib/auth/client';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const E2E_BYPASS_AUTH = process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH === 'true';
const E2E_ACCESS_TOKEN = 'e2e-test-token';
const E2E_AUTH_COOKIE = 'of_e2e_auth=1';
const GET_CACHE_TTL_MS = 2_000;

type CachedResponseEntry = {
  expiresAt: number;
  value: unknown;
};

const pendingGetRequests = new Map<string, Promise<unknown>>();
const cachedGetResponses = new Map<string, CachedResponseEntry>();

if (!API_BASE) {
  throw new Error('NEXT_PUBLIC_API_BASE_URL is not configured');
}

function resolveApiBase(): string {
  // If the app is opened from another device (192.168.x.x),
  // localhost API base would point to that device itself.
  if (typeof window === 'undefined') {
    return API_BASE!;
  }

  try {
    const configured = new URL(API_BASE!);
    const isConfiguredLocal =
      configured.hostname === 'localhost' ||
      configured.hostname === '127.0.0.1';
    const currentHost = window.location.hostname;
    const isCurrentLocal =
      currentHost === 'localhost' || currentHost === '127.0.0.1';

    if (isConfiguredLocal && !isCurrentLocal) {
      configured.hostname = currentHost;
      return configured.origin;
    }

    return configured.origin;
  } catch {
    return API_BASE!.replace(/\/+$/, '');
  }
}

async function getAccessToken(): Promise<string> {
  if (shouldBypassAuthForE2E()) {
    return E2E_ACCESS_TOKEN;
  }

  const session = await getInitialSession();
  const token = session?.access_token;
  if (!token) throw new Error('No access_token (login required)');
  return token;
}

interface RequestOptions {
  auth?: boolean;
  cacheTtlMs?: number;
}

function shouldBypassAuthForE2E(): boolean {
  if (E2E_BYPASS_AUTH) {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  const host = window.location.hostname;
  const isLocalHost = host === '127.0.0.1' || host === 'localhost';
  if (!isLocalHost) {
    return false;
  }

  return document.cookie
    .split(';')
    .some((cookie) => cookie.trim() === E2E_AUTH_COOKIE);
}

function isFormData(body: unknown): body is FormData {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

function cloneCachedValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return value;
}

function getRequestCacheKey(
  method: string,
  path: string,
  authEnabled: boolean,
): string {
  return `${method.toUpperCase()}:${authEnabled ? 'auth' : 'anon'}:${path}`;
}

function readCachedGetResponse<T>(cacheKey: string): T | null {
  const cached = cachedGetResponses.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    cachedGetResponses.delete(cacheKey);
    return null;
  }

  return cloneCachedValue(cached.value as T);
}

function writeCachedGetResponse(
  cacheKey: string,
  value: unknown,
  ttlMs: number = GET_CACHE_TTL_MS,
) {
  cachedGetResponses.set(cacheKey, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

function clearRequestCache() {
  pendingGetRequests.clear();
  cachedGetResponses.clear();
}

async function request<T = unknown>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const authEnabled = options.auth !== false;
  const cacheTtlMs = options.cacheTtlMs ?? GET_CACHE_TTL_MS;
  const cacheKey = getRequestCacheKey(method, path, authEnabled);
  const canUseGetCache = method === 'GET';

  if (canUseGetCache) {
    const cached = readCachedGetResponse<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const pending = pendingGetRequests.get(cacheKey);
    if (pending) {
      return pending as Promise<T>;
    }
  }

  const apiBase = resolveApiBase();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${apiBase}${normalizedPath}`;

  const runRequest = async (): Promise<T> => {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string>),
    };

    if (!isFormData(init.body) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (authEnabled) {
      headers.Authorization = `Bearer ${await getAccessToken()}`;
    }

    let res: Response;
    try {
      res = await fetch(url, { ...init, headers });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      throw new Error(`API Network Error: ${path} -> ${url} (${reason})`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`API Error: ${res.status} ${text}`);
    }

    const data = (await res.json()) as T;
    if (!canUseGetCache) {
      clearRequestCache();
    }

    return data;
  };

  if (!canUseGetCache) {
    return runRequest();
  }

  const requestPromise = runRequest()
    .then((data) => {
      writeCachedGetResponse(cacheKey, data, cacheTtlMs);
      return cloneCachedValue(data);
    })
    .finally(() => {
      pendingGetRequests.delete(cacheKey);
    });

  pendingGetRequests.set(cacheKey, requestPromise as Promise<unknown>);
  return requestPromise;
}

export const apiClient = {
  clearCache(): void {
    clearRequestCache();
  },

  get<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>(path, {}, options);
  },

  post<T = unknown>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    const payload = isFormData(body)
      ? body
      : body
        ? JSON.stringify(body)
        : undefined;
    return request<T>(
      path,
      {
        method: 'POST',
        body: payload,
      },
      options,
    );
  },

  patch<T = unknown>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    const payload = isFormData(body)
      ? body
      : body
        ? JSON.stringify(body)
        : undefined;
    return request<T>(
      path,
      {
        method: 'PATCH',
        body: payload,
      },
      options,
    );
  },

  put<T = unknown>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    const payload = isFormData(body)
      ? body
      : body
        ? JSON.stringify(body)
        : undefined;
    return request<T>(
      path,
      {
        method: 'PUT',
        body: payload,
      },
      options,
    );
  },

  delete<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>(path, { method: 'DELETE' }, options);
  },
};
