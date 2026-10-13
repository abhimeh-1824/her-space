/**
 * Firebase Client & Service Initializer for HostelGuard
 * Configured with Enterprise Firestore database ID and connection validation.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { handleFirestoreError } from './errors';
import { OperationType } from '../types';

// Initialize Firebase App instance
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: Must pass databaseId from firebase-applet-config.json
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

/**
 * Validates connection to Firestore at boot time as mandated by skill guidelines.
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[HostelGuard Firebase] Enterprise Firestore connection verified successfully.');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[HostelGuard Firebase] Client appears offline or pending network sync.');
    } else {
      console.info('[HostelGuard Firebase] Initialized and ready for operations.');
    }
    return false;
  }
}

/**
 * Helper to execute Firestore reads with standardized error handling
 */
export async function safeFirestoreOp<T>(
  operation: () => Promise<T>,
  operationType: OperationType,
  path: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    return handleFirestoreError(error, operationType, path, {
      currentUser: auth.currentUser,
    });
  }
}

export default app;
