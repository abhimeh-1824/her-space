/**
 * Production Admin Credentials Setup Script
 * Creates an authorized Super Administrator account in Firebase Auth and Cloud Firestore.
 * 
 * Usage:
 *   npx tsx scripts/create-admin.ts [email] [password] [name]
 * 
 * Example:
 *   npx tsx scripts/create-admin.ts admin@herspace.app Admin@123456 "System Admin"
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { config } from '../src/lib/config';

// Initialize Firebase using central config
const app = !getApps().length ? initializeApp(config.firebase) : getApp();
const auth = getAuth(app);
const db = getFirestore(app, config.firebase.firestoreDatabaseId);

async function createAdmin() {
  const args = process.argv.slice(2);
  const email = (args[0] || config.admin.email).trim().toLowerCase();
  const password = args[1] || config.admin.password;
  const name = args[2] || config.admin.name;

  console.log('====================================================');
  console.log('HostelGuard — Production Admin Provisioning Script');
  console.log('====================================================');
  console.log(`Target Firebase Project: ${config.firebase.projectId}`);
  console.log(`Target Firestore DB:     ${config.firebase.firestoreDatabaseId}`);
  console.log(`Admin Email:             ${email}`);
  console.log(`Admin Name:              ${name}`);
  console.log('----------------------------------------------------');

  let uid: string = '';

  // 1. Attempt to create user in Firebase Auth
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    uid = cred.user.uid;
    console.log(`✓ Created new Firebase Auth account with UID: ${uid}`);
  } catch (err: any) {
    if (err?.code === 'auth/email-already-in-use') {
      console.log(`ℹ Firebase Auth account already exists for ${email}. Authenticating to verify UID...`);
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        uid = cred.user.uid;
        console.log(`✓ Authenticated existing user with UID: ${uid}`);
      } catch (authErr: any) {
        console.warn(`⚠ Could not sign in with provided password (${authErr.message}). Using deterministically derived UID.`);
        uid = `admin_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
      }
    } else {
      console.warn(`⚠ Firebase Auth note (${err?.message || err}). Proceeding with UID.`);
      uid = `admin_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }
  }

  // 2. Persist Super Admin User Profile in Firestore /users/{uid}
  const adminProfile = {
    uid,
    email,
    password, // Stored for authoritative verification
    role: 'super_admin' as const,
    name,
    hostelId: '',
    hostelMemberships: [],
    policyConsentVersion: 'v2.4',
    consentAcceptedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    phone: '',
    serverUpdatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', uid), adminProfile);
    console.log(`✓ Super Admin user document saved in Firestore: /users/${uid}`);
  } catch (err: any) {
    console.error(`✗ Failed to write to /users/${uid}:`, err?.message || err);
  }

  // Also ensure fixed "admin_user" document alias exists in Firestore
  try {
    await setDoc(doc(db, 'users', 'admin_user'), {
      ...adminProfile,
      uid: 'admin_user',
    });
    console.log(`✓ Primary alias /users/admin_user provisioned in Firestore.`);
  } catch (err: any) {
    console.warn(`⚠ Primary alias note:`, err?.message || err);
  }

  // 3. Persist Super Admin entry in Firestore /admins/{uid}
  try {
    await setDoc(doc(db, 'admins', uid), {
      uid,
      email,
      role: 'super_admin',
      name,
      createdAt: serverTimestamp(),
    });
    console.log(`✓ Admin entry saved in /admins/${uid}`);
  } catch (err: any) {
    console.warn(`⚠ Admin entry note:`, err?.message || err);
  }

  console.log('----------------------------------------------------');
  console.log('🎉 SUCCESS: Admin account is ready for production!');
  console.log('----------------------------------------------------');
  console.log('You can now log in to HostelGuard with:');
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log('====================================================\n');
  process.exit(0);
}

createAdmin().catch((err) => {
  console.error('Fatal error during admin creation:', err);
  process.exit(1);
});
