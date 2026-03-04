import { Request, Response, NextFunction } from 'express';
import { logSecurityEvent } from '../security/security.service';

/**
 * Middleware that monitors and logs all incoming requests.
 * Detects unusual patterns and logs them to the security audit.
 */
export function requestMonitor(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  // Detect suspicious headers / patterns
  const suspiciousPatterns = detectSuspiciousRequest(req);

  if (suspiciousPatterns.length > 0) {
    logSecurityEvent({
      type: 'SUSPICIOUS_ACTIVITY',
      severity: 'MEDIUM',
      message: `Suspicious request detected: ${suspiciousPatterns.join(', ')}`,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
      details: {
        method: req.method,
        path: req.path,
        patterns: suspiciousPatterns,
        headers: sanitizeHeaders(req.headers),
      },
    }).catch(() => {});
  }

  // Log response time for monitoring
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Flag slow requests (potential DoS or resource-intensive attacks)
    if (duration > 10000) {
      logSecurityEvent({
        type: 'SUSPICIOUS_ACTIVITY',
        severity: 'LOW',
        message: `Abnormally slow request detected: ${duration}ms`,
        ipAddress: ip,
        details: { method: req.method, path: req.path, duration, statusCode: res.statusCode },
      }).catch(() => {});
    }
  });

  next();
}

/**
 * Detect common attack patterns in incoming requests.
 */
function detectSuspiciousRequest(req: Request): string[] {
  const patterns: string[] = [];
  const path = req.path.toLowerCase();
  const query = JSON.stringify(req.query).toLowerCase();
  const body = typeof req.body === 'string' ? req.body.toLowerCase() : JSON.stringify(req.body || {}).toLowerCase();

  // SQL injection patterns
  const sqlPatterns = /(\b(union|select|insert|update|delete|drop|alter|exec|execute)\b.*\b(from|into|table|where|set)\b|'.*(--).*|;\s*(drop|alter|delete))/i;
  if (sqlPatterns.test(path) || sqlPatterns.test(query) || sqlPatterns.test(body)) {
    patterns.push('SQL injection attempt');
  }

  // XSS patterns
  const xssPatterns = /(<script|javascript:|on(error|load|click|mouseover)=|<iframe|<object|<embed)/i;
  if (xssPatterns.test(path) || xssPatterns.test(query) || xssPatterns.test(body)) {
    patterns.push('XSS attempt');
  }

  // Path traversal
  if (path.includes('..') || path.includes('%2e%2e') || path.includes('%252e')) {
    patterns.push('Path traversal attempt');
  }

  // Common scanner/attack paths
  const scannerPaths = [
    '/wp-admin', '/wp-login', '/phpmyadmin', '/admin.php',
    '/.env', '/.git', '/config.php', '/web.config',
    '/actuator', '/api/v1/../', '/debug', '/trace',
  ];
  if (scannerPaths.some((p) => path.includes(p))) {
    patterns.push('Scanner/probe detected');
  }

  // Excessively long values (potential buffer overflow)
  if (path.length > 2000 || query.length > 5000) {
    patterns.push('Excessively long input');
  }

  return patterns;
}

/**
 * Sanitize headers for logging (remove sensitive values).
 */
function sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...headers };
  const sensitiveKeys = ['authorization', 'cookie', 'x-api-key'];
  sensitiveKeys.forEach((key) => {
    if (sanitized[key]) {
      sanitized[key] = '[REDACTED]';
    }
  });
  return sanitized;
}
