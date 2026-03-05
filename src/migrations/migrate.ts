/**
 * Migration CLI Runner
 *
 * Usage:
 *   pnpm migrate:auth           — Migrate Firebase Auth users
 *   pnpm migrate:users          — Migrate Firestore user documents
 *   pnpm migrate:profiles       — Migrate Firestore profiles
 *   pnpm migrate:courses        — Migrate Firestore courses
 *   pnpm migrate:scholarships   — Migrate Firestore scholarships
 *   pnpm migrate:posts          — Migrate Firestore posts
 *   pnpm migrate:activity_logs  — Migrate Firestore activity logs
 *   pnpm migrate:files          — Migrate Firebase Storage files
 *   pnpm migrate:all            — Run all migrations in order
 *
 * Flags:
 *   --dry-run                   — Preview mode, no writes
 *   --batch-size=N              — Items per batch (default 100)
 *   --no-resume                 — Don't resume from checkpoint
 *   --collection=NAME           — Override Firestore collection name
 *   --realtime                  — Use Realtime Database instead of Firestore
 *   --realtime-path=/path       — Realtime Database path
 */

import dotenv from 'dotenv';
dotenv.config();

import prisma from '../database/prisma';
import { cleanupFirebase } from './core/firebase';
import { defaultConfig, printReport } from './core/utils';
import type { MigrationConfig, MigrationScript, MigrationReport } from './core/types';

import { migrateAuthUsers } from './scripts/auth';
import { migrateUsers } from './scripts/users';
import { migrateProfiles } from './scripts/profiles';
import { migrateCourses } from './scripts/courses';
import { migrateScholarships } from './scripts/scholarships';
import { migratePosts } from './scripts/posts';
import { migrateActivityLogs } from './scripts/activity-logs';
import { migrateFiles } from './scripts/files';

// ─── Registry ───────────────────────────────────────────

const SCRIPTS: Record<string, MigrationScript> = {
  auth: migrateAuthUsers,
  users: migrateUsers,
  profiles: migrateProfiles,
  courses: migrateCourses,
  scholarships: migrateScholarships,
  posts: migratePosts,
  activity_logs: migrateActivityLogs,
  files: migrateFiles,
};

const MIGRATION_ORDER = [
  'auth',
  'users',
  'profiles',
  'courses',
  'scholarships',
  'posts',
  'activity_logs',
  'files',
];

// ─── Argument Parser ────────────────────────────────────

function parseArgs(): {
  module: string;
  dryRun: boolean;
  batchSize: number;
  noResume: boolean;
  collection?: string;
  useRealtimeDb: boolean;
  realtimeDbPath?: string;
} {
  const args = process.argv.slice(2);
  const module = args.find((a) => !a.startsWith('--')) || '';

  return {
    module,
    dryRun: args.includes('--dry-run'),
    batchSize: parseInt(args.find((a) => a.startsWith('--batch-size='))?.split('=')[1] || '100', 10),
    noResume: args.includes('--no-resume'),
    collection: args.find((a) => a.startsWith('--collection='))?.split('=')[1],
    useRealtimeDb: args.includes('--realtime'),
    realtimeDbPath: args.find((a) => a.startsWith('--realtime-path='))?.split('=')[1],
  };
}

function buildConfig(module: string, args: ReturnType<typeof parseArgs>): MigrationConfig {
  return defaultConfig(module, {
    dryRun: args.dryRun,
    batchSize: args.batchSize,
    resumeFromCheckpoint: !args.noResume,
    firestoreCollection: args.collection,
    useRealtimeDb: args.useRealtimeDb,
    realtimeDbPath: args.realtimeDbPath,
  });
}

// ─── Main ───────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();

  console.log(`
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   🔄 Edlight Migration Toolkit                           │
│                                                          │
│   Firebase → PostgreSQL Data Migration                   │
│                                                          │
└──────────────────────────────────────────────────────────┘`);

  if (!args.module) {
    console.log('\nUsage: tsx src/migrations/migrate.ts <module> [flags]');
    console.log('\nAvailable modules:');
    Object.entries(SCRIPTS).forEach(([name, script]) => {
      console.log(`  ${name.padEnd(20)} — ${script.description}`);
    });
    console.log(`  ${'all'.padEnd(20)} — Run all migrations in order`);
    console.log('\nFlags:');
    console.log('  --dry-run              Preview mode (no writes)');
    console.log('  --batch-size=N         Items per batch (default 100)');
    console.log('  --no-resume            Don\'t resume from last checkpoint');
    console.log('  --collection=NAME      Override Firestore collection name');
    console.log('  --realtime             Use Realtime Database');
    console.log('  --realtime-path=/p     Realtime Database path');
    process.exit(0);
  }

  // Connect to database
  await prisma.$connect();
  console.log('  ✅ Database connected\n');

  const reports: MigrationReport[] = [];

  try {
    if (args.module === 'all') {
      console.log(`  Running all migrations in order: ${MIGRATION_ORDER.join(' → ')}\n`);

      for (const moduleName of MIGRATION_ORDER) {
        const script = SCRIPTS[moduleName];
        if (!script) continue;

        console.log(`\n${'═'.repeat(60)}`);
        console.log(`  Starting: ${script.name} — ${script.description}`);
        console.log(`${'═'.repeat(60)}`);

        const config = buildConfig(moduleName, args);
        const report = await script.run(config);
        reports.push(report);

        if (report.status === 'failed') {
          console.error(`\n  ❌ Migration "${moduleName}" failed. Stopping.`);
          break;
        }
      }
    } else {
      const script = SCRIPTS[args.module];
      if (!script) {
        console.error(`\n  ❌ Unknown module: "${args.module}"`);
        console.error(`  Available: ${Object.keys(SCRIPTS).join(', ')}, all`);
        process.exit(1);
      }

      const config = buildConfig(args.module, args);

      if (config.dryRun) {
        console.log('  ⚠️  DRY RUN — no data will be written\n');
      }

      const report = await script.run(config);
      reports.push(report);
    }
  } catch (error) {
    console.error('\n  ❌ Migration error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await cleanupFirebase();
    await prisma.$disconnect();
  }

  // Print summary if running all
  if (reports.length > 1) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log('  📊 Migration Summary');
    console.log(`${'═'.repeat(60)}\n`);

    let totalSucceeded = 0;
    let totalFailed = 0;

    for (const report of reports) {
      const icon = report.status === 'completed' ? '✅' : report.status === 'partial' ? '⚠️' : '❌';
      console.log(
        `  ${icon} ${report.module.padEnd(18)} — ` +
        `✓${report.summary.succeeded} ✗${report.summary.failed} ` +
        `⤸${report.summary.skipped} ⇄${report.summary.duplicates}`,
      );
      totalSucceeded += report.summary.succeeded;
      totalFailed += report.summary.failed;
    }

    console.log(`\n  Total: ${totalSucceeded} succeeded, ${totalFailed} failed`);
  }

  const hasFailures = reports.some((r) => r.status === 'failed');
  process.exit(hasFailures ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal migration error:', error);
  process.exit(1);
});
