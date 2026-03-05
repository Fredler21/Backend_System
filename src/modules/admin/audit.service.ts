/**
 * Audit Log Service
 *
 * Records admin actions (who/what/when/IP/user-agent) in a dedicated table.
 * Used by admin routes for full traceability of administrative operations.
 */

import prisma from '../../database/prisma';
import type { AuthenticatedRequest } from '../../shared/types';

export interface AuditLogEntry {
  action: string;
  resource: string;
  resourceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  adminId: string;
  targetUserId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Record an admin audit log entry.
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      before: entry.before ? JSON.parse(JSON.stringify(entry.before)) : null,
      after: entry.after ? JSON.parse(JSON.stringify(entry.after)) : null,
      adminId: entry.adminId,
      targetUserId: entry.targetUserId,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
    },
  });
}

/**
 * Helper to extract audit metadata from a request.
 */
export function extractAuditMeta(req: AuthenticatedRequest): {
  adminId: string;
  ipAddress: string;
  userAgent: string | undefined;
} {
  return {
    adminId: req.user!.userId,
    ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'],
  };
}

/**
 * Query audit logs with filtering and pagination.
 */
export async function getAuditLogs(params: {
  page: number;
  limit: number;
  adminId?: string;
  action?: string;
  resource?: string;
  targetUserId?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<{ logs: unknown[]; total: number }> {
  const { page, limit, adminId, action, resource, targetUserId, startDate, endDate } = params;
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (adminId) where.adminId = adminId;
  if (action) where.action = action;
  if (resource) where.resource = resource;
  if (targetUserId) where.targetUserId = targetUserId;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        admin: { select: { id: true, email: true, firstName: true, lastName: true } },
        targetUser: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}
