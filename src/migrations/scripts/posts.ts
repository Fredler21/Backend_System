/**
 * Migration Script — Firestore Posts
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
  slugify,
  printReport,
} from '../core/utils';
import type { MigrationConfig, MigrationReport, MigrationScript, FirestoreDocument } from '../core/types';

const postSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
});

export const migratePosts: MigrationScript = {
  name: 'posts',
  description: 'Import Firestore post documents into PostgreSQL posts table',

  async run(config: MigrationConfig): Promise<MigrationReport> {
    const tracker = new ProgressTracker('posts');
    const checkpointId = await createCheckpoint('posts', config.dryRun);

    const collectionName = config.firestoreCollection || 'posts';
    console.log(`\n  📦 Fetching Firestore collection "${collectionName}"...`);

    let documents: FirestoreDocument[];
    if (config.useRealtimeDb) {
      const { getRealtimeDbData, realtimeDbToDocuments } = await import('../core/firebase');
      const data = await getRealtimeDbData(config.realtimeDbPath || '/posts');
      documents = realtimeDbToDocuments(data);
    } else {
      documents = await getFirestoreCollection(collectionName);
    }

    tracker.setTotal(documents.length);
    console.log(`  Found ${documents.length} post documents\n`);

    const batches = chunk(documents, config.batchSize);

    for (const batch of batches) {
      const result = await processBatch(
        batch,
        async (doc) => {
          const validation = postSchema.safeParse(doc);
          if (!validation.success) return 'skip';

          if (config.dryRun) return 'success';

          const existing = await prisma.post.findFirst({
            where: { firebaseId: doc.id },
          });
          if (existing) return 'duplicate';

          // Generate unique slug
          const baseSlug = slugify((doc.slug as string) || (doc.title as string));
          let slug = baseSlug;
          let counter = 1;
          while (await prisma.post.findUnique({ where: { slug } })) {
            slug = `${baseSlug}-${counter++}`;
          }

          // Resolve author if firebaseUid is provided
          let authorId: string | null = null;
          if (doc.authorId) {
            const author = await prisma.user.findFirst({
              where: {
                OR: [
                  { firebaseUid: doc.authorId as string },
                  { firebaseId: doc.authorId as string },
                ],
              },
            });
            authorId = author?.id || null;
          }

          await prisma.post.create({
            data: {
              title: doc.title as string,
              slug,
              body: (doc.body as string) || null,
              excerpt: (doc.excerpt as string) || null,
              imageUrl: (doc.imageUrl as string) || null,
              published: (doc.published as boolean) ?? false,
              authorId,
              tags: Array.isArray(doc.tags) ? (doc.tags as string[]) : [],
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

export default migratePosts;
