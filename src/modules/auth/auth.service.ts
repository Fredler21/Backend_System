import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { TokenType } from '@prisma/client';
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
 */
export async function register(input: RegisterInput): Promise<LoginResponse> {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existingUser) {
    throw new ConflictError('An account with this email already exists');
  }

  const hashedPassword = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      password: hashedPassword,
      firstName: input.firstName,
      lastName: input.lastName,
    },
  });

  const tokens = await generateTokens(user);

  return {
    user: toUserResponse(user),
    tokens,
  };
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
