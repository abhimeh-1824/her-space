/**
 * Central Application Configuration & Environment Variable Manager
 * 
 * Single source of truth for:
 * 1. Firebase Client & Firestore Enterprise Database configuration
 * 2. Role-Based Access Control (RBAC) & Super Admin verification
 * 3. Server URL, Port, and Cloudflare Worker Cron secrets
 * 4. Gemini AI configuration
 * 
 * Safely accesses process.env with NEXT_PUBLIC_* support for client-side code
 * and falls back gracefully to defaults or firebase-applet-config.json.
 */

// Default fallback config when env vars are being provisioned
const fallbackFirebaseConfig = {
  projectId: '',
  appId: '',
  apiKey: '',
  authDomain: '',
  firestoreDatabaseId: '(default)',
  storageBucket: '',
  messagingSenderId: '',
  oAuthClientId: '',
};

// Helper to sanitize and trim strings
const envStr = (val: string | undefined, fallback: string): string => {
  if (typeof val === 'string' && val.trim().length > 0) {
    return val.trim();
  }
  return fallback;
};

// Parse authorized admin emails list strictly from environment
const parseAdminEmails = (raw: string | undefined): string[] => {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
};

const resolvedAdminEmail = envStr(process.env.ADMIN_EMAIL, '').toLowerCase();
const resolvedAdminEmails = parseAdminEmails(
  process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS
);

// If primary ADMIN_EMAIL is configured in env, ensure it is included in authorizedEmails whitelist
if (resolvedAdminEmail && !resolvedAdminEmails.includes(resolvedAdminEmail)) {
  resolvedAdminEmails.push(resolvedAdminEmail);
}

export const config = {
  // Firebase configuration (Safe for both browser client and server runtime)
  firebase: {
    projectId: envStr(
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
      fallbackFirebaseConfig.projectId
    ),
    appId: envStr(
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
      fallbackFirebaseConfig.appId
    ),
    apiKey: envStr(
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
      fallbackFirebaseConfig.apiKey
    ),
    authDomain: envStr(
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
      fallbackFirebaseConfig.authDomain || (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com` : '')
    ),
    firestoreDatabaseId: envStr(
      process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID || process.env.FIREBASE_FIRESTORE_DATABASE_ID,
      fallbackFirebaseConfig.firestoreDatabaseId
    ),
    storageBucket: envStr(
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
      fallbackFirebaseConfig.storageBucket || (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebasestorage.app` : '')
    ),
    messagingSenderId: envStr(
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
      fallbackFirebaseConfig.messagingSenderId || ''
    ),
    oAuthClientId: envStr(
      process.env.NEXT_PUBLIC_FIREBASE_OAUTH_CLIENT_ID || process.env.FIREBASE_OAUTH_CLIENT_ID,
      fallbackFirebaseConfig.oAuthClientId || ''
    ),
  },

  // Admin and RBAC Authorization configuration (Strictly from environment)
  admin: {
    email: resolvedAdminEmail,
    password: envStr(process.env.ADMIN_PASSWORD, ''),
    name: envStr(process.env.ADMIN_NAME, 'Super Administrator'),
    authorizedEmails: resolvedAdminEmails,
  },

  // Server & Networking configuration
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    appUrl: envStr(
      process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL,
      typeof window !== 'undefined' ? window.location.origin : 'https://her-space-pi.vercel.app'
    ),
    cronSecret: envStr(process.env.CRON_SECRET, ''),
    isProduction: process.env.NODE_ENV === 'production',
  },

  // Artificial Intelligence integration
  ai: {
    geminiApiKey: envStr(process.env.GEMINI_API_KEY, ''),
  },
} as const;

export type AppConfig = typeof config;

/**
 * Validates that essential configuration variables are present
 */
export function validateConfig(): boolean {
  const missing: string[] = [];
  if (!config.firebase.projectId) missing.push('FIREBASE_PROJECT_ID');
  if (!config.firebase.apiKey) missing.push('FIREBASE_API_KEY');
  if (!config.firebase.appId) missing.push('FIREBASE_APP_ID');
  if (!config.firebase.firestoreDatabaseId) missing.push('FIREBASE_FIRESTORE_DATABASE_ID');

  if (missing.length > 0) {
    console.error(`[HER-SPACE Config] Missing critical environment variables: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

export default config;
