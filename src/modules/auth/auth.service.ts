import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { TokenType, VerificationCodeType } from '@prisma/client';
import prisma from '../../database/prisma';
import { env } from '../../config';
import {
  JwtPayload,
  JwtRefreshPayload,
  AuthTokens,
  UserResponse,
  LoginResponse,
} from '../../shared/types';
import { ConflictError, UnauthorizedError, NotFoundError } from '../../shared/utils';
import { RegisterInput, LoginInput } from './auth.schema';
import {
  recordLoginAttempt,
  handleFailedLogin,
  isAccountLocked,
  detectBruteForce,
  logSecurityEvent,
} from '../security/security.service';
import { createVerificationCode, verifyCode } from './verification.service';
import { sendPasswordResetEmail, sendPhoneVerificationCode } from './email.service';

// Only these emails are allowed to log into the admin panel
const ADMIN_ALLOWED_EMAILS = ['admin@edlight.org', 'info@edlight.org'];

/**
 * Strip sensitive fields from user object.
 */
function toUserResponse(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  mustChangePassword?: boolean;
  createdAt: Date;
  updatedAt: Date;
  password?: string | null;
}): UserResponse {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...safeUser } = user;
  return safeUser as UserResponse;
}

/**
 * Generate access and refresh token pair.
 */
async function generateTokens(user: {
  id: string;
  email: string;
  role: string;
}): Promise<AuthTokens> {
  const accessPayload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role as JwtPayload['role'],
  };

  const accessToken = jwt.sign(accessPayload, env.JWT_SECRET, {
    expiresIn: Math.floor(parseExpiry(env.JWT_EXPIRES_IN) / 1000),
  });

  // Create refresh token record in database
  const refreshTokenRecord = await prisma.token.create({
    data: {
      token: '',
      type: TokenType.REFRESH,
      userId: user.id,
      expiresAt: new Date(Date.now() + parseExpiry(env.JWT_REFRESH_EXPIRES_IN)),
    },
  });

  const refreshPayload: JwtRefreshPayload = {
    userId: user.id,
    tokenId: refreshTokenRecord.id,
  };

  const refreshToken = jwt.sign(refreshPayload, env.JWT_REFRESH_SECRET, {
    expiresIn: Math.floor(parseExpiry(env.JWT_REFRESH_EXPIRES_IN) / 1000),
  });

  // Update the token record with the actual JWT
  await prisma.token.update({
    where: { id: refreshTokenRecord.id },
    data: { token: refreshToken },
  });

  return { accessToken, refreshToken };
}

/**
 * Parse expiry string (e.g. "7d", "15m") to milliseconds.
 */
function parseExpiry(expiry: string): number {
  const units: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60 * 1000; // default 15 min
  return parseInt(match[1]) * (units[match[2]] || 60000);
}

// ─── Service Methods ────────────────────────────────────

/**
 * Register a new user account.
 * Registration is currently disabled — all accounts are provisioned by admins.
 */
export async function register(_input: RegisterInput): Promise<LoginResponse> {
  throw new UnauthorizedError('Public registration is disabled. Contact an administrator.');
}

/**
 * Authenticate user credentials and return tokens.
 * Integrates with security module for intrusion detection.
 */
