/**
 * Leksihjelp — Firebase Admin SDK initialization (lazy)
 *
 * Only initializes when first called, so endpoints that don't need
 * Firebase (like /api/download) don't pay the cold-start cost.
 *
 * Environment variables required:
 *   FIREBASE_PROJECT_ID   — Firebase project ID
 *   FIREBASE_CLIENT_EMAIL — Service account email
 *   FIREBASE_PRIVATE_KEY  — Service account private key (with \\n escaped)
 */

let firebaseApp = null;
let firestoreDb = null;

async function ensureInitialized() {
  if (firebaseApp) return;

  // Dynamic import to avoid loading firebase-admin for endpoints that don't need it
  const { initializeApp, cert, getApps } = await import('firebase-admin/app');
  const { getFirestore: _getFirestore } = await import('firebase-admin/firestore');

  if (getApps().length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Firebase environment variables are not configured');
    }

    firebaseApp = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  firestoreDb = _getFirestore();
}

/**
 * Get the Firestore database instance.
 * Initializes Firebase lazily on first call.
 *
 * @returns {Promise<FirebaseFirestore.Firestore>}
 */
export async function getFirestoreDb() {
  await ensureInitialized();
  return firestoreDb;
}
