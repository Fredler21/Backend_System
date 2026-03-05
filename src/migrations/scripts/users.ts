/**
 * Migration Script — Firestore Users (Profile Data)
 *
 * Imports user profile/document data from Firestore "users" collection
 * into the PostgreSQL users table. Separate from Firebase Auth migration.
 * This handles Firestore-stored user documents (e.g., extra profile fields).
 *
 * - Maps firebaseId for traceability
 * - Idempotent via upsert on email or firebaseId
 */

import { z } from 'zod';
import prisma from '../../database/prisma';
import { MigrationSource } from '@prisma/client';
import { getFirestoreCollection } from '../core/firebase';
import {
  ProgressTracker,
  createCheckpoint,
  updateCheckpoint,
  completeCheckpoint,
  processBatch,
  chunk,
  toDate,
  printReport,
} from '../core/utils';
import type { MigrationConfig, MigrationReport, MigrationScript, FirestoreDocument } from '../core/types';

// ─── Validation Schema ──────────────────────────────────

const firestoreUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  displayName: z.string().optional(),
  role: z.string().optional(),
});

// ─── Migration Script ───────────────────────────────────

export const migrateUsers: MigrationScript = {
  name: 'users',
  description: 'Import Firestore user documents into PostgreSQL users table',

  async run(config: MigrationConfig): Promise<MigrationReport> {
    const tracker = new ProgressTracker('users');
    const checkpointId = await createCheckpoint('users', config.dryRun);
    tracker.setCheckpointId(checkpointId);

    const collectionName = config.firestoreCollection || 'users';
    console.log(`\n  📦 Fetching Firestore collection "${collectionName}"...`);

    let documents: FirestoreDocument[];
    if (config.useRealtimeDb) {
      const { getRealtimeDbData, realtimeDbToDocuments } = await import('../core/firebase');
      const data = await getRealtimeDbData(config.realtimeDbPath || '/users');
      documents = realtimeDbToDocuments(data);
    } else {
      documents = await getFirestoreCollection(collectionName);
    }

    tracker.setTotal(documents.length);
    console.log(`  Found ${documents.length} user documents\n`);

    const batches = chunk(documents, config.batchSize);

    for (const batch of batches) {
      const result = await processBatch(
        batch,
        async (doc) => {
          const validation = firestoreUserSchema.safeParse(doc);
          if (!validation.success) {
            return 'skip';
          }

          const email = (doc.email as string)?.toLowerCase();
          if (!email) return 'skip';

          if (config.dryRun) return 'success';

          // Find existing user by email or firebaseId
          const existing = await prisma.user.findFirst({
            where: {
              OR: [
                { email },
                { firebaseId: doc.id },
              ],
            },
          });

          if (existing) {
            // Update with Firestore data if not already linked
            if (!existing.firebaseId) {
              await prisma.user.update({
                where: { id: existing.id },
                data: {
                  firebaseId: doc.id,
                  source: MigrationSource.FIREBASE,
                  migratedAt: new Date(),
                  firstName: (doc.firstName as string) || existing.firstName,
                  lastName: (doc.lastName as string) || existing.lastName,
                },
              });
            }
            return 'duplicate';
          }

          // Parse name
          const displayName = (doc.displayName as string) || '';
          const nameParts = displayName.split(/\s+/);
          const firstName = (doc.firstName as string) || nameParts[0] || 'Unknown';
          const lastName = (doc.lastName as string) || nameParts.slice(1).join(' ') || 'User';

          await prisma.user.create({
            data: {
              email,
              password: null,
              firstName,
              lastName,
              displayName: displayName || null,
              firebaseId: doc.id,
              source: MigrationSource.FIREBASE,
              migratedAt: new Date(),
              isActive: true,
              lastLoginAt: toDate(doc.lastLoginAt as string) || null,
            },
          });

          return 'success';
        },
        config,
        (doc) => doc.id,
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

export default migrateUsers;
