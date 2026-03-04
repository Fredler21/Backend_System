import { SecurityEventType, SecuritySeverity } from '@prisma/client';
import prisma from '../../database/prisma';
import { env } from '../../config';

// ─── Login Attempt Tracking ────────────────────────────

/**
 * Record a login attempt (success or failure).
 */
export async function recordLoginAttempt(params: {
  email: string;
  ipAddress: string;
  userAgent?: string;
  success: boolean;
  failureReason?: string;
  userId?: string;
}): Promise<void> {
  await prisma.loginAttempt.create({
    data: {
      email: params.email,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      success: params.success,
      failureReason: params.failureReason,
      userId: params.userId,
    },
  });

  if (params.success && params.userId) {
    // Reset failed attempts on successful login
    await prisma.user.update({
      where: { id: params.userId },
      data: {
        failedLoginAttempts: 0,
        lastFailedLoginAt: null,
        lastLoginAt: new Date(),
        lastLoginIp: params.ipAddress,
      },
    });
  }
}

/**
 * Get count of failed login attempts for a user in the tracking window.
 */
export async function getRecentFailedAttempts(email: string): Promise<number> {
  const windowStart = new Date(
    Date.now() - env.LOGIN_ATTEMPT_WINDOW_MINUTES * 60 * 1000,
  );

  return prisma.loginAttempt.count({
    where: {
      email,
      success: false,
      createdAt: { gte: windowStart },
    },
  });
}

/**
 * Get count of failed login attempts from an IP in the tracking window.
 */
export async function getRecentFailedAttemptsByIp(ipAddress: string): Promise<number> {
  const windowStart = new Date(
    Date.now() - env.LOGIN_ATTEMPT_WINDOW_MINUTES * 60 * 1000,
  );

  return prisma.loginAttempt.count({
    where: {
      ipAddress,
      success: false,
      createdAt: { gte: windowStart },
    },
  });
}

// ─── Account Locking ───────────────────────────────────

/**
 * Increment failed login counter and lock account if threshold exceeded.
 * Returns true if account is now locked.
 */
export async function handleFailedLogin(userId: string, email: string, ipAddress: string): Promise<boolean> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: { increment: 1 },
      lastFailedLoginAt: new Date(),
    },
  });

  if (user.failedLoginAttempts >= env.MAX_LOGIN_ATTEMPTS) {
    const lockedUntil = new Date(
      Date.now() + env.ACCOUNT_LOCK_DURATION_MINUTES * 60 * 1000,
    );

    await prisma.user.update({
      where: { id: userId },
      data: {
        isLocked: true,
        lockedAt: new Date(),
        lockedUntil,
      },
    });

    await logSecurityEvent({
      type: 'ACCOUNT_LOCKED',
      severity: 'HIGH',
      message: `Account locked after ${user.failedLoginAttempts} failed login attempts`,
      userId,
      ipAddress,
      details: { email, attempts: user.failedLoginAttempts },
    });

    return true;
  }

  return false;
}

/**
 * Check if an account is currently locked. Auto-unlocks if lock has expired.
 */
export async function isAccountLocked(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isLocked: true, lockedUntil: true },
  });

  if (!user || !user.isLocked) return false;

  // Auto-unlock if lock duration has expired
  if (user.lockedUntil && user.lockedUntil < new Date()) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        isLocked: false,
        lockedAt: null,
        lockedUntil: null,
        failedLoginAttempts: 0,
      },
    });

    await logSecurityEvent({
      type: 'ACCOUNT_UNLOCKED',
      severity: 'LOW',
      message: 'Account auto-unlocked after lock duration expired',
      userId,
    });

    return false;
  }

  return true;
}

/**
 * Manually unlock an account (admin action).
 */
export async function unlockAccount(userId: string, adminId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      isLocked: false,
      lockedAt: null,
      lockedUntil: null,
      failedLoginAttempts: 0,
    },
  });

  await logSecurityEvent({
    type: 'ACCOUNT_UNLOCKED',
    severity: 'LOW',
    message: 'Account manually unlocked by administrator',
    userId,
    details: { unlockedBy: adminId },
  });
}