export async function login(input: LoginInput, ipAddress: string, userAgent?: string): Promise<LoginResponse> {
  // Check if IP is brute-forcing
  const bruteForceBlocked = await detectBruteForce(ipAddress);
  if (bruteForceBlocked) {
    throw new UnauthorizedError('Access temporarily blocked due to suspicious activity');
  }

  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    // Record failed attempt even for non-existent users
    await recordLoginAttempt({
      email: input.email,
      ipAddress,
      userAgent,
      success: false,
      failureReason: 'User not found',
    });
    throw new UnauthorizedError('Invalid email or password');
  }

  // Only whitelisted emails can log in
  if (!ADMIN_ALLOWED_EMAILS.includes(user.email.toLowerCase())) {
    await recordLoginAttempt({
      email: input.email,
      ipAddress,
      userAgent,
      success: false,
      failureReason: 'Email not authorized',
      userId: user.id,
    });
    throw new UnauthorizedError('Access denied. This account is not authorized.');
  }

  // Check if account is locked
  const locked = await isAccountLocked(user.id);
  if (locked) {
    await recordLoginAttempt({
      email: input.email,
      ipAddress,
      userAgent,
      success: false,
      failureReason: 'Account locked',
      userId: user.id,
    });
    throw new UnauthorizedError('Account is temporarily locked due to too many failed login attempts. Please try again later.');
  }

  if (!user.isActive) {
    await recordLoginAttempt({
      email: input.email,
      ipAddress,
      userAgent,
      success: false,
      failureReason: 'Account deactivated',
      userId: user.id,
    });
    throw new UnauthorizedError('Account has been deactivated');
  }

  // Reject accounts that haven't completed password setup (invite pending)
  if (!user.password) {
    await recordLoginAttempt({
      email: input.email,
      ipAddress,
      userAgent,
      success: false,
      failureReason: 'Password not set',
      userId: user.id,
    });
    throw new UnauthorizedError('Account setup is not complete. Please use your invitation link to set a password.');
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.password);

  if (!isPasswordValid) {
    // Record failed attempt and potentially lock account
    await recordLoginAttempt({
      email: input.email,
      ipAddress,
      userAgent,
      success: false,
      failureReason: 'Invalid password',
      userId: user.id,
    });

    const accountLocked = await handleFailedLogin(user.id, input.email, ipAddress);
    if (accountLocked) {
      throw new UnauthorizedError('Account locked due to too many failed login attempts. Please try again later.');
    }

    throw new UnauthorizedError('Invalid email or password');
  }

  // Successful login — record it
  await recordLoginAttempt({
    email: input.email,
    ipAddress,
    userAgent,
    success: true,
    userId: user.id,
  });

  await logSecurityEvent({
    type: 'LOGIN_SUCCESS',
    severity: 'LOW',
    message: `Successful login for ${input.email}`,
    userId: user.id,
    ipAddress,
    userAgent,
  });

  const tokens = await generateTokens(user);

  return {
    user: toUserResponse(user),
    tokens,
    mustChangePassword: user.mustChangePassword ?? false,
  };
}

/**
 * Change password for authenticated user.
 * Clears the mustChangePassword flag.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.password) {
    throw new NotFoundError('User not found');
  }

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  const hashedPassword = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      mustChangePassword: false,
    },
  });
}

/**
 * Refresh access token using a valid refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  let decoded: JwtRefreshPayload;

  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as JwtRefreshPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const tokenRecord = await prisma.token.findUnique({
    where: { id: decoded.tokenId },
  });

  if (!tokenRecord || tokenRecord.revoked || tokenRecord.expiresAt < new Date()) {
    throw new UnauthorizedError('Refresh token has been revoked or expired');
  }

  // Revoke old refresh token (rotation)
  await prisma.token.update({
    where: { id: tokenRecord.id },
    data: { revoked: true },
  });

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
  });

  if (!user || !user.isActive) {
    throw new NotFoundError('User not found or account deactivated');
  }

  return generateTokens(user);
}

/**
 * Logout — revoke the refresh token.
 */
export async function logout(refreshToken: string): Promise<void> {
  let decoded: JwtRefreshPayload;

  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as JwtRefreshPayload;
  } catch {
    // Token is invalid/expired, nothing to revoke
    return;
  }

  await prisma.token.updateMany({
    where: {
      id: decoded.tokenId,
      revoked: false,
    },
    data: { revoked: true },
  });
}

// ─── Password Reset Flow ────────────────────────────────

/**
 * Request a password reset. Sends a 6-digit code via email.
 * Always returns a generic success message to prevent email enumeration.
 */
export async function forgotPassword(email: string, ipAddress: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  if (!user || !user.isActive) {
    // Don't reveal whether the email exists — always return silently
    return;
  }

  try {
    const code = await createVerificationCode(user.id, VerificationCodeType.PASSWORD_RESET, ipAddress);

    await sendPasswordResetEmail(user.email, code);

    await logSecurityEvent({
      type: 'PASSWORD_RESET_REQUESTED',
      severity: 'MEDIUM',
      message: `Password reset requested for ${user.email}`,
      userId: user.id,
      ipAddress,
    });
  } catch (error) {
    // Log the error but don't expose it to the user
    console.error('[ForgotPassword] Error:', error instanceof Error ? error.message : error);
  }
}

/**
 * Verify the 6-digit reset code.
 * Returns a short-lived reset token if valid.
 */
