import { Router } from 'express';
import * as adminController from './admin.controller';
import { validate, authenticate, authorize } from '../../middleware';
import { inviteAdminSchema, setupPasswordSchema } from './admin.schema';
import { globalRateLimiter } from '../security/rateLimiter';

const router = Router();

// ─── Public Endpoints (rate-limited) ────────────────────

/**
 * @openapi
 * /admin/verify-token:
 *   get:
 *     tags: [Admin Onboarding]
 *     summary: Verify an admin invitation token
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Token is valid
 *       400:
 *         description: Token expired or already used
 *       404:
 *         description: Token not found
 */
router.get('/verify-token', globalRateLimiter, adminController.verifyToken);

/**
 * @openapi
 * /admin/setup-password:
 *   post:
 *     tags: [Admin Onboarding]
 *     summary: Set admin password using invitation token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password, confirmPassword]
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password set successfully
 *       400:
 *         description: Token expired or passwords don't match
 *       404:
 *         description: Invalid token
 *       409:
 *         description: Password already set
 */
router.post(
  '/setup-password',
  globalRateLimiter,
  validate(setupPasswordSchema),
  adminController.setupPassword,
);

// ─── Protected Endpoints (ADMIN only) ───────────────────

/**
 * @openapi
 * /admin/invite:
 *   post:
 *     tags: [Admin Onboarding]
 *     summary: Generate an admin invitation link
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       201:
 *         description: Invitation generated
 *       403:
 *         description: Email not on allow-list
 *       409:
 *         description: Admin already onboarded
 */
router.post(
  '/invite',
  authenticate,
  authorize('ADMIN'),
  validate(inviteAdminSchema),
  adminController.invite,
);

/**
 * @openapi
 * /admin/invites:
 *   get:
 *     tags: [Admin Onboarding]
 *     summary: List all admin invitations
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of invitations
 */
router.get('/invites', authenticate, authorize('ADMIN'), adminController.listInvites);

/**
 * @openapi
 * /admin/allowed-emails:
 *   get:
 *     tags: [Admin Onboarding]
 *     summary: Get allowed admin email addresses
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of allowed emails
 */
router.get(
  '/allowed-emails',
  authenticate,
  authorize('ADMIN'),
  adminController.allowedEmails,
);

export default router;
