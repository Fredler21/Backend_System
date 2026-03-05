/**
 * Admin Management Schemas — Validation
 */

import { z } from 'zod';
import { Role } from '@prisma/client';

export const queryAuditLogsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  adminId: z.string().uuid().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  targetUserId: z.string().uuid().optional(),
  startDate: z
    .string()
    .datetime()
    .transform((v) => new Date(v))
    .optional(),
  endDate: z
    .string()
    .datetime()
    .transform((v) => new Date(v))
    .optional(),
});

export const queryAdminLoginHistorySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  adminId: z.string().uuid().optional(),
});

export const userStatusSchema = z.object({
  userId: z.string().uuid(),
});

export const changeRoleSchema = z.object({
  role: z.nativeEnum(Role),
});

export const impersonateSchema = z.object({
  userId: z.string().uuid(),
});

export const advancedUserSearchSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.nativeEnum(Role).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  isLocked: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  source: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type QueryAuditLogsInput = z.infer<typeof queryAuditLogsSchema>;
export type QueryAdminLoginHistoryInput = z.infer<typeof queryAdminLoginHistorySchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
export type AdvancedUserSearchInput = z.infer<typeof advancedUserSearchSchema>;
