import { supabaseBrowser } from '@/lib/supabase/client';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const E2E_BYPASS_AUTH = process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH === 'true';
const E2E_ACCESS_TOKEN = 'e2e-test-token';
const E2E_AUTH_COOKIE = 'of_e2e_auth=1';

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

  const { data, error } = await supabaseBrowser.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('No access_token (login required)');
  return token;
}

interface RequestOptions {
  auth?: boolean;
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

async function request<T = unknown>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<T> {
  const apiBase = resolveApiBase();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${apiBase}${normalizedPath}`;

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };

  if (!isFormData(init.body) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.auth !== false) {
    headers['Authorization'] = `Bearer ${await getAccessToken()}`;
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

  return res.json();
}

export const apiClient = {
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

  delete<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>(path, { method: 'DELETE' }, options);
  },
};
