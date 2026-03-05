import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { AuthenticatedRequest } from '../../shared/types';
import { sendSuccess } from '../../shared/utils';
import { getUserById } from '../users/users.service';

/**
 * POST /api/auth/register
 */
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.register(req.body);
    sendSuccess(res, 'Account created successfully', result, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/login
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'];
    const result = await authService.login(req.body, ipAddress, userAgent);
    sendSuccess(res, 'Login successful', result);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/refresh
 */
export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body;
    const tokens = await authService.refreshAccessToken(refreshToken);
    sendSuccess(res, 'Token refreshed successfully', tokens);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/auth/me
 */
export async function me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await getUserById(req.user!.userId);
    sendSuccess(res, 'Authenticated user retrieved', user);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/logout
 */
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    sendSuccess(res, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/change-password
 */
export async function changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user!.userId, currentPassword, newPassword);
    sendSuccess(res, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
}