// ─── IP Blocking ───────────────────────────────────────

/**
 * Check if an IP address is currently blocked.
 */
export async function isIpBlocked(ipAddress: string): Promise<boolean> {
  const blocked = await prisma.blockedIp.findFirst({
    where: {
      ipAddress,
      active: true,
      OR: [
        { permanent: true },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });

  // Auto-expire blocks
  if (!blocked) {
    await prisma.blockedIp.updateMany({
      where: {
        ipAddress,
        active: true,
        permanent: false,
        expiresAt: { lte: new Date() },
      },
      data: { active: false },
    });
  }

  return !!blocked;
}

/**
 * Block an IP address temporarily.
 */
export async function blockIp(ipAddress: string, reason: string, durationMinutes?: number): Promise<void> {
  const duration = durationMinutes || env.IP_BLOCK_DURATION_MINUTES;
  const expiresAt = new Date(Date.now() + duration * 60 * 1000);

  await prisma.blockedIp.create({
    data: {
      ipAddress,
      reason,
      expiresAt,
      permanent: false,
    },
  });

  await logSecurityEvent({
    type: 'IP_BLOCKED',
    severity: 'HIGH',
    message: `IP address blocked: ${reason}`,
    ipAddress,
    details: { duration: `${duration} minutes`, expiresAt: expiresAt.toISOString() },
  });
}

/**
 * Unblock an IP address (admin action).
 */
export async function unblockIp(ipAddress: string, adminId: string): Promise<void> {
  await prisma.blockedIp.updateMany({
    where: { ipAddress, active: true },
    data: { active: false, unblockedAt: new Date(), unblockedBy: adminId },
  });

  await logSecurityEvent({
    type: 'IP_UNBLOCKED',
    severity: 'LOW',
    message: 'IP address manually unblocked by administrator',
    ipAddress,
    details: { unblockedBy: adminId },
  });
}

/**
 * Detect and block IPs with excessive failed attempts (brute force).
 */
export async function detectBruteForce(ipAddress: string): Promise<boolean> {
  const failedAttempts = await getRecentFailedAttemptsByIp(ipAddress);

  if (failedAttempts >= env.IP_BLOCK_THRESHOLD) {
    const alreadyBlocked = await isIpBlocked(ipAddress);
    if (!alreadyBlocked) {
      await blockIp(
        ipAddress,
        `Brute force detected: ${failedAttempts} failed login attempts from this IP`,
      );

      await logSecurityEvent({
        type: 'BRUTE_FORCE_DETECTED',
        severity: 'CRITICAL',
        message: `Brute force attack detected from IP: ${failedAttempts} failed attempts`,
        ipAddress,
        details: { failedAttempts },
      });

      return true;
    }
  }

  return false;
}

// ─── Security Audit Log ────────────────────────────────

/**
 * Log a security event to the audit log.
 */
export async function logSecurityEvent(params: {
  type: SecurityEventType;
  severity: SecuritySeverity;
  message: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await prisma.securityEvent.create({
    data: {
      type: params.type,
      severity: params.severity,
      message: params.message,
      userId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      details: params.details ? JSON.parse(JSON.stringify(params.details)) : undefined,
    },
  });

  // Alert admins for HIGH and CRITICAL events
  if (params.severity === 'HIGH' || params.severity === 'CRITICAL') {
    emitSecurityAlert(params);
  }
}

/**
 * Emit a security alert (console + could be extended to email/webhook).
 */
function emitSecurityAlert(params: {
  type: SecurityEventType;
  severity: SecuritySeverity;
  message: string;
  ipAddress?: string;
  userId?: string;
}): void {
  const timestamp = new Date().toISOString();
  console.warn(`
┌─────────────────────────────────────────────────────────────┐
│  🚨 SECURITY ALERT — ${params.severity.padEnd(37)}│
├─────────────────────────────────────────────────────────────┤
│  Type     : ${params.type.padEnd(46)}│
│  Message  : ${params.message.substring(0, 46).padEnd(46)}│
│  IP       : ${(params.ipAddress || 'N/A').padEnd(46)}│
│  User ID  : ${(params.userId || 'N/A').padEnd(46)}│
│  Time     : ${timestamp.padEnd(46)}│
└─────────────────────────────────────────────────────────────┘
  `);
}

// ─── Admin Query Methods ───────────────────────────────

/**
 * Get security events with filtering and pagination.
 */
export async function getSecurityEvents(params: {
  page: number;
  limit: number;
  type?: SecurityEventType;
  severity?: SecuritySeverity;
  ipAddress?: string;
  userId?: string;
  resolved?: boolean;
  startDate?: Date;
  endDate?: Date;
}): Promise<{ events: unknown[]; total: number }> {
  const { page, limit, type, severity, ipAddress, userId, resolved, startDate, endDate } = params;
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (type) where.type = type;
  if (severity) where.severity = severity;
  if (ipAddress) where.ipAddress = ipAddress;
  if (userId) where.userId = userId;
  if (resolved !== undefined) where.resolved = resolved;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [events, total] = await Promise.all([
    prisma.securityEvent.findMany({
      where,
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.securityEvent.count({ where }),
  ]);

  return { events, total };
}

/**
 * Resolve a security event (admin marks it as reviewed).
 */
export async function resolveSecurityEvent(eventId: string, adminId: string): Promise<void> {
  await prisma.securityEvent.update({
    where: { id: eventId },
    data: { resolved: true, resolvedAt: new Date(), resolvedBy: adminId },
  });
}

/**
 * Get login attempts with filtering and pagination.
 */
export async function getLoginAttempts(params: {
  page: number;
  limit: number;
  email?: string;
  ipAddress?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
}): Promise<{ attempts: unknown[]; total: number }> {
  const { page, limit, email, ipAddress, success, startDate, endDate } = params;
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (email) where.email = { contains: email, mode: 'insensitive' };
  if (ipAddress) where.ipAddress = ipAddress;
  if (success !== undefined) where.success = success;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [attempts, total] = await Promise.all([
    prisma.loginAttempt.findMany({
      where,
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.loginAttempt.count({ where }),
  ]);

  return { attempts, total };
}

/**
 * Get blocked IPs with pagination.
 */
export async function getBlockedIps(params: {
  page: number;
  limit: number;
  activeOnly?: boolean;
}): Promise<{ blockedIps: unknown[]; total: number }> {
  const { page, limit, activeOnly } = params;
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (activeOnly) where.active = true;

  const [blockedIps, total] = await Promise.all([
    prisma.blockedIp.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.blockedIp.count({ where }),
  ]);

  return { blockedIps, total };
}

/**
 * Get a security dashboard summary.
 */
export async function getSecurityDashboard(): Promise<{
  totalEvents: number;
  unresolvedEvents: number;
  criticalEvents: number;
  activeBlockedIps: number;
  lockedAccounts: number;
  failedLoginsLast24h: number;
  successfulLoginsLast24h: number;
  recentEvents: unknown[];
}> {
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    totalEvents,
    unresolvedEvents,
    criticalEvents,
    activeBlockedIps,
    lockedAccounts,
    failedLoginsLast24h,
    successfulLoginsLast24h,
    recentEvents,
  ] = await Promise.all([
    prisma.securityEvent.count(),
    prisma.securityEvent.count({ where: { resolved: false } }),
    prisma.securityEvent.count({ where: { severity: 'CRITICAL', resolved: false } }),
    prisma.blockedIp.count({ where: { active: true } }),
    prisma.user.count({ where: { isLocked: true } }),
    prisma.loginAttempt.count({ where: { success: false, createdAt: { gte: last24h } } }),
    prisma.loginAttempt.count({ where: { success: true, createdAt: { gte: last24h } } }),
    prisma.securityEvent.findMany({
      where: { createdAt: { gte: last24h } },
      include: { user: { select: { id: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  return {
    totalEvents,
    unresolvedEvents,
    criticalEvents,
    activeBlockedIps,
    lockedAccounts,
    failedLoginsLast24h,
    successfulLoginsLast24h,
    recentEvents,
  };
}
