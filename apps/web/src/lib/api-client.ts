import { createClient } from '@/lib/supabaseClient';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE) {
  throw new Error('NEXT_PUBLIC_API_BASE_URL is not configured');
}

async function getAccessToken(): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('No access_token (로그인 필요)');
  return token;
}

interface RequestOptions {
  auth?: boolean;
}

async function request<T = unknown>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };

  if (options.auth !== false) {
    headers['Authorization'] = `Bearer ${await getAccessToken()}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

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

  post<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }, options);
  },

  patch<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }, options);
  },

  delete<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>(path, { method: 'DELETE' }, options);
  },
};
