/**
 * Migration Toolkit — Shared Utilities
 * Batching, retries, progress tracking, checkpoints, and error handling.
 */

import prisma from '../../database/prisma';
import { MigrationStatus } from '@prisma/client';
import type {
  MigrationConfig,
  MigrationProgress,
  MigrationError,
  MigrationReport,
  BatchResult,
  FirebaseTimestamp,
} from './types';

// ─── Progress Tracker ───────────────────────────────────

export class ProgressTracker {
  private progress: MigrationProgress;
  private checkpointId?: string;

  constructor(module: string) {
    this.progress = {
      module,
      total: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      duplicates: 0,
      startedAt: new Date(),
      errors: [],
    };
  }

  setTotal(total: number): void {
    this.progress.total = total;
  }

  recordSuccess(count = 1): void {
    this.progress.succeeded += count;
    this.progress.processed += count;
    this.printProgress();
  }

  recordFailure(error: MigrationError): void {
    this.progress.failed += 1;
    this.progress.processed += 1;
    this.progress.errors.push(error);
    this.printProgress();
  }

  recordSkip(count = 1): void {
    this.progress.skipped += count;
    this.progress.processed += count;
    this.printProgress();
  }

  recordDuplicate(count = 1): void {
    this.progress.duplicates += count;
    this.progress.processed += count;
    this.printProgress();
  }

  setLastKey(key: string): void {
    this.progress.lastKey = key;
  }

  getProgress(): MigrationProgress {
    return { ...this.progress };
  }

  setCheckpointId(id: string): void {
    this.checkpointId = id;
  }

  getCheckpointId(): string | undefined {
    return this.checkpointId;
  }

  applyBatchResult(result: BatchResult): void {
    this.progress.succeeded += result.succeeded;
    this.progress.failed += result.failed;
    this.progress.skipped += result.skipped;
    this.progress.duplicates += result.duplicates;
    this.progress.processed += result.succeeded + result.failed + result.skipped + result.duplicates;
    this.progress.errors.push(...result.errors);
    if (result.lastKey) {
      this.progress.lastKey = result.lastKey;
    }
    this.printProgress();
  }

  toReport(status: 'completed' | 'failed' | 'partial', dryRun: boolean): MigrationReport {
    const now = new Date();
    return {
      module: this.progress.module,
      status,
      dryRun,
      summary: {
        total: this.progress.total,
        succeeded: this.progress.succeeded,
        failed: this.progress.failed,
        skipped: this.progress.skipped,
        duplicates: this.progress.duplicates,
        duration: now.getTime() - this.progress.startedAt.getTime(),
      },
      errors: this.progress.errors,
      startedAt: this.progress.startedAt,
      completedAt: now,
    };
  }

  private printProgress(): void {
    const pct = this.progress.total > 0
      ? Math.round((this.progress.processed / this.progress.total) * 100)
      : 0;
    process.stdout.write(
      `\r  [${this.progress.module}] ${pct}% — ` +
      `${this.progress.processed}/${this.progress.total} ` +
      `(✓${this.progress.succeeded} ✗${this.progress.failed} ⤸${this.progress.skipped} ⇄${this.progress.duplicates})`,
    );
  }
}

// ─── Checkpoint Manager ─────────────────────────────────

export async function createCheckpoint(
  module: string,
  dryRun: boolean,
): Promise<string> {
  const checkpoint = await prisma.migrationCheckpoint.create({
    data: {
      module,
      status: MigrationStatus.RUNNING,
      dryRun,
      startedAt: new Date(),
    },
  });
  return checkpoint.id;
}

export async function updateCheckpoint(
  id: string,
  progress: MigrationProgress,
): Promise<void> {
  await prisma.migrationCheckpoint.update({
    where: { id },
    data: {
      processed: progress.processed,
      succeeded: progress.succeeded,
      failed: progress.failed,
      skipped: progress.skipped,
      duplicates: progress.duplicates,
      totalItems: progress.total,
      lastKey: progress.lastKey,
      errorLog: progress.errors.length > 0
        ? JSON.parse(JSON.stringify(progress.errors.slice(-50)))
        : undefined,
    },
  });
}

