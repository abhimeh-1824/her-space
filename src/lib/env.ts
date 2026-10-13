/**
 * Environment validation module for HostelGuard
 * Validates runtime variables and Firebase configuration integrity.
 */

import firebaseConfig from '../../firebase-applet-config.json';

export interface ValidatedConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket: string;
  messagingSenderId: string;
  appUrl: string;
  isProduction: boolean;
}

export function validateEnvironment(): ValidatedConfig {
  const missingFields: string[] = [];

  if (!firebaseConfig.projectId) missingFields.push('projectId');
  if (!firebaseConfig.apiKey) missingFields.push('apiKey');
  if (!firebaseConfig.appId) missingFields.push('appId');
  if (!firebaseConfig.firestoreDatabaseId) missingFields.push('firestoreDatabaseId');

  if (missingFields.length > 0) {
    throw new Error(
      `[HostelGuard Env Validation] Missing critical Firebase configuration fields: ${missingFields.join(', ')}`
    );
  }

  const appUrl = (typeof process !== 'undefined' && process.env?.APP_URL) || window.location.origin;

  return {
    projectId: firebaseConfig.projectId,
    appId: firebaseConfig.appId,
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain || `${firebaseConfig.projectId}.firebaseapp.com`,
    firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
    storageBucket: firebaseConfig.storageBucket || `${firebaseConfig.projectId}.firebasestorage.app`,
    messagingSenderId: firebaseConfig.messagingSenderId || '',
    appUrl,
    isProduction: import.meta.env?.PROD ?? false,
  };
}

export const env = validateEnvironment();
