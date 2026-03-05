/**
 * Migration Script — Firestore Courses
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
  slugify,
  printReport,
} from '../core/utils';
import type { MigrationConfig, MigrationReport, MigrationScript, FirestoreDocument } from '../core/types';

const courseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
});

export const migrateCourses: MigrationScript = {
  name: 'courses',
  description: 'Import Firestore course documents into PostgreSQL courses table',

  async run(config: MigrationConfig): Promise<MigrationReport> {
    const tracker = new ProgressTracker('courses');
    const checkpointId = await createCheckpoint('courses', config.dryRun);

    const collectionName = config.firestoreCollection || 'courses';
    console.log(`\n  📦 Fetching Firestore collection "${collectionName}"...`);

    let documents: FirestoreDocument[];
    if (config.useRealtimeDb) {
      const { getRealtimeDbData, realtimeDbToDocuments } = await import('../core/firebase');
      const data = await getRealtimeDbData(config.realtimeDbPath || '/courses');
      documents = realtimeDbToDocuments(data);
    } else {
      documents = await getFirestoreCollection(collectionName);
    }

    tracker.setTotal(documents.length);
    console.log(`  Found ${documents.length} course documents\n`);

    const batches = chunk(documents, config.batchSize);

    for (const batch of batches) {
      const result = await processBatch(
        batch,
        async (doc) => {
          const validation = courseSchema.safeParse(doc);
          if (!validation.success) return 'skip';

          if (config.dryRun) return 'success';

          // Check duplicate by firebaseId
          const existing = await prisma.course.findFirst({
            where: { firebaseId: doc.id },
          });
          if (existing) return 'duplicate';

          // Generate unique slug
          const baseSlug = slugify((doc.slug as string) || (doc.title as string));
          let slug = baseSlug;
          let counter = 1;
          while (await prisma.course.findUnique({ where: { slug } })) {
            slug = `${baseSlug}-${counter++}`;
          }

          await prisma.course.create({
            data: {
              title: doc.title as string,
              slug,
              description: (doc.description as string) || null,
              content: (doc.content as string) || null,
              category: (doc.category as string) || null,
              level: (doc.level as string) || null,
              imageUrl: (doc.imageUrl as string) || null,
              published: (doc.published as boolean) ?? false,
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

export default migrateCourses;
