// ─── API Response Envelope ──────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Auth ───────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
  mustChangePassword?: boolean;
}

// ─── User ───────────────────────────────────────────────

export type Role = 'STUDENT' | 'DEVELOPER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  mustChangePassword?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Security ───────────────────────────────────────────

export type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_UNLOCKED'
  | 'IP_BLOCKED'
  | 'IP_UNBLOCKED'
  | 'BRUTE_FORCE_DETECTED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'PASSWORD_CHANGED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'UNAUTHORIZED_ACCESS';

export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  message: string;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  userId: string | null;
  createdAt: string;
}

export interface LoginAttempt {
  id: string;
  email: string;
  ipAddress: string;
  userAgent: string | null;
  success: boolean;
  failureReason: string | null;
  userId: string | null;
  createdAt: string;
}

export interface BlockedIp {
  id: string;
  ipAddress: string;
  reason: string;
  blockedAt: string;
  expiresAt: string | null;
  permanent: boolean;
  active: boolean;
  unblockedAt: string | null;
  unblockedBy: string | null;
  createdAt: string;
}

export interface SecurityDashboard {
  totalEvents: number;
  unresolvedEvents: number;
  criticalEvents: number;
  activeBlockedIps: number;
  lockedAccounts: number;
  failedLoginsLast24h: number;
  successfulLoginsLast24h: number;
  recentEvents: SecurityEvent[];
}
