/**
 * Environment validation module for HER-SPACE / HostelGuard
 * Proxies to central config module.
 */

import { config, validateConfig } from './config';

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
  validateConfig();
  return {
    projectId: config.firebase.projectId,
    appId: config.firebase.appId,
    apiKey: config.firebase.apiKey,
    authDomain: config.firebase.authDomain,
    firestoreDatabaseId: config.firebase.firestoreDatabaseId,
    storageBucket: config.firebase.storageBucket,
    messagingSenderId: config.firebase.messagingSenderId,
    appUrl: config.server.appUrl,
    isProduction: config.server.isProduction,
  };
}

export const env = validateEnvironment();
export { config };
export default config;
