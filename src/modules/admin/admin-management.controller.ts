/**
 * Admin Management Controller
 *
 * Handles admin-level user management, audit logs, impersonation,
 * login history, and migration status.
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types';
import { sendSuccess, sendPaginated } from '../../shared/utils';
import * as managementService from './admin-management.service';
import * as auditService from './audit.service';
import {
  queryAuditLogsSchema,
  queryAdminLoginHistorySchema,
  userStatusSchema,
  changeRoleSchema,
  impersonateSchema,
  advancedUserSearchSchema,
} from './admin-management.schema';

/**
 * PATCH /api/admin/users/:id/disable
 */
export async function disableUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const targetUserId = req.params.id as string;
    const { adminId, ipAddress, userAgent } = auditService.extractAuditMeta(req);
    const user = await managementService.disableUser(targetUserId, adminId, ipAddress, userAgent);
    sendSuccess(res, 'User disabled successfully', user);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/admin/users/:id/enable
 */
export async function enableUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const targetUserId = req.params.id as string;
    const { adminId, ipAddress, userAgent } = auditService.extractAuditMeta(req);
    const user = await managementService.enableUser(targetUserId, adminId, ipAddress, userAgent);
    sendSuccess(res, 'User enabled successfully', user);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/admin/users/:id/role
 */
export async function changeUserRole(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const targetUserId = req.params.id as string;
    const { role } = changeRoleSchema.parse(req.body);
    const { adminId, ipAddress, userAgent } = auditService.extractAuditMeta(req);
    const user = await managementService.changeUserRole(targetUserId, role, adminId, ipAddress, userAgent);
    sendSuccess(res, 'User role updated successfully', user);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/audit-logs
 */
export async function getAuditLogs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = queryAuditLogsSchema.parse(req.query);
    const { logs, total } = await auditService.getAuditLogs(query);
    sendPaginated(res, 'Audit logs retrieved', logs, total, query.page, query.limit);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/login-history
 */
export async function getAdminLoginHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = queryAdminLoginHistorySchema.parse(req.query);
    const { attempts, total } = await managementService.getAdminLoginHistory(query);
    sendPaginated(res, 'Admin login history retrieved', attempts, total, query.page, query.limit);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/admin/impersonate/:id
 * SUPER_ADMIN only — impersonate a user with strict logging.
 */
export async function impersonateUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const targetUserId = req.params.id as string;
    const { adminId, ipAddress, userAgent } = auditService.extractAuditMeta(req);
    const result = await managementService.impersonateUser(targetUserId, adminId, ipAddress, userAgent);
    sendSuccess(res, 'Impersonation token generated', result);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/users/search
 * Advanced user search with filters.
 */
export async function searchUsers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = advancedUserSearchSchema.parse(req.query);
    const { users, total } = await managementService.searchUsers(query);
    sendPaginated(res, 'Users retrieved', users, total, query.page, query.limit);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/migration-status
 */
export async function getMigrationStatus(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const status = await managementService.getMigrationStatus();
    sendSuccess(res, 'Migration status retrieved', status);
  } catch (error) {
    next(error);
  }
}
