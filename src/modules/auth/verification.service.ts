import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { VerificationCodeType } from '@prisma/client';
import prisma from '../../database/prisma';
import { env } from '../../config';

const CODE_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const PASSWORD_RESET_EXPIRY_MINUTES = 10;
const PHONE_VERIFICATION_EXPIRY_MINUTES = 5;
const RATE_LIMIT_WINDOW_MINUTES = 15;
const MAX_CODES_PER_WINDOW = 3;

/**
 * Generate a cryptographically secure 6-digit code.
 */
function generateCode(): string {
  const max = Math.pow(10, CODE_LENGTH);
  const min = Math.pow(10, CODE_LENGTH - 1);
  const randomValue = crypto.randomInt(min, max);
  return randomValue.toString();
}

/**
 * Hash a verification code for secure storage.
 */
async function hashCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

/**
 * Compare a plaintext code against a hash.
 */
async function verifyCodeHash(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

/**
 * Check if a user has exceeded the rate limit for requesting codes.
 */
async function isRateLimited(userId: string, type: VerificationCodeType): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);

  const recentCodes = await prisma.verificationCode.count({
    where: {
      userId,
      type,
      createdAt: { gte: windowStart },
    },
  });

  return recentCodes >= MAX_CODES_PER_WINDOW;
}

/**
 * Create and store a new verification code.
 * Returns the plaintext code (to be sent via email/SMS).
 */
export async function createVerificationCode(
  userId: string,
  type: VerificationCodeType,
  ipAddress?: string,
): Promise<string> {
  // Rate limit check
  const limited = await isRateLimited(userId, type);
  if (limited) {
    throw new Error('Too many verification code requests. Please wait before trying again.');
  }

  // Invalidate any existing unused codes of the same type
  await prisma.verificationCode.updateMany({
    where: {
      userId,
      type,
      used: false,
      expiresAt: { gt: new Date() },
    },
    data: { used: true, usedAt: new Date() },
  });

  const code = generateCode();
  const codeHash = await hashCode(code);

  const expiryMinutes = type === VerificationCodeType.PASSWORD_RESET
    ? PASSWORD_RESET_EXPIRY_MINUTES
    : PHONE_VERIFICATION_EXPIRY_MINUTES;

  await prisma.verificationCode.create({
    data: {
      codeHash,
      type,
      userId,
      expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
      maxAttempts: MAX_ATTEMPTS,
      ipAddress,
    },
  });

  return code;
}

/**
 * Verify a code submitted by the user.
 * Returns true if valid, false if invalid.
 * Tracks attempts and marks code as used on success.
 */
export async function verifyCode(
  userId: string,
  type: VerificationCodeType,
  code: string,
): Promise<{ valid: boolean; reason?: string }> {
  // Find the latest unused, unexpired code for this user and type
  const record = await prisma.verificationCode.findFirst({
    where: {
      userId,
      type,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) {
    return { valid: false, reason: 'No valid verification code found. Please request a new one.' };
  }

  // Check attempt limit
  if (record.attempts >= record.maxAttempts) {
    // Mark as used (exhausted)
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { used: true, usedAt: new Date() },
    });
    return { valid: false, reason: 'Too many incorrect attempts. Please request a new code.' };
  }

  // Increment attempts
  await prisma.verificationCode.update({
    where: { id: record.id },
    data: { attempts: { increment: 1 } },
  });

  const isMatch = await verifyCodeHash(code, record.codeHash);

  if (!isMatch) {
    const remaining = record.maxAttempts - record.attempts - 1;
    return {
      valid: false,
      reason: remaining > 0
        ? `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Too many incorrect attempts. Please request a new code.',
    };
  }

  // Mark as used on successful verification
  await prisma.verificationCode.update({
    where: { id: record.id },
    data: { used: true, usedAt: new Date() },
  });

  return { valid: true };
}

/**
 * Clean up expired verification codes (housekeeping).
 */
export async function cleanupExpiredCodes(): Promise<number> {
  const result = await prisma.verificationCode.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { used: true, usedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      ],
    },
  });
  return result.count;
}
