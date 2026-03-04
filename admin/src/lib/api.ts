import {
  ApiResponse,
  PaginatedResponse,
  LoginRequest,
  LoginResponse,
  User,
  SecurityDashboard,
  SecurityEvent,
  LoginAttempt,
  BlockedIp,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// ─── Token Management ──────────────────────────────────

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('accessToken');
  }
  return accessToken;
}

export function getRefreshToken(): string | null {
  if (refreshToken) return refreshToken;
  if (typeof window !== 'undefined') {
    refreshToken = localStorage.getItem('refreshToken');
  }
  return refreshToken;
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
}

// ─── HTTP Client ───────────────────────────────────────

class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const token = getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Handle 401 – try token refresh
  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getAccessToken()}`;
      const retry = await fetch(url, { ...options, headers, credentials: 'include' });
      if (!retry.ok) {
        const body = await retry.json().catch(() => ({ message: 'Request failed' }));
        throw new ApiError(body.message || 'Request failed', retry.status, body.errors);
      }
      return retry.json() as Promise<T>;
    } else {
      clearTokens();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new ApiError('Session expired', 401);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(body.message || `HTTP ${res.status}`, res.status, body.errors);
  }

  return res.json() as Promise<T>;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const rt = getRefreshToken();
    if (!rt) return false;

    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });

    if (!res.ok) return false;

    const body = (await res.json()) as ApiResponse<{ accessToken: string; refreshToken: string }>;
    if (body.success && body.data) {
      setTokens(body.data.accessToken, body.data.refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ─── Auth API ──────────────────────────────────────────

export const authApi = {
  login: (data: LoginRequest) =>
    request<ApiResponse<LoginResponse>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  me: () => request<ApiResponse<User>>('/auth/me'),

  logout: () => {
    const rt = getRefreshToken();
    return request<ApiResponse>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: rt }),
    });
  },
};

// ─── Users API ─────────────────────────────────────────

export const usersApi = {
  list: (params?: { page?: number; limit?: number; role?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.role) qs.set('role', params.role);
    if (params?.search) qs.set('search', params.search);
    const query = qs.toString();
    return request<PaginatedResponse<User>>(`/users${query ? `?${query}` : ''}`);
  },

  getById: (id: string) => request<ApiResponse<User>>(`/users/${id}`),

  updateRole: (id: string, role: string) =>
    request<ApiResponse<User>>(`/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  delete: (id: string) =>
    request<ApiResponse>(`/users/${id}`, { method: 'DELETE' }),
};

// ─── Security API ──────────────────────────────────────

export const securityApi = {
  dashboard: () => request<ApiResponse<SecurityDashboard>>('/security/dashboard'),

  events: (params?: { page?: number; limit?: number; type?: string; severity?: string; resolved?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.type) qs.set('type', params.type);
    if (params?.severity) qs.set('severity', params.severity);
    if (params?.resolved) qs.set('resolved', params.resolved);
    const query = qs.toString();
    return request<PaginatedResponse<SecurityEvent>>(`/security/events${query ? `?${query}` : ''}`);
  },

  resolveEvent: (eventId: string) =>
    request<ApiResponse>(`/security/events/${eventId}/resolve`, { method: 'PATCH' }),

  loginAttempts: (params?: { page?: number; limit?: number; email?: string; success?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.email) qs.set('email', params.email);
    if (params?.success) qs.set('success', params.success);
    const query = qs.toString();
    return request<PaginatedResponse<LoginAttempt>>(`/security/login-attempts${query ? `?${query}` : ''}`);
  },

  blockedIps: (params?: { page?: number; limit?: number; activeOnly?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.activeOnly) qs.set('activeOnly', params.activeOnly);
    const query = qs.toString();
    return request<PaginatedResponse<BlockedIp>>(`/security/blocked-ips${query ? `?${query}` : ''}`);
  },

  blockIp: (ipAddress: string, reason: string, durationMinutes?: number) =>
    request<ApiResponse>('/security/block-ip', {
      method: 'POST',
      body: JSON.stringify({ ipAddress, reason, durationMinutes }),
    }),

  unblockIp: (ipAddress: string) =>
    request<ApiResponse>('/security/unblock-ip', {
      method: 'POST',
      body: JSON.stringify({ ipAddress }),
    }),

  unlockAccount: (userId: string) =>
    request<ApiResponse>(`/security/unlock-account/${userId}`, { method: 'POST' }),
};

// ─── Admin Invite API ──────────────────────────────────

export const adminApi = {
  verifyToken: (token: string) =>
    request<ApiResponse<{ email: string; expiresAt: string; createdAt: string }>>(
      `/admin/verify-token?token=${encodeURIComponent(token)}`,
    ),

  setupPassword: (data: { token: string; password: string; confirmPassword: string }) =>
    request<ApiResponse<{ email: string }>>('/admin/setup-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  invite: (email: string) =>
    request<ApiResponse<{ inviteUrl: string; token: string; expiresAt: string }>>('/admin/invite', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  listInvites: () =>
    request<ApiResponse<Array<{
      id: string;
      email: string;
      used: boolean;
      expired: boolean;
      expiresAt: string;
      usedAt: string | null;
      createdAt: string;
      createdBy: string | null;
    }>>>('/admin/invites'),

  allowedEmails: () =>
    request<ApiResponse<{ emails: string[] }>>('/admin/allowed-emails'),
};

export { ApiError };
