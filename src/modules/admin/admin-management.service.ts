/**
 * Admin Management Service
 *
 * Extended admin capabilities:
 * - User search, filters, status controls (disable/enable)
 * - Admin login history
 * - User impersonation (SUPER_ADMIN only, strictly logged)
 * - Migration status view
 */

import jwt from 'jsonwebtoken';
import prisma from '../../database/prisma';
import { Role, Prisma } from '@prisma/client';
import { env } from '../../config';
import { logAuditEvent } from './audit.service';
import { logSecurityEvent } from '../security/security.service';
import type { JwtPayload, AuthTokens, UserResponse } from '../../shared/types';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../shared/utils';

// ─── User Status Controls ───────────────────────────────

/**
 * Disable a user account. Logs audit event.
 */
export async function disableUser(
  targetUserId: string,
  adminId: string,
  ipAddress: string,
  userAgent?: string,
): Promise<UserResponse> {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw new NotFoundError('User not found');

  if (user.role === 'SUPER_ADMIN') {
    throw new ForbiddenError('Cannot disable a super admin account');
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { isActive: false },
    select: userSelect,
  });

  await logAuditEvent({
    action: 'USER_DISABLED',
    resource: 'users',
    resourceId: targetUserId,
    before: { isActive: true },
    after: { isActive: false },
    adminId,
    targetUserId,
    ipAddress,
    userAgent,
  });

  await logSecurityEvent({
    type: 'USER_DISABLED',
    severity: 'MEDIUM',
    message: `User ${user.email} disabled by admin`,
    userId: targetUserId,
    ipAddress,
    userAgent,
    details: { disabledBy: adminId },
  });

  return updated as UserResponse;
}

/**
 * Enable a user account. Logs audit event.
 */
export async function enableUser(
  targetUserId: string,
  adminId: string,
  ipAddress: string,
  userAgent?: string,
): Promise<UserResponse> {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw new NotFoundError('User not found');

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { isActive: true },
    select: userSelect,
  });

  await logAuditEvent({
    action: 'USER_ENABLED',
    resource: 'users',
    resourceId: targetUserId,
    before: { isActive: false },
    after: { isActive: true },
    adminId,
    targetUserId,
    ipAddress,
    userAgent,
  });

  await logSecurityEvent({
    type: 'USER_ENABLED',
    severity: 'LOW',
    message: `User ${user.email} enabled by admin`,
    userId: targetUserId,
    ipAddress,
    userAgent,
    details: { enabledBy: adminId },
  });

  return updated as UserResponse;
}

/**
 * Change a user's role. Logs audit event.
 * Enforces admin email rules for ADMIN/SUPER_ADMIN roles.
 */
export async function changeUserRole(
  targetUserId: string,
  newRole: Role,
  adminId: string,
  ipAddress: string,
  userAgent?: string,
): Promise<UserResponse> {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw new NotFoundError('User not found');

  // Prevent escalation to SUPER_ADMIN unless caller is SUPER_ADMIN
  if (newRole === 'SUPER_ADMIN') {
    const admin = await prisma.user.findUnique({ where: { id: adminId } });
    if (admin?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('Only super admins can assign the SUPER_ADMIN role');
    }
  }

  // Enforce admin email allowlist for ADMIN and SUPER_ADMIN promotions
  const allowedAdminEmails = env.ADMIN_ALLOWED_EMAILS.split(',').map((e) => e.toLowerCase().trim());
  if ((newRole === 'ADMIN' || newRole === 'SUPER_ADMIN') && !allowedAdminEmails.includes(user.email.toLowerCase())) {
    throw new ForbiddenError('This email is not authorized for admin or super_admin roles');
  }

  const oldRole = user.role;

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { role: newRole },
    select: userSelect,
  });

  await logAuditEvent({
    action: 'ROLE_CHANGED',
    resource: 'users',
    resourceId: targetUserId,
    before: { role: oldRole },
    after: { role: newRole },
    adminId,
    targetUserId,
    ipAddress,
    userAgent,
  });

  await logSecurityEvent({
    type: 'ROLE_CHANGED',
    severity: 'HIGH',
    message: `User ${user.email} role changed: ${oldRole} → ${newRole}`,
    userId: targetUserId,
    ipAddress,
    userAgent,
    details: { changedBy: adminId, oldRole, newRole },
  });

  return updated as UserResponse;
}

// ─── Admin Login History ────────────────────────────────

