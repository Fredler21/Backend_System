import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { env } from '../../config';
import { sendError } from '../../shared/utils';
import { logSecurityEvent } from '../security/security.service';

const isTest = process.env.NODE_ENV === 'test';

/**
 * Pass-through middleware used in test environment to disable rate limiting.
 */
const passThrough = (_req: Request, _res: Response, next: NextFunction): void => {
  next();
};

/**
 * General API rate limiter.
 * Applies to all routes. Disabled during tests.
 */
export const globalRateLimiter = isTest
  ? passThrough
  : rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
      max: env.RATE_LIMIT_MAX_REQUESTS,
      standardHeaders: true,
      legacyHeaders: false,
      validate: { xForwardedForHeader: false },
      handler: async (req, res) => {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';

        await logSecurityEvent({
          type: 'RATE_LIMIT_EXCEEDED',
          severity: 'MEDIUM',
          message: `Global rate limit exceeded from IP: ${ip}`,
          ipAddress: ip,
          userAgent: req.headers['user-agent'],
          details: { path: req.path, method: req.method },
        }).catch(() => {});

        sendError(res, 'Too many requests. Please try again later.', 429);
      },
    });

/**
 * Strict rate limiter for authentication endpoints.
 * Much lower threshold to prevent brute-force attacks. Disabled during tests.
 */
export const authRateLimiter = isTest
  ? passThrough
  : rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
      max: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
      standardHeaders: true,
      legacyHeaders: false,
      validate: { xForwardedForHeader: false },
      handler: async (req, res) => {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';

        await logSecurityEvent({
          type: 'RATE_LIMIT_EXCEEDED',
          severity: 'HIGH',
          message: `Auth rate limit exceeded from IP: ${ip} — possible brute-force attempt`,
          ipAddress: ip,
          userAgent: req.headers['user-agent'],
          details: { path: req.path, method: req.method, email: req.body?.email },
        }).catch(() => {});

        sendError(res, 'Too many authentication attempts. Please try again later.', 429);
      },
      skipSuccessfulRequests: false,
    });
