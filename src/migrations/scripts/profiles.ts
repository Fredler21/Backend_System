/**
 * Migration Script — Firestore Profiles
 *
 * Imports user profile documents from Firestore into the PostgreSQL profiles table.
 * Links profiles to users via userId/firebaseUid mapping.
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

const profileSchema = z.object({
  id: z.string().min(1),
  userId: z.string().optional(),
  bio: z.string().optional(),
  avatarUrl: z.string().optional(),
  phone: z.string().optional(),
});

export const migrateProfiles: MigrationScript = {
  name: 'profiles',
  description: 'Import Firestore profile documents into PostgreSQL profiles table',

  async run(config: MigrationConfig): Promise<MigrationReport> {
    const tracker = new ProgressTracker('profiles');
    const checkpointId = await createCheckpoint('profiles', config.dryRun);

    const collectionName = config.firestoreCollection || 'profiles';
    console.log(`\n  📦 Fetching Firestore collection "${collectionName}"...`);

    let documents: FirestoreDocument[];
    if (config.useRealtimeDb) {
      const { getRealtimeDbData, realtimeDbToDocuments } = await import('../core/firebase');
      const data = await getRealtimeDbData(config.realtimeDbPath || '/profiles');
      documents = realtimeDbToDocuments(data);
    } else {
      documents = await getFirestoreCollection(collectionName);
    }

    tracker.setTotal(documents.length);
    console.log(`  Found ${documents.length} profile documents\n`);

    const batches = chunk(documents, config.batchSize);

    for (const batch of batches) {
      const result = await processBatch(
        batch,
        async (doc) => {
          const validation = profileSchema.safeParse(doc);
          if (!validation.success) return 'skip';

          // Resolve the user this profile belongs to
          const firebaseUserId = (doc.userId as string) || doc.id;
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { firebaseUid: firebaseUserId },
                { firebaseId: firebaseUserId },
              ],
            },
          });

          if (!user) return 'skip'; // User not migrated yet

          if (config.dryRun) return 'success';

          // Idempotent — upsert by userId
          const existing = await prisma.profile.findUnique({
            where: { userId: user.id },
          });

          if (existing) return 'duplicate';

          await prisma.profile.create({
            data: {
              userId: user.id,
              bio: (doc.bio as string) || null,
              avatarUrl: (doc.avatarUrl as string) || null,
              phone: (doc.phone as string) || null,
              address: (doc.address as string) || null,
              city: (doc.city as string) || null,
              country: (doc.country as string) || null,
              dateOfBirth: toDate(doc.dateOfBirth as string) || null,
              metadata: doc.metadata ? JSON.parse(JSON.stringify(doc.metadata)) : null,
              firebaseId: doc.id,
              source: MigrationSource.FIREBASE,
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

export default migrateProfiles;
