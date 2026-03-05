/**
 * Migration Script — Firebase Storage Files
 *
 * Migrates file metadata (and optionally downloads) from Firebase Storage.
 * Storage driver is configurable — does NOT assume any specific provider.
 *
 * Default behavior: records metadata in file_records table.
 * Set MIGRATION_DOWNLOAD_FILES=true to also download files locally.
 */

import prisma from '../../database/prisma';
import { MigrationSource } from '@prisma/client';
import { listStorageFiles, downloadStorageFile } from '../core/firebase';
import {
  ProgressTracker,
  createCheckpoint,
  updateCheckpoint,
  completeCheckpoint,
  processBatch,
  chunk,
  printReport,
} from '../core/utils';
import type { MigrationConfig, MigrationReport, MigrationScript, FirebaseFileMetadata } from '../core/types';
import path from 'path';
import fs from 'fs';

export const migrateFiles: MigrationScript = {
  name: 'files',
  description: 'Import Firebase Storage file metadata into PostgreSQL file_records table',

  async run(config: MigrationConfig): Promise<MigrationReport> {
    const tracker = new ProgressTracker('files');
    const checkpointId = await createCheckpoint('files', config.dryRun);

    console.log('\n  📦 Listing Firebase Storage files...');
    const files = await listStorageFiles();
    tracker.setTotal(files.length);
    console.log(`  Found ${files.length} files in Firebase Storage\n`);

    const shouldDownload = process.env.MIGRATION_DOWNLOAD_FILES === 'true';
    const downloadDir = process.env.MIGRATION_DOWNLOAD_DIR || './migration-downloads';

    if (shouldDownload && !config.dryRun) {
      fs.mkdirSync(downloadDir, { recursive: true });
      console.log(`  📥 Files will be downloaded to: ${downloadDir}`);
    }

    const batches = chunk(files, config.batchSize);

    for (const batch of batches) {
      const result = await processBatch(
        batch,
        async (file: FirebaseFileMetadata) => {
          if (config.dryRun) return 'success';

          // Check for duplicate
          const existing = await prisma.fileRecord.findFirst({
            where: { firebasePath: file.fullPath },
          });
          if (existing) return 'duplicate';

          // Determine storage path
          let storagePath = file.fullPath;
          const storageDriver = process.env.STORAGE_DRIVER || 'local';

          // Download file if enabled
          if (shouldDownload) {
            const localPath = path.join(downloadDir, file.name);
            const localDir = path.dirname(localPath);
            fs.mkdirSync(localDir, { recursive: true });

            await downloadStorageFile(file.fullPath, localPath);
            storagePath = localPath;
          }

          await prisma.fileRecord.create({
            data: {
              originalName: file.name,
              storagePath,
              storageDriver,
              mimeType: file.contentType || null,
              sizeBytes: file.size || null,
              bucket: file.bucket || null,
              isPublic: false,
              metadata: file.metadata ? JSON.parse(JSON.stringify(file.metadata)) : null,
              firebaseId: file.fullPath,
              firebasePath: file.fullPath,
              source: MigrationSource.FIREBASE,
            },
          });

          return 'success';
        },
        config,
        (file) => file.fullPath,
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

export default migrateFiles;