export async function verifyResetCode(
  email: string,
  code: string,
  ipAddress: string,
): Promise<{ resetToken: string }> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  if (!user) {
    throw new UnauthorizedError('Invalid verification code.');
  }

  const result = await verifyCode(user.id, VerificationCodeType.PASSWORD_RESET, code);

  if (!result.valid) {
    await logSecurityEvent({
      type: 'PASSWORD_RESET_FAILED',
      severity: 'MEDIUM',
      message: `Failed password reset verification for ${user.email}: ${result.reason}`,
      userId: user.id,
      ipAddress,
    });
    throw new UnauthorizedError(result.reason || 'Invalid verification code.');
  }

  // Create a short-lived reset token (5 minutes)
  const resetTokenRecord = await prisma.token.create({
    data: {
      token: '',
      type: TokenType.PASSWORD_RESET,
      userId: user.id,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  const resetToken = jwt.sign(
    { userId: user.id, tokenId: resetTokenRecord.id, purpose: 'password-reset' },
    env.JWT_SECRET,
    { expiresIn: 300 }, // 5 minutes
  );

  await prisma.token.update({
    where: { id: resetTokenRecord.id },
    data: { token: resetToken },
  });

  return { resetToken };
}

/**
 * Reset the password using a valid reset token.
 */
export async function resetPassword(
  resetToken: string,
  newPassword: string,
  ipAddress: string,
): Promise<void> {
  let decoded: { userId: string; tokenId: string; purpose: string };

  try {
    decoded = jwt.verify(resetToken, env.JWT_SECRET) as typeof decoded;
  } catch {
    throw new UnauthorizedError('Reset token is invalid or expired. Please request a new code.');
  }

  if (decoded.purpose !== 'password-reset') {
    throw new UnauthorizedError('Invalid reset token.');
  }

  const tokenRecord = await prisma.token.findUnique({
    where: { id: decoded.tokenId },
  });

  if (!tokenRecord || tokenRecord.revoked || tokenRecord.expiresAt < new Date()) {
    throw new UnauthorizedError('Reset token has expired. Please request a new code.');
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user) {
    throw new NotFoundError('User not found.');
  }

  const hashedPassword = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
        failedLoginAttempts: 0,
        isLocked: false,
        lockedAt: null,
        lockedUntil: null,
      },
    }),
    // Revoke the reset token
    prisma.token.update({
      where: { id: tokenRecord.id },
      data: { revoked: true },
    }),
    // Revoke all existing refresh tokens (force re-login)
    prisma.token.updateMany({
      where: { userId: user.id, type: TokenType.REFRESH, revoked: false },
      data: { revoked: true },
    }),
  ]);

  await logSecurityEvent({
    type: 'PASSWORD_RESET_COMPLETED',
    severity: 'MEDIUM',
    message: `Password reset completed for ${user.email}`,
    userId: user.id,
    ipAddress,
  });
}

// ─── Phone Verification Flow ────────────────────────────

/**
 * Send a phone verification code.
 * Stores the phone number temporarily and sends a 6-digit code.
 */
export async function sendPhoneVerification(
  userId: string,
  phoneNumber: string,
  ipAddress: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found.');
  }

  // Normalize phone number (basic validation)
  const normalizedPhone = phoneNumber.replace(/[^\d+]/g, '');
  if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
    throw new UnauthorizedError('Invalid phone number format.');
  }

  // Update phone number on user record (unverified)
  await prisma.user.update({
    where: { id: userId },
    data: { phoneNumber: normalizedPhone, phoneVerified: false },
  });

  const code = await createVerificationCode(userId, VerificationCodeType.PHONE_VERIFICATION, ipAddress);

  // Send via email for now (swap to SMS when Twilio/SNS is integrated)
  await sendPhoneVerificationCode(user.email, code, 'email');

  await logSecurityEvent({
    type: 'PHONE_VERIFICATION_SENT',
    severity: 'LOW',
    message: `Phone verification code sent for ${user.email} to verify ${normalizedPhone}`,
    userId: user.id,
    ipAddress,
  });
}

/**
 * Verify the phone verification code.
 * Marks the user's phone as verified on success.
 */
export async function verifyPhoneCode(
  userId: string,
  code: string,
  ipAddress: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found.');
  }

  if (!user.phoneNumber) {
    throw new UnauthorizedError('No phone number to verify.');
  }

  const result = await verifyCode(userId, VerificationCodeType.PHONE_VERIFICATION, code);

  if (!result.valid) {
    await logSecurityEvent({
      type: 'PHONE_VERIFICATION_FAILED',
      severity: 'MEDIUM',
      message: `Failed phone verification for ${user.email}: ${result.reason}`,
      userId: user.id,
      ipAddress,
    });
    throw new UnauthorizedError(result.reason || 'Invalid verification code.');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { phoneVerified: true },
  });

  await logSecurityEvent({
    type: 'PHONE_VERIFICATION_SUCCESS',
    severity: 'LOW',
    message: `Phone number verified for ${user.email}: ${user.phoneNumber}`,
    userId: user.id,
    ipAddress,
  });
}
