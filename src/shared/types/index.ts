import { Role } from '@prisma/client';
import { Request } from 'express';

// ─── JWT Payloads ───────────────────────────────────────

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
}

export interface JwtRefreshPayload {
  userId: string;
  tokenId: string;
}

// ─── Authenticated Request ──────────────────────────────

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// ─── API Response Envelope ──────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

// ─── Pagination ─────────────────────────────────────────

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── User DTOs ──────────────────────────────────────────

export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: UserResponse;
  tokens: AuthTokens;
}
