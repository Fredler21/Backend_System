# Firebase → PostgreSQL Migration Runbook

## Edlight Initiative — Production Migration Guide

This runbook details the step-by-step process for migrating data from Firebase
(Auth, Firestore/Realtime Database, Storage) into the new Node.js + PostgreSQL backend.

---

## Prerequisites

| Requirement | Details |
|---|---|
| Node.js | v20+ |
| PostgreSQL | v16+ (Docker or managed) |
| Firebase Service Account | JSON key file from Firebase Console |
| firebase-admin | `npm install firebase-admin` (only for migration) |
| Prisma CLI | Available via `npx prisma` |

---

## Phase 1: Staging Environment Setup

### 1.1 — Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your values:
# - DATABASE_URL (staging database)
# - FIREBASE_SERVICE_ACCOUNT_PATH (path to your Firebase key JSON)
# - FIREBASE_DATABASE_URL (your Firebase project URL)
# - FIREBASE_STORAGE_BUCKET (your Firebase Storage bucket)
```

### 1.2 — Apply Database Migrations

```bash
# Generate Prisma client
npx prisma generate

# Apply all schema migrations to staging DB
npx prisma migrate deploy

# Verify tables exist
npx prisma studio
```

### 1.3 — Seed Admin Accounts

```bash
npm run prisma:seed
```

---

## Phase 2: Dry-Run Migration (No Writes)

Run every module in dry-run mode first to validate data without writing.

```bash
# Dry-run all modules
npm run migrate:all:dry

# Or individually:
npm run migrate:auth -- --dry-run
npm run migrate:users -- --dry-run
npm run migrate:profiles -- --dry-run
npm run migrate:courses -- --dry-run
npm run migrate:scholarships -- --dry-run
npm run migrate:posts -- --dry-run
npm run migrate:activity_logs -- --dry-run
npm run migrate:files -- --dry-run
```

### What to verify:
- [ ] Total item counts match Firebase console
- [ ] No validation errors (skipped items are expected if data is incomplete)
- [ ] All modules complete without crashes
- [ ] Check the migration report summary for each module

---

## Phase 3: Staging Migration (Write Mode)

### 3.1 — Migrate in Order

The order matters because of foreign key dependencies:

```bash
# 1. Firebase Auth users first (creates user records)
npm run migrate:auth

# 2. Firestore user documents (enriches user records)
npm run migrate:users

# 3. Profiles (links to users)
npm run migrate:profiles

# 4. Content modules (independent)
npm run migrate:courses
npm run migrate:scholarships
npm run migrate:posts

# 5. Activity logs (links to users)
npm run migrate:activity_logs

# 6. Files (independent)
npm run migrate:files
```

Or run all at once:

```bash
npm run migrate:all
```

### 3.2 — Idempotency Guarantee

All migrations are safe to re-run:
- Users are matched by `firebaseUid` or `email`
- Content is matched by `firebaseId`
- Re-running produces `duplicate` count, not errors

### 3.3 — Checkpoint Recovery

If a migration fails mid-way:
- Progress is saved to `migration_checkpoints` table
- Re-running the same module resumes from the last checkpoint
- Use `--no-resume` to force a full re-run

---

## Phase 4: Validation

### 4.1 — Count Verification

```sql
-- Compare counts against Firebase console
SELECT 'users' AS table_name, COUNT(*) FROM users WHERE source = 'FIREBASE'
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles WHERE source = 'FIREBASE'
UNION ALL
SELECT 'courses', COUNT(*) FROM courses WHERE source = 'FIREBASE'
UNION ALL
SELECT 'scholarships', COUNT(*) FROM scholarships WHERE source = 'FIREBASE'
UNION ALL
SELECT 'posts', COUNT(*) FROM posts WHERE source = 'FIREBASE'
UNION ALL
SELECT 'activity_logs', COUNT(*) FROM activity_logs WHERE source = 'FIREBASE'
UNION ALL
SELECT 'file_records', COUNT(*) FROM file_records WHERE source = 'FIREBASE';
```

### 4.2 — Traceability Verification

```sql
-- Verify Firebase UID mapping
SELECT id, email, firebase_uid, source, migrated_at
FROM users
WHERE source = 'FIREBASE'
LIMIT 10;
```

### 4.3 — Migration Report Review

```sql
-- Check checkpoint reports
SELECT module, status, total_items, succeeded, failed, skipped, duplicates
FROM migration_checkpoints
ORDER BY created_at DESC;
```

### 4.4 — Functional Tests

- [ ] Migrated user can trigger "Setup Password" flow
- [ ] Migrated user can log in after setting password
- [ ] Migrated courses/posts/scholarships appear in API responses
- [ ] Admin dashboard shows correct user counts
- [ ] Firebase UID lookups return correct users

---

## Phase 5: Production Cutover

### 5.1 — Pre-Cutover Checklist

- [ ] All staging migration reports show `completed` status
- [ ] Failed item count is 0 (or all failures are documented/accepted)
- [ ] Functional tests pass on staging
- [ ] Database backup of production is taken
- [ ] Maintenance window scheduled and communicated
- [ ] DNS/CDN changes prepared (if applicable)

### 5.2 — Cutover Steps

```bash
# 1. Put Firebase app in read-only mode (disable writes)

