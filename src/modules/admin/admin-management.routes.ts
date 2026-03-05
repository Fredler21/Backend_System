/**
 * Admin Management Routes
 *
 * Extended admin endpoints for user management, audit logs,
 * impersonation, login history, and migration status.
 *
 * All routes require ADMIN role unless otherwise noted.
 * Impersonation requires SUPER_ADMIN.
 */

import { Router } from 'express';
import { Role } from '@prisma/client';
import * as managementController from './admin-management.controller';
import { authenticate, authorize, validate } from '../../middleware';
import { changeRoleSchema } from './admin-management.schema';

const router = Router();

// All routes require ADMIN auth
router.use(authenticate, authorize(Role.ADMIN, Role.SUPER_ADMIN));

// ─── User Management ───────────────────────────────────

/**
 * @openapi
 * /admin/users/search:
 *   get:
 *     tags: [Admin Management]
 *     summary: Advanced user search with filters
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [STUDENT, DEVELOPER, ADMIN, SUPER_ADMIN] }
 *       - in: query
 *         name: isActive
 *         schema: { type: string, enum: ['true', 'false'] }
 *       - in: query
 *         name: isLocked
 *         schema: { type: string, enum: ['true', 'false'] }
 *       - in: query
 *         name: source
 *         schema: { type: string, enum: [FIREBASE, MANUAL, SEED] }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *     responses:
 *       200:
 *         description: Users search results
 */
router.get('/users/search', managementController.searchUsers);

/**
 * @openapi
 * /admin/users/{id}/disable:
 *   patch:
 *     tags: [Admin Management]
 *     summary: Disable a user account
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User disabled
 */
router.patch('/users/:id/disable', managementController.disableUser);

/**
 * @openapi
 * /admin/users/{id}/enable:
 *   patch:
 *     tags: [Admin Management]
 *     summary: Enable a user account
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User enabled
 */
router.patch('/users/:id/enable', managementController.enableUser);

/**
 * @openapi
 * /admin/users/{id}/role:
 *   patch:
 *     tags: [Admin Management]
 *     summary: Change user role
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [STUDENT, DEVELOPER, ADMIN, SUPER_ADMIN]
 *     responses:
 *       200:
 *         description: Role updated
 */
router.patch(
  '/users/:id/role',
  validate(changeRoleSchema),
  managementController.changeUserRole,
);

// ─── Audit Logs ─────────────────────────────────────────

/**
 * @openapi
 * /admin/audit-logs:
 *   get:
 *     tags: [Admin Management]
 *     summary: View admin audit logs (who/what/when/IP)
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
 *         name: action
 *         schema: { type: string }
 *       - in: query
 *         name: resource
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Audit logs retrieved
 */
router.get('/audit-logs', managementController.getAuditLogs);

// ─── Login History ──────────────────────────────────────

/**
 * @openapi
 * /admin/login-history:
 *   get:
 *     tags: [Admin Management]
 *     summary: View admin login history
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
 *         name: adminId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Admin login history retrieved
 */
router.get('/login-history', managementController.getAdminLoginHistory);

// ─── Impersonation (SUPER_ADMIN Only) ───────────────────

/**
 * @openapi
 * /admin/impersonate/{id}:
 *   post:
 *     tags: [Admin Management]
 *     summary: Impersonate a user (SUPER_ADMIN only, strictly logged)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Impersonation token generated
 *       403:
 *         description: SUPER_ADMIN required
 */
router.post(
  '/impersonate/:id',
  authorize(Role.SUPER_ADMIN),
  managementController.impersonateUser,
);

// ─── Migration Status ───────────────────────────────────

/**
 * @openapi
 * /admin/migration-status:
 *   get:
 *     tags: [Admin Management]
 *     summary: View Firebase migration checkpoint status
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Migration checkpoints retrieved
 */
router.get('/migration-status', managementController.getMigrationStatus);

export default router;