export async function completeCheckpoint(
  id: string,
  report: MigrationReport,
): Promise<void> {
  await prisma.migrationCheckpoint.update({
    where: { id },
    data: {
      status: report.status === 'completed'
        ? MigrationStatus.COMPLETED
        : report.status === 'partial'
          ? MigrationStatus.COMPLETED
          : MigrationStatus.FAILED,
      completedAt: new Date(),
      report: JSON.parse(JSON.stringify(report)),
      totalItems: report.summary.total,
      processed: report.summary.total,
      succeeded: report.summary.succeeded,
      failed: report.summary.failed,
      skipped: report.summary.skipped,
      duplicates: report.summary.duplicates,
    },
  });
}

export async function getLastCheckpoint(
  module: string,
): Promise<{ lastKey: string | null; processed: number } | null> {
  const checkpoint = await prisma.migrationCheckpoint.findFirst({
    where: {
      module,
      status: { in: [MigrationStatus.RUNNING, MigrationStatus.COMPLETED] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!checkpoint) return null;

  return {
    lastKey: checkpoint.lastKey,
    processed: checkpoint.processed,
  };
}

// ─── Batch Processing ───────────────────────────────────

/**
 * Process items in configurable batches with retry logic.
 */
export async function processBatch<T>(
  items: T[],
  processor: (item: T) => Promise<'success' | 'skip' | 'duplicate'>,
  config: MigrationConfig,
  getItemId: (item: T) => string,
): Promise<BatchResult> {
  const result: BatchResult = {
    succeeded: 0,
    failed: 0,
    skipped: 0,
    duplicates: 0,
    errors: [],
  };

  for (const item of items) {
    const itemId = getItemId(item);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const outcome = await processor(item);
        switch (outcome) {
          case 'success':
            result.succeeded++;
            break;
          case 'skip':
            result.skipped++;
            break;
          case 'duplicate':
            result.duplicates++;
            break;
        }
        lastError = null;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < config.maxRetries) {
          const delay = config.retryDelayMs * Math.pow(2, attempt); // exponential backoff
          await sleep(delay);
        }
      }
    }

    if (lastError) {
      result.failed++;
      result.errors.push({
        itemId,
        error: lastError.message,
        timestamp: new Date(),
        retryCount: config.maxRetries,
      });
    }

    result.lastKey = itemId;
  }

  return result;
}

/**
 * Split an array into chunks of a given size.
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ─── Firebase Timestamp Helpers ─────────────────────────

/**
 * Convert Firebase timestamp (Firestore or string) to JS Date.
 */
export function toDate(
  value: string | FirebaseTimestamp | undefined | null,
): Date | undefined {
  if (!value) return undefined;

  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  }

  if (typeof value === 'object' && '_seconds' in value) {
    return new Date(value._seconds * 1000 + value._nanoseconds / 1000000);
  }

  return undefined;
}

/**
 * Slugify a string (for courses, posts).
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── Report Printer ─────────────────────────────────────

export function printReport(report: MigrationReport): void {
  const statusIcon = report.status === 'completed' ? '✅' : report.status === 'partial' ? '⚠️' : '❌';
  const durationSec = (report.summary.duration / 1000).toFixed(1);

  console.log(`
┌──────────────────────────────────────────────────────┐
│  ${statusIcon} Migration Report — ${report.module.padEnd(30)}│
├──────────────────────────────────────────────────────┤
│  Mode        : ${(report.dryRun ? 'DRY RUN' : 'WRITE').padEnd(37)}│
│  Status      : ${report.status.padEnd(37)}│
│  Duration    : ${(durationSec + 's').padEnd(37)}│
├──────────────────────────────────────────────────────┤
│  Total       : ${String(report.summary.total).padEnd(37)}│
│  Succeeded   : ${String(report.summary.succeeded).padEnd(37)}│
│  Failed      : ${String(report.summary.failed).padEnd(37)}│
│  Skipped     : ${String(report.summary.skipped).padEnd(37)}│
│  Duplicates  : ${String(report.summary.duplicates).padEnd(37)}│
└──────────────────────────────────────────────────────┘`);

  if (report.errors.length > 0) {
    console.log(`\n  Errors (showing last ${Math.min(report.errors.length, 10)}):`);
    report.errors.slice(-10).forEach((err) => {
      console.log(`    ✗ [${err.itemId}] ${err.error} (retries: ${err.retryCount})`);
    });
  }
}

// ─── Helpers ────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Default migration config values.
 */
export function defaultConfig(module: string, overrides?: Partial<MigrationConfig>): MigrationConfig {
  return {
    module,
    batchSize: 100,
    maxRetries: 3,
    retryDelayMs: 1000,
    dryRun: false,
    resumeFromCheckpoint: true,
    ...overrides,
  };
}
