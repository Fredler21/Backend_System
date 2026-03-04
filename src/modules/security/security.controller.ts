import { Request, Response, NextFunction } from 'express';
import * as securityService from './security.service';
import { AuthenticatedRequest } from '../../shared/types';
import { sendSuccess, sendPaginated } from '../../shared/utils';
import {
  querySecurityEventsSchema,
  queryLoginAttemptsSchema,
  queryBlockedIpsSchema,
} from './security.schema';

/**
 * GET /api/security/dashboard
 */
export async function getDashboard(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dashboard = await securityService.getSecurityDashboard();
    sendSuccess(res, 'Security dashboard retrieved', dashboard);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/security/events
 */
export async function getSecurityEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = querySecurityEventsSchema.parse(req.query);
    const { events, total } = await securityService.getSecurityEvents(query);
    sendPaginated(res, 'Security events retrieved', events, total, query.page, query.limit);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/security/events/:eventId/resolve
 */
export async function resolveEvent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const eventId = req.params.eventId as string;
    await securityService.resolveSecurityEvent(eventId, req.user!.userId);
    sendSuccess(res, 'Security event resolved');
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/security/login-attempts
 */
export async function getLoginAttempts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = queryLoginAttemptsSchema.parse(req.query);
    const { attempts, total } = await securityService.getLoginAttempts(query);
    sendPaginated(res, 'Login attempts retrieved', attempts, total, query.page, query.limit);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/security/blocked-ips
 */
export async function getBlockedIps(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = queryBlockedIpsSchema.parse(req.query);
    const { blockedIps, total } = await securityService.getBlockedIps({
      page: query.page,
      limit: query.limit,
      activeOnly: query.activeOnly,
    });
    sendPaginated(res, 'Blocked IPs retrieved', blockedIps, total, query.page, query.limit);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/security/block-ip
 */
export async function blockIp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await securityService.blockIp(req.body.ipAddress, req.body.reason, req.body.durationMinutes);
    sendSuccess(res, 'IP address blocked successfully', null, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/security/unblock-ip
 */
export async function unblockIp(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await securityService.unblockIp(req.body.ipAddress, req.user!.userId);
    sendSuccess(res, 'IP address unblocked successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/security/unlock-account/:userId
 */
export async function unlockAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.params.userId as string;
    await securityService.unlockAccount(userId, req.user!.userId);
    sendSuccess(res, 'Account unlocked successfully');
  } catch (error) {
    next(error);
  }
}
