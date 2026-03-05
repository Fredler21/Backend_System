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

// ─── Password Reset ─────────────────────────────────────

/**
 * POST /api/auth/forgot-password
 */
export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    await authService.forgotPassword(req.body.email, ipAddress);
    // Always return success to prevent email enumeration
    sendSuccess(res, 'If an account with that email exists, a verification code has been sent.');
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/verify-reset-code
 */
export async function verifyResetCode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const result = await authService.verifyResetCode(req.body.email, req.body.code, ipAddress);
    sendSuccess(res, 'Code verified successfully', result);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/reset-password
 */
export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    await authService.resetPassword(req.body.resetToken, req.body.newPassword, ipAddress);
    sendSuccess(res, 'Password has been reset successfully. You can now log in with your new password.');
  } catch (error) {
    next(error);
  }
}

// ─── Phone Verification ─────────────────────────────────

/**
 * POST /api/auth/send-phone-verification
 */
export async function sendPhoneVerification(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    await authService.sendPhoneVerification(req.user!.userId, req.body.phoneNumber, ipAddress);
    sendSuccess(res, 'Verification code sent successfully.');
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/verify-phone-code
 */
export async function verifyPhoneCode(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    await authService.verifyPhoneCode(req.user!.userId, req.body.code, ipAddress);
    sendSuccess(res, 'Phone number verified successfully.');
  } catch (error) {
    next(error);
  }
}
