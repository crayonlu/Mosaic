import { ofetch, type FetchOptions, type FetchRequest } from 'ofetch';

const TOKEN_KEY = 'admin_token';
const REFRESH_KEY = 'admin_refresh';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

/** Shared auth headers interceptor */
function attachToken(options: FetchOptions) {
  const token = getToken();
  if (token) {
    options.headers = new Headers(options.headers);
    options.headers.set('Authorization', `Bearer ${token}`);
  }
}

function onResponseError({
  response,
  request,
  options,
}: {
  response: Response;
  request: FetchRequest;
  options: FetchOptions;
}) {
  if (response.status === 401) {
    const refresh = localStorage.getItem(REFRESH_KEY);
    if (refresh) {
      return (async () => {
        try {
          const res: RefreshTokenResponse = await ofetch('/api/auth/refresh', {
            method: 'POST',
            body: { refreshToken: refresh },
          });
          setToken(res.accessToken, res.refreshToken);
          // Retry the original request with the new token
          options.headers = new Headers(options.headers);
          options.headers.set('Authorization', `Bearer ${res.accessToken}`);
          return ofetch(request, options);
        } catch {
          clearToken();
          window.location.href = '/admin/login';
        }
      })();
    }
    clearToken();
    window.location.href = '/admin/login';
  }
}

export const api = ofetch.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  onRequest({ options }) {
    attachToken(options);
  },
  onResponseError,
});

export const adminApi = ofetch.create({
  baseURL: '/admin/api',
  headers: { 'Content-Type': 'application/json' },
  onRequest({ options }) {
    attachToken(options);
  },
  onResponseError,
});

/* ─── TypeScript interfaces for API responses ─── */

export interface UserResponse {
  id: string;
  username: string;
  avatarUrl: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserResponse;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface StatsSummary {
  memos: { total: number; thisMonth: number };
  diaries: { total: number; thisMonth: number };
  resources: { total: number; totalSize: number; totalSizeFormatted: string };
  bots: { total: number; autoReply: number; totalReplies: number };
  activeDays: number;
  longestStreak: number;
}

export interface ActivityEntry {
  timestamp: number;
  action: string;
  entityType: string;
  entityId: string | null;
  level: string;
  detail: string;
}

export interface ActivityResponse {
  entries: ActivityEntry[];
}
