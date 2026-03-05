/**
 * Migration Toolkit — Firebase Admin SDK Wrapper
 *
 * Configurable adapter that abstracts Firebase Admin operations.
 * Requires FIREBASE_SERVICE_ACCOUNT_PATH and FIREBASE_DATABASE_URL in .env.
 *
 * If firebase-admin is not installed, migration scripts will fail
 * gracefully with a clear error.
 */

import type {
  FirebaseAuthUser,
  FirestoreDocument,
  FirebaseFileMetadata,
} from './types';

// ─── Lazy Firebase Init ─────────────────────────────────

let firebaseApp: any = null;
let firebaseAuth: any = null;
let firebaseFirestore: any = null;
let firebaseRealtimeDb: any = null;
let firebaseStorage: any = null;

function ensureFirebase(): void {
  if (firebaseApp) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admin = require('firebase-admin');
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (!serviceAccountPath) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_PATH is not set in .env. ' +
        'Download your service account JSON from Firebase Console → Project Settings → Service Accounts.',
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serviceAccount = require(serviceAccountPath);

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });

    firebaseAuth = admin.auth();
    firebaseFirestore = admin.firestore();
    firebaseRealtimeDb = admin.database();
    firebaseStorage = admin.storage();

    console.log('  ✅ Firebase Admin SDK initialized');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Cannot find module')) {
      throw new Error(
        'firebase-admin is not installed. Run: npm install firebase-admin\n' +
        'This is only needed for migration scripts.',
      );
    }
    throw error;
  }
}

// ─── Auth Operations ────────────────────────────────────

/**
 * List all Firebase Auth users via pagination.
 */
export async function listAllAuthUsers(): Promise<FirebaseAuthUser[]> {
  ensureFirebase();
  const users: FirebaseAuthUser[] = [];
  let nextPageToken: string | undefined;

  do {
    const listResult = await firebaseAuth.listUsers(1000, nextPageToken);
    for (const userRecord of listResult.users) {
      users.push({
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        disabled: userRecord.disabled,
        emailVerified: userRecord.emailVerified,
        metadata: {
          creationTime: userRecord.metadata.creationTime,
          lastSignInTime: userRecord.metadata.lastSignInTime,
          lastRefreshTime: userRecord.metadata.lastRefreshTime,
        },
        providerData: userRecord.providerData,
        customClaims: userRecord.customClaims,
        passwordHash: userRecord.passwordHash,
        passwordSalt: userRecord.passwordSalt,
      });
    }
    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  return users;
}

// ─── Firestore Operations ───────────────────────────────

/**
 * Fetch all documents from a Firestore collection.
 */
export async function getFirestoreCollection(
  collectionName: string,
): Promise<FirestoreDocument[]> {
  ensureFirebase();
  const snapshot = await firebaseFirestore.collection(collectionName).get();
  return snapshot.docs.map((doc: any) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Fetch documents from a Firestore collection in batches (cursor-based).
 */
export async function getFirestoreCollectionBatched(
  collectionName: string,
  batchSize: number,
  startAfterKey?: string,
): Promise<{ documents: FirestoreDocument[]; lastKey?: string }> {
  ensureFirebase();
  let query = firebaseFirestore
    .collection(collectionName)
    .orderBy('__name__')
    .limit(batchSize);

  if (startAfterKey) {
    const startDoc = await firebaseFirestore.collection(collectionName).doc(startAfterKey).get();
    if (startDoc.exists) {
      query = query.startAfter(startDoc);
    }
  }

  const snapshot = await query.get();
  const documents: FirestoreDocument[] = snapshot.docs.map((doc: any) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const lastKey = documents.length > 0 ? documents[documents.length - 1].id : undefined;

  return { documents, lastKey };
}

// ─── Realtime Database Operations ───────────────────────

/**
 * Fetch all data from a Realtime Database path.
 */
export async function getRealtimeDbData(path: string): Promise<Record<string, any>> {
  ensureFirebase();
  const snapshot = await firebaseRealtimeDb.ref(path).once('value');
  return snapshot.val() || {};
}

/**
 * Convert Realtime Database JSON tree to an array of documents.
 */
export function realtimeDbToDocuments(data: Record<string, any>): FirestoreDocument[] {
  return Object.entries(data).map(([id, value]) => ({
    id,
    ...(typeof value === 'object' ? value : { value }),
  }));
}

// ─── Storage Operations ─────────────────────────────────

/**
 * List all files in a Firebase Storage bucket.
 */
export async function listStorageFiles(
  prefix?: string,
): Promise<FirebaseFileMetadata[]> {
  ensureFirebase();
  const bucket = firebaseStorage.bucket();
  const [files] = await bucket.getFiles({ prefix });

  return files.map((file: any) => ({
    name: file.name,
    bucket: file.bucket.name,
    fullPath: file.name,
    size: parseInt(file.metadata.size || '0', 10),
    contentType: file.metadata.contentType,
    timeCreated: file.metadata.timeCreated,
    updated: file.metadata.updated,
    metadata: file.metadata.metadata,
  }));
}

/**
 * Download a file from Firebase Storage to a local path.
 */
export async function downloadStorageFile(
  remotePath: string,
  localPath: string,
): Promise<void> {
  ensureFirebase();
  const bucket = firebaseStorage.bucket();
  await bucket.file(remotePath).download({ destination: localPath });
}

/**
 * Get a signed URL for a Firebase Storage file.
 */
export async function getStorageFileUrl(
  remotePath: string,
  expiresInMs = 60 * 60 * 1000,
): Promise<string> {
  ensureFirebase();
  const bucket = firebaseStorage.bucket();
  const [url] = await bucket.file(remotePath).getSignedUrl({
    action: 'read',
    expires: Date.now() + expiresInMs,
  });
  return url;
}

// ─── Cleanup ────────────────────────────────────────────

/**
 * Cleanup Firebase Admin SDK resources.
 */
export async function cleanupFirebase(): Promise<void> {
  if (firebaseApp) {
    await firebaseApp.delete();
    firebaseApp = null;
    firebaseAuth = null;
    firebaseFirestore = null;
    firebaseRealtimeDb = null;
    firebaseStorage = null;
  }
}
