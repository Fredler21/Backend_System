import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../../database/prisma';
import { env } from '../../config';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../../shared/utils';
import { logSecurityEvent } from '../security/security.service';
import type { InviteAdminInput, SetupPasswordInput } from './admin.schema';

// ─── Constants ──────────────────────────────────────────

function getAllowedEmails(): string[] {
  return env.ADMIN_ALLOWED_EMAILS.split(',').map((e) => e.toLowerCase().trim());
}

// ─── Invite Generation ──────────────────────────────────

/**
 * Generate a secure admin invitation for an allowed email.
 *   - Validates the email is on the allow-list
 *   - Pre-creates the user record (inactive, no password) if it doesn't exist
 *   - Creates a single-use, time-limited cryptographic token
 *   - Logs audit event
 */
export async function generateInvite(
  input: InviteAdminInput,
  invitedBy?: string,
  ipAddress?: string,
): Promise<{ inviteUrl: string; token: string; expiresAt: Date }> {
  const email = input.email.toLowerCase().trim();

  // 1. Verify email is on the allow-list
  if (!getAllowedEmails().includes(email)) {
    throw new ForbiddenError(
      'This email is not authorized for admin access. Only pre-approved admin emails may receive invitations.',
    );
  }

  // 2. Check if user already exists and has a password (already onboarded)
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser?.password) {
    throw new ConflictError(
      'This admin has already completed account setup. Use the login endpoint instead.',
    );
  }

  // 3. Revoke any previous unused invites for this email
  await prisma.adminInvite.updateMany({
    where: { email, used: false },
    data: { used: true, usedAt: new Date() },
  });

  // 4. Generate cryptographically secure token
  const token = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(
    Date.now() + env.ADMIN_INVITE_EXPIRY_HOURS * 60 * 60 * 1000,
  );

  // 5. Pre-create user record if it doesn't exist
  if (!existingUser) {
    await prisma.user.create({
      data: {
        email,
        password: null,
        firstName: email.split('@')[0],
        lastName: 'Admin',
        role: 'ADMIN',
        isActive: false, // Activated after password setup
      },
    });
  }

  // 6. Store invite in database
  await prisma.adminInvite.create({
    data: {
      email,
      token,
      expiresAt,
      createdBy: invitedBy,
    },
  });

  // 7. Build invite URL
  const inviteUrl = `${env.ADMIN_PANEL_URL}/setup-password?token=${token}`;

  // 8. Audit log
  await logSecurityEvent({
    type: 'ADMIN_INVITE_SENT',
    severity: 'MEDIUM',
    message: `Admin invitation sent to ${email}`,
    details: { email, expiresAt: expiresAt.toISOString(), invitedBy },
    ipAddress,
  });

  return { inviteUrl, token, expiresAt };
}

// ─── Token Verification ────────────────────────────────

/**
 * Verify an invitation token is valid (not expired, not used).
 * Returns the email associated with the token.
 */
export async function verifyInviteToken(token: string): Promise<{
  email: string;
  expiresAt: Date;
  createdAt: Date;
}> {
  const invite = await prisma.adminInvite.findUnique({ where: { token } });

  if (!invite) {
    throw new NotFoundError('Invalid invitation token');
  }

  if (invite.used) {
    throw new BadRequestError(
      'This invitation has already been used. Please request a new invitation if needed.',
    );
  }

  if (invite.expiresAt < new Date()) {
    // Mark as expired in audit
    await logSecurityEvent({
      type: 'ADMIN_INVITE_EXPIRED',
      severity: 'LOW',
      message: `Expired invitation token used for ${invite.email}`,
      details: { email: invite.email, expiredAt: invite.expiresAt.toISOString() },
    });
    throw new BadRequestError(
      'This invitation has expired. Please request a new invitation.',
    );
  }

  return {
    email: invite.email,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
  };
}

// ─── Password Setup ─────────────────────────────────────

/**
 * Complete admin onboarding by setting password via invite token.
 *   - Validates the token
 *   - Hashes the password
 *   - Activates the user account
 *   - Marks token as used (single-use)
 *   - Logs audit event
 */
export async function setupPassword(
  input: SetupPasswordInput,
  ipAddress?: string,
  userAgent?: string,
): Promise<{
  email: string;
  message: string;
}> {
  // 1. Validate token
  const invite = await prisma.adminInvite.findUnique({
    where: { token: input.token },
  });

  if (!invite) {
    throw new NotFoundError('Invalid invitation token');
  }

  if (invite.used) {
    throw new BadRequestError(
      'This invitation has already been used. Your password has already been set.',
    );
  }

  if (invite.expiresAt < new Date()) {
    await logSecurityEvent({
      type: 'ADMIN_INVITE_EXPIRED',
      severity: 'MEDIUM',
      message: `Attempted password setup with expired token for ${invite.email}`,
      details: { email: invite.email },
      ipAddress,
      userAgent,
    });
    throw new BadRequestError(
      'This invitation has expired. Please request a new invitation.',
    );
  }

  // 2. Verify user exists and has no password yet
  const user = await prisma.user.findUnique({
    where: { email: invite.email },
  });

  if (!user) {
    throw new NotFoundError('Associated admin account not found');
  }

  if (user.password) {
    throw new ConflictError(
      'Password has already been set for this account. Use the login endpoint.',
    );
  }

  // 3. Hash password
  const hashedPassword = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

  // 4. Activate user and set password in a transaction
  await prisma.$transaction([
    // Set password and activate
    prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
      },
    }),
    // Mark invite as used (single-use)
    prisma.adminInvite.update({
      where: { id: invite.id },
      data: {
        used: true,
        usedAt: new Date(),
      },
    }),
  ]);

  // 5. Audit log
  await logSecurityEvent({
    type: 'ADMIN_PASSWORD_SETUP',
    severity: 'HIGH',
    message: `Admin password set for ${invite.email}`,
    details: { email: invite.email, userId: user.id },
    userId: user.id,
    ipAddress,
    userAgent,
  });

  await logSecurityEvent({
    type: 'ADMIN_INVITE_ACCEPTED',
    severity: 'MEDIUM',
    message: `Admin invitation accepted by ${invite.email}`,
    details: { email: invite.email, inviteId: invite.id },
    userId: user.id,
    ipAddress,
    userAgent,
  });

  return {
    email: invite.email,
    message: 'Password has been set successfully. You can now log in to the admin panel.',
  };
}

// ─── List Invites (Admin Dashboard) ─────────────────────

/**
 * List all admin invitations with their status.
 */
export async function listInvites(): Promise<
  Array<{
    id: string;
    email: string;
    used: boolean;
    expired: boolean;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
    createdBy: string | null;
  }>
> {
  const invites = await prisma.adminInvite.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return invites.map((inv) => ({
    id: inv.id,
    email: inv.email,
    used: inv.used,
    expired: !inv.used && inv.expiresAt < new Date(),
    expiresAt: inv.expiresAt,
    usedAt: inv.usedAt,
    createdAt: inv.createdAt,
    createdBy: inv.createdBy,
  }));
}

/**
 * Get the list of allowed admin emails (for the UI).
 */
export function getAllowedAdminEmails(): string[] {
  return getAllowedEmails();
}
