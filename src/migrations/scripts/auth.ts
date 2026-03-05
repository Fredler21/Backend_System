/**
 * Migration Script — Firebase Auth Users
 *
 * Imports Firebase Auth user records into the PostgreSQL users table.
 * - Maps firebaseUid for traceability
 * - Does NOT import passwords (users must use first-login setup)
 * - Enforces admin rules: only allowed emails → ADMIN role
 * - Idempotent via upsert on firebaseUid
 */

import { z } from 'zod';
import prisma from '../../database/prisma';
import { MigrationSource, Role } from '@prisma/client';
import { listAllAuthUsers } from '../core/firebase';
import {
  ProgressTracker,
  createCheckpoint,
  updateCheckpoint,
  completeCheckpoint,
  processBatch,
  chunk,
  printReport,
  defaultConfig,
} from '../core/utils';
import type { MigrationConfig, MigrationReport, MigrationScript, FirebaseAuthUser } from '../core/types';

// ─── Validation Schema ──────────────────────────────────

const firebaseUserSchema = z.object({
  uid: z.string().min(1),
  email: z.string().email().optional(),
  displayName: z.string().optional(),
  disabled: z.boolean(),
  emailVerified: z.boolean(),
  metadata: z.object({
    creationTime: z.string().optional(),
    lastSignInTime: z.string().optional(),
    lastRefreshTime: z.string().optional(),
  }),
});

// ─── Role Resolver ──────────────────────────────────────

function resolveRole(user: FirebaseAuthUser): Role {
  const allowedAdminEmails = (process.env.ADMIN_ALLOWED_EMAILS || 'admin@edlight.org,info@edlight.org')
    .split(',')
    .map((e) => e.toLowerCase().trim());

  if (user.email && allowedAdminEmails.includes(user.email.toLowerCase())) {
    return Role.ADMIN;
  }

  // Check Firebase custom claims for role hints
  if (user.customClaims?.role === 'admin') return Role.ADMIN;
  if (user.customClaims?.role === 'developer') return Role.DEVELOPER;

  return Role.STUDENT;
}

// ─── Name Parser ────────────────────────────────────────

function parseName(displayName?: string): { firstName: string; lastName: string } {
  if (!displayName) return { firstName: 'Unknown', lastName: 'User' };
  const parts = displayName.trim().split(/\s+/);
  return {
    firstName: parts[0] || 'Unknown',
    lastName: parts.slice(1).join(' ') || 'User',
  };
}

// ─── Migration Script ───────────────────────────────────

export const migrateAuthUsers: MigrationScript = {
  name: 'auth',
  description: 'Import Firebase Auth users into PostgreSQL users table with firebaseUid mapping',

  async run(config: MigrationConfig): Promise<MigrationReport> {
    const tracker = new ProgressTracker('auth');
    const checkpointId = await createCheckpoint('auth', config.dryRun);
    tracker.setCheckpointId(checkpointId);

    console.log('\n  📦 Fetching Firebase Auth users...');
    const firebaseUsers = await listAllAuthUsers();
    tracker.setTotal(firebaseUsers.length);
    console.log(`  Found ${firebaseUsers.length} Firebase Auth users\n`);

    const batches = chunk(firebaseUsers, config.batchSize);

    for (const batch of batches) {
      const result = await processBatch(
        batch,
        async (fbUser) => {
          // Validate
          const validation = firebaseUserSchema.safeParse(fbUser);
          if (!validation.success) {
            return 'skip';
          }

          // Skip users without email
          if (!fbUser.email) {
            return 'skip';
          }

          const { firstName, lastName } = parseName(fbUser.displayName);
          const role = resolveRole(fbUser);

          if (config.dryRun) {
            return 'success';
          }

          // Idempotent upsert — check by firebaseUid first, then email
          const existingByUid = await prisma.user.findUnique({
            where: { firebaseUid: fbUser.uid },
          });

          if (existingByUid) {
            return 'duplicate';
          }

          const existingByEmail = await prisma.user.findUnique({
            where: { email: fbUser.email.toLowerCase() },
          });

          if (existingByEmail) {
            // Link existing user to Firebase UID
            await prisma.user.update({
              where: { id: existingByEmail.id },
              data: {
                firebaseUid: fbUser.uid,
                source: MigrationSource.FIREBASE,
                migratedAt: new Date(),
                displayName: fbUser.displayName || null,
              },
            });
            return 'duplicate';
          }

          // Create new user (no password — requires first-login setup)
          await prisma.user.create({
            data: {
              email: fbUser.email.toLowerCase(),
              password: null,
              firstName,
              lastName,
              displayName: fbUser.displayName || null,
              role,
              isActive: !fbUser.disabled,
              firebaseUid: fbUser.uid,
              firebaseId: fbUser.uid,
              source: MigrationSource.FIREBASE,
              migratedAt: new Date(),
              lastLoginAt: fbUser.metadata.lastSignInTime
                ? new Date(fbUser.metadata.lastSignInTime)
                : null,
            },
          });

          return 'success';
        },
        config,
        (user) => user.uid,
      );

      tracker.applyBatchResult(result);
      await updateCheckpoint(checkpointId, tracker.getProgress());
    }

    const status = tracker.getProgress().failed === 0 ? 'completed' : 'partial';
    const report = tracker.toReport(status, config.dryRun);
    await completeCheckpoint(checkpointId, report);

    console.log('');
    printReport(report);
    return report;
  },
};

export default migrateAuthUsers;