# 2. Run final delta migration on production
#    (safe because of idempotency — only new items are created)
npm run migrate:all

# 3. Verify counts match
#    (run the SQL queries from Phase 4)

# 4. Switch frontend to point to new backend

# 5. Monitor /health, /readiness, and /metrics endpoints

# 6. Verify login flows work for migrated users
```

### 5.3 — Rollback Plan

If critical issues are found:

1. Revert frontend to Firebase
2. Migration data in PostgreSQL is safe to keep (no data loss)
3. Fix issues and re-run migration

---

## Phase 6: Post-Migration

### 6.1 — Cleanup

```bash
# Remove Firebase deps (optional, after full cutover)
npm uninstall firebase-admin

# Remove FIREBASE_* variables from .env
# Archive migration scripts (keep in repo for reference)
```

### 6.2 — Monitoring

- Monitor `/metrics` for user counts and system health
- Check `/api/security/dashboard` for security events
- Review audit logs at `/api/admin/audit-logs`
- Watch for users unable to log in (need password setup)

### 6.3 — User Communication

- Email migrated users with "Set up your new password" instructions
- Provide admin invite links for admin users
- Document the new login flow for the team

---

## Migration CLI Reference

| Command | Description |
|---|---|
| `npm run migrate:auth` | Firebase Auth → users table |
| `npm run migrate:users` | Firestore users → users table |
| `npm run migrate:profiles` | Firestore profiles → profiles table |
| `npm run migrate:courses` | Firestore courses → courses table |
| `npm run migrate:scholarships` | Firestore scholarships → scholarships table |
| `npm run migrate:posts` | Firestore posts → posts table |
| `npm run migrate:activity_logs` | Firestore activity logs → activity_logs table |
| `npm run migrate:files` | Firebase Storage → file_records table |
| `npm run migrate:all` | All modules in order |
| `npm run migrate:all:dry` | Dry-run all modules |

### CLI Flags

| Flag | Description |
|---|---|
| `--dry-run` | Preview mode — no database writes |
| `--batch-size=N` | Items per batch (default: 100) |
| `--no-resume` | Don't resume from last checkpoint |
| `--collection=NAME` | Override Firestore collection name |
| `--realtime` | Use Realtime Database instead of Firestore |
| `--realtime-path=/path` | Realtime Database path |

---

## Architecture Overview

```
src/migrations/
├── migrate.ts              # CLI entry point
├── index.ts                # Public exports
├── core/
│   ├── types.ts            # Strict TypeScript interfaces
│   ├── utils.ts            # Batching, retries, checkpoints, progress
│   ├── firebase.ts         # Firebase Admin SDK wrapper
│   └── index.ts
└── scripts/
    ├── auth.ts             # Firebase Auth users
    ├── users.ts            # Firestore user documents
    ├── profiles.ts         # Firestore profiles
    ├── courses.ts          # Firestore courses
    ├── scholarships.ts     # Firestore scholarships
    ├── posts.ts            # Firestore posts
    ├── activity-logs.ts    # Firestore activity logs
    ├── files.ts            # Firebase Storage files
    └── index.ts
```