/**
 * Get login history for admin users.
 */
export async function getAdminLoginHistory(params: {
  page: number;
  limit: number;
  adminId?: string;
}): Promise<{ attempts: unknown[]; total: number }> {
  const { page, limit, adminId } = params;
  const skip = (page - 1) * limit;

  // Get all admin user IDs
  const adminUsers = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    select: { id: true },
  });
  const adminIds = adminUsers.map((u) => u.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    userId: adminId ? adminId : { in: adminIds },
  };

  const [attempts, total] = await Promise.all([
    prisma.loginAttempt.findMany({
      where,
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.loginAttempt.count({ where }),
  ]);

  return { attempts, total };
}

// ─── User Impersonation (SUPER_ADMIN Only) ──────────────

/**
 * Generate a temporary impersonation token for a target user.
 * Strictly logged — requires SUPER_ADMIN role.
 */
export async function impersonateUser(
  targetUserId: string,
  adminId: string,
  ipAddress: string,
  userAgent?: string,
): Promise<{ accessToken: string; impersonatedUser: UserResponse }> {
  // Double-check the calling admin is SUPER_ADMIN
  const admin = await prisma.user.findUnique({ where: { id: adminId } });
  if (!admin || admin.role !== 'SUPER_ADMIN') {
    throw new ForbiddenError('Only super admins can impersonate users');
  }

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) throw new NotFoundError('Target user not found');

  if (targetUser.role === 'SUPER_ADMIN') {
    throw new ForbiddenError('Cannot impersonate another super admin');
  }

  // Generate a short-lived impersonation token (15 min max)
  const payload: JwtPayload & { impersonatedBy: string } = {
    userId: targetUser.id,
    email: targetUser.email,
    role: targetUser.role as JwtPayload['role'],
    impersonatedBy: adminId,
  };

  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' });

  // Strict audit logging
  await logAuditEvent({
    action: 'IMPERSONATION_START',
    resource: 'users',
    resourceId: targetUserId,
    after: { impersonatedBy: adminId, impersonatedUser: targetUser.email },
    adminId,
    targetUserId,
    ipAddress,
    userAgent,
  });

  await logSecurityEvent({
    type: 'IMPERSONATION_START',
    severity: 'CRITICAL',
    message: `SUPER_ADMIN ${admin.email} started impersonating ${targetUser.email}`,
    userId: adminId,
    ipAddress,
    userAgent,
    details: {
      impersonatedUserId: targetUserId,
      impersonatedEmail: targetUser.email,
      adminEmail: admin.email,
    },
  });

  return {
    accessToken,
    impersonatedUser: toUserResponse(targetUser),
  };
}

// ─── Advanced User Search ───────────────────────────────

/**
 * Search users with advanced filters.
 */
export async function searchUsers(params: {
  page: number;
  limit: number;
  search?: string;
  role?: Role;
  isActive?: boolean;
  isLocked?: boolean;
  source?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<{ users: UserResponse[]; total: number }> {
  const { page, limit, search, role, isActive, isLocked, source, sortBy, sortOrder } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {};

  if (role) where.role = role;
  if (isActive !== undefined) where.isActive = isActive;
  if (isLocked !== undefined) where.isLocked = isLocked;
  if (source) where.source = source as any;

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { firebaseUid: { contains: search, mode: 'insensitive' } },
    ];
  }

  const orderBy: Prisma.UserOrderByWithRelationInput = {};
  const validSortFields = ['email', 'firstName', 'lastName', 'createdAt', 'lastLoginAt', 'role'];
  if (sortBy && validSortFields.includes(sortBy)) {
    (orderBy as any)[sortBy] = sortOrder || 'desc';
  } else {
    orderBy.createdAt = 'desc';
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { ...userSelect, firebaseUid: true, source: true, migratedAt: true, isLocked: true },
      skip,
      take: limit,
      orderBy,
    }),
    prisma.user.count({ where }),
  ]);

  return { users: users as unknown as UserResponse[], total };
}

// ─── Migration Status ───────────────────────────────────

/**
 * Get migration checkpoint status for admin dashboard.
 */
export async function getMigrationStatus(): Promise<unknown[]> {
  return prisma.migrationCheckpoint.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

// ─── Helpers ────────────────────────────────────────────

const userSelect: Prisma.UserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

function toUserResponse(user: any): UserResponse {
  const { password, ...safeUser } = user;
  return safeUser as UserResponse;
}
