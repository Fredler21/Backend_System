import { Router } from 'express';
import { Role } from '@prisma/client';
import * as securityController from './security.controller';
import { authenticate, authorize, validate } from '../../middleware';
import { blockIpSchema } from './security.schema';

const router = Router();

// All security routes require admin authentication
router.use(authenticate, authorize(Role.ADMIN));

/**
 * @openapi
 * /security/dashboard:
 *   get:
 *     tags: [Security]
 *     summary: Get security monitoring dashboard
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Security dashboard data
 *       403:
 *         description: Admin access required
 */
router.get('/dashboard', securityController.getDashboard);

/**
 * @openapi
 * /security/events:
 *   get:
 *     tags: [Security]
 *     summary: List security audit events
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: severity
 *         schema: { type: string, enum: [LOW, MEDIUM, HIGH, CRITICAL] }
 *       - in: query
 *         name: resolved
 *         schema: { type: string, enum: ['true', 'false'] }
 *     responses:
 *       200:
 *         description: Security events retrieved
 */
router.get('/events', securityController.getSecurityEvents);

/**
 * @openapi
 * /security/events/{eventId}/resolve:
 *   patch:
 *     tags: [Security]
 *     summary: Mark a security event as resolved
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Event resolved
 */
router.patch('/events/:eventId/resolve', securityController.resolveEvent);

/**
 * @openapi
 * /security/login-attempts:
 *   get:
 *     tags: [Security]
 *     summary: List login attempt history
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: email
 *         schema: { type: string }
 *       - in: query
 *         name: success
 *         schema: { type: string, enum: ['true', 'false'] }
 *     responses:
 *       200:
 *         description: Login attempts retrieved
 */
router.get('/login-attempts', securityController.getLoginAttempts);

/**
 * @openapi
 * /security/blocked-ips:
 *   get:
 *     tags: [Security]
 *     summary: List blocked IP addresses
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: activeOnly
 *         schema: { type: string, enum: ['true', 'false'] }
 *     responses:
 *       200:
 *         description: Blocked IPs retrieved
 */
router.get('/blocked-ips', securityController.getBlockedIps);

/**
 * @openapi
 * /security/block-ip:
 *   post:
 *     tags: [Security]
 *     summary: Manually block an IP address
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ipAddress, reason]
 *             properties:
 *               ipAddress: { type: string }
 *               reason: { type: string }
 *               durationMinutes: { type: integer }
 *     responses:
 *       201:
 *         description: IP blocked
 */
router.post('/block-ip', validate(blockIpSchema), securityController.blockIp);

/**
 * @openapi
 * /security/unblock-ip:
 *   post:
 *     tags: [Security]
 *     summary: Unblock an IP address
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ipAddress]
 *             properties:
 *               ipAddress: { type: string }
 *     responses:
 *       200:
 *         description: IP unblocked
 */
router.post('/unblock-ip', securityController.unblockIp);

/**
 * @openapi
 * /security/unlock-account/{userId}:
 *   post:
 *     tags: [Security]
 *     summary: Manually unlock a locked user account
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Account unlocked
 */
router.post('/unlock-account/:userId', securityController.unlockAccount);

export default router;
