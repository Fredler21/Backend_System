/**
 * Migration Script — Firestore Scholarships
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

const scholarshipSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
});

export const migrateScholarships: MigrationScript = {
  name: 'scholarships',
  description: 'Import Firestore scholarship documents into PostgreSQL scholarships table',

  async run(config: MigrationConfig): Promise<MigrationReport> {
    const tracker = new ProgressTracker('scholarships');
    const checkpointId = await createCheckpoint('scholarships', config.dryRun);

    const collectionName = config.firestoreCollection || 'scholarships';
    console.log(`\n  📦 Fetching Firestore collection "${collectionName}"...`);

    let documents: FirestoreDocument[];
    if (config.useRealtimeDb) {
      const { getRealtimeDbData, realtimeDbToDocuments } = await import('../core/firebase');
      const data = await getRealtimeDbData(config.realtimeDbPath || '/scholarships');
      documents = realtimeDbToDocuments(data);
    } else {
      documents = await getFirestoreCollection(collectionName);
    }

    tracker.setTotal(documents.length);
    console.log(`  Found ${documents.length} scholarship documents\n`);

    const batches = chunk(documents, config.batchSize);

    for (const batch of batches) {
      const result = await processBatch(
        batch,
        async (doc) => {
          const validation = scholarshipSchema.safeParse(doc);
          if (!validation.success) return 'skip';

          if (config.dryRun) return 'success';

          const existing = await prisma.scholarship.findFirst({
            where: { firebaseId: doc.id },
          });
          if (existing) return 'duplicate';

          await prisma.scholarship.create({
            data: {
              title: doc.title as string,
              description: (doc.description as string) || null,
              provider: (doc.provider as string) || null,
              amount: (doc.amount as number) || null,
              currency: (doc.currency as string) || 'USD',
              deadline: toDate(doc.deadline as string) || null,
              eligibility: (doc.eligibility as string) || null,
              applicationUrl: (doc.applicationUrl as string) || null,
              isActive: (doc.isActive as boolean) ?? true,
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

export default migrateScholarships;
