/**
 * Migration Toolkit — Core Type Definitions
 * Strict TypeScript interfaces for Firebase-to-PostgreSQL data migration.
 */

// ─── Firebase Source Types ──────────────────────────────

/** Firebase Auth user record as exported from Firebase. */
export interface FirebaseAuthUser {
  uid: string;
  email?: string;
  displayName?: string;
  disabled: boolean;
  emailVerified: boolean;
  metadata: {
    creationTime?: string;
    lastSignInTime?: string;
    lastRefreshTime?: string;
  };
  providerData?: Array<{
    providerId: string;
    uid: string;
    email?: string;
    displayName?: string;
  }>;
  customClaims?: Record<string, unknown>;
  passwordHash?: string;
  passwordSalt?: string;
}

/** Generic Firestore document with id. */
export interface FirestoreDocument {
  id: string;
  [key: string]: unknown;
}

/** Firebase user profile document from Firestore. */
export interface FirebaseProfile extends FirestoreDocument {
  userId?: string;
  bio?: string;
  avatarUrl?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  dateOfBirth?: string;
  metadata?: Record<string, unknown>;
}

/** Firebase course document from Firestore. */
export interface FirebaseCourse extends FirestoreDocument {
  title?: string;
  slug?: string;
  description?: string;
  content?: string;
  category?: string;
  level?: string;
  imageUrl?: string;
  published?: boolean;
  metadata?: Record<string, unknown>;
  createdAt?: string | { _seconds: number; _nanoseconds: number };
  updatedAt?: string | { _seconds: number; _nanoseconds: number };
}

/** Firebase scholarship document from Firestore. */
export interface FirebaseScholarship extends FirestoreDocument {
  title?: string;
  description?: string;
  provider?: string;
  amount?: number;
  currency?: string;
  deadline?: string | { _seconds: number; _nanoseconds: number };
  eligibility?: string;
  applicationUrl?: string;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

/** Firebase post document from Firestore. */
export interface FirebasePost extends FirestoreDocument {
  title?: string;
  slug?: string;
  body?: string;
  excerpt?: string;
  imageUrl?: string;
  published?: boolean;
  authorId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt?: string | { _seconds: number; _nanoseconds: number };
  updatedAt?: string | { _seconds: number; _nanoseconds: number };
}

/** Firebase activity log document from Firestore. */
export interface FirebaseActivityLog extends FirestoreDocument {
  action?: string;
  entity?: string;
  entityId?: string;
  userId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt?: string | { _seconds: number; _nanoseconds: number };
}

/** Firebase Storage file metadata. */
export interface FirebaseFileMetadata {
  name: string;
  bucket: string;
  fullPath: string;
  size: number;
  contentType?: string;
  timeCreated?: string;
  updated?: string;
  metadata?: Record<string, unknown>;
}

// ─── Migration Configuration ────────────────────────────

export interface MigrationConfig {
  /** Module name (users, profiles, courses, etc.) */
  module: string;
  /** Batch size for processing */
  batchSize: number;
  /** Maximum retry attempts per item */
  maxRetries: number;
  /** Delay between retries in ms */
  retryDelayMs: number;
  /** Enable dry-run mode (no writes) */
  dryRun: boolean;
  /** Resume from checkpoint if available */
  resumeFromCheckpoint: boolean;
  /** Firestore collection name (if applicable) */
  firestoreCollection?: string;
  /** Whether to use Realtime Database instead of Firestore */
  useRealtimeDb?: boolean;
  /** Realtime Database path (if applicable) */
  realtimeDbPath?: string;
}

// ─── Migration Progress ─────────────────────────────────

export interface MigrationProgress {
  module: string;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  duplicates: number;
  lastKey?: string;
  startedAt: Date;
  errors: MigrationError[];
}

export interface MigrationError {
  itemId: string;
  error: string;
  timestamp: Date;
  retryCount: number;
  data?: Record<string, unknown>;
}

// ─── Migration Report ───────────────────────────────────

export interface MigrationReport {
  module: string;
  status: 'completed' | 'failed' | 'partial';
  dryRun: boolean;
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    skipped: number;
    duplicates: number;
    duration: number; // ms
  };
  errors: MigrationError[];
  startedAt: Date;
  completedAt: Date;
}

// ─── Migration Script Interface ─────────────────────────

export interface MigrationScript {
  /** Module name */
  readonly name: string;
  /** Description of what this migration does */
  readonly description: string;
  /** Run the migration */
  run(config: MigrationConfig): Promise<MigrationReport>;
  /** Validate source data before migration */
  validate?(config: MigrationConfig): Promise<{ valid: boolean; errors: string[] }>;
}

// ─── Batch Processor Types ──────────────────────────────

export type BatchProcessor<T> = (items: T[], config: MigrationConfig) => Promise<BatchResult>;

export interface BatchResult {
  succeeded: number;
  failed: number;
  skipped: number;
  duplicates: number;
  errors: MigrationError[];
  lastKey?: string;
}

// ─── Firebase Timestamp Helper ──────────────────────────

export interface FirebaseTimestamp {
  _seconds: number;
  _nanoseconds: number;
}
