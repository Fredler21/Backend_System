import { Request, Response, NextFunction } from 'express';
import { isIpBlocked, logSecurityEvent } from '../security/security.service';
import { sendError } from '../../shared/utils';

/**
 * Middleware to check if the requesting IP is blocked.
 * Runs before any route handler.
 */
export async function ipBlockGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    if (ip === 'unknown' || ip === '::1' || ip === '127.0.0.1') {
      // Don't block localhost in development
      return next();
    }

    const blocked = await isIpBlocked(ip);

    if (blocked) {
      await logSecurityEvent({
        type: 'UNAUTHORIZED_ACCESS',
        severity: 'MEDIUM',
        message: `Blocked IP attempted access: ${ip}`,
        ipAddress: ip,
        userAgent: req.headers['user-agent'],
        details: { path: req.path, method: req.method },
      }).catch(() => {});

      sendError(res, 'Access denied. Your IP has been temporarily blocked due to suspicious activity.', 403);
      return;
    }

    next();
  } catch (error) {
    // Don't block requests if the security check itself fails
    next();
  }
}
