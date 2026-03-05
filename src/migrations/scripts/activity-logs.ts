/**
 * Migration Script — Firestore Activity Logs
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

const activityLogSchema = z.object({
  id: z.string().min(1),
  action: z.string().min(1),
});

export const migrateActivityLogs: MigrationScript = {
  name: 'activity_logs',
  description: 'Import Firestore activity log documents into PostgreSQL activity_logs table',

  async run(config: MigrationConfig): Promise<MigrationReport> {
    const tracker = new ProgressTracker('activity_logs');
    const checkpointId = await createCheckpoint('activity_logs', config.dryRun);

    const collectionName = config.firestoreCollection || 'activity_logs';
    console.log(`\n  📦 Fetching Firestore collection "${collectionName}"...`);

    let documents: FirestoreDocument[];
    if (config.useRealtimeDb) {
      const { getRealtimeDbData, realtimeDbToDocuments } = await import('../core/firebase');
      const data = await getRealtimeDbData(config.realtimeDbPath || '/activity_logs');
      documents = realtimeDbToDocuments(data);
    } else {
      documents = await getFirestoreCollection(collectionName);
    }

    tracker.setTotal(documents.length);
    console.log(`  Found ${documents.length} activity log documents\n`);

    const batches = chunk(documents, config.batchSize);

    for (const batch of batches) {
      const result = await processBatch(
        batch,
        async (doc) => {
          const validation = activityLogSchema.safeParse(doc);
          if (!validation.success) return 'skip';

          if (config.dryRun) return 'success';

          // Check by firebaseId for idempotency
          const existing = await prisma.activityLog.findFirst({
            where: { firebaseId: doc.id },
          });
          if (existing) return 'duplicate';

          // Resolve userId if provided
          let resolvedUserId: string | null = null;
          if (doc.userId) {
            const user = await prisma.user.findFirst({
              where: {
                OR: [
                  { firebaseUid: doc.userId as string },
                  { firebaseId: doc.userId as string },
                ],
              },
            });
            resolvedUserId = user?.id || null;
          }

          await prisma.activityLog.create({
            data: {
              action: doc.action as string,
              entity: (doc.entity as string) || null,
              entityId: (doc.entityId as string) || null,
              userId: resolvedUserId,
              details: doc.details ? JSON.parse(JSON.stringify(doc.details)) : null,
              ipAddress: (doc.ipAddress as string) || null,
              createdAt: toDate(doc.createdAt as string) || new Date(),
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

export default migrateActivityLogs;
