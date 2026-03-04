import { Request, Response, NextFunction } from 'express';
import * as adminService from './admin.service';
import { AuthenticatedRequest } from '../../shared/types';
import { sendSuccess } from '../../shared/utils';

/**
 * POST /api/admin/invite
 * Generate an admin invitation link. Requires ADMIN role.
 */
export async function invite(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const invitedBy = req.user?.userId;
    const result = await adminService.generateInvite(req.body, invitedBy, ipAddress);
    sendSuccess(res, 'Invitation generated successfully', result, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/verify-token?token=...
 * Verify an invitation token is valid. Public endpoint.
 */
export async function verifyToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.query.token as string;
    const result = await adminService.verifyInviteToken(token);
    sendSuccess(res, 'Invitation token is valid', result);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/admin/setup-password
 * Set password using invitation token. Public endpoint.
 */
export async function setupPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'];
    const result = await adminService.setupPassword(req.body, ipAddress, userAgent);
    sendSuccess(res, result.message, { email: result.email });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/invites
 * List all invitations. Requires ADMIN role.
 */
export async function listInvites(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const invites = await adminService.listInvites();
    sendSuccess(res, 'Invitations retrieved', invites);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/allowed-emails
 * List allowed admin emails. Requires ADMIN role.
 */
export async function allowedEmails(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const emails = adminService.getAllowedAdminEmails();
    sendSuccess(res, 'Allowed admin emails retrieved', { emails });
  } catch (error) {
    next(error);
  }
}
