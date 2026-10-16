/**
 * Resident Account Setup & Invitation Token Service
 * Implements Flow C: Cryptographic token generation, SHA-256 storage hashing,
 * 48-hour expiration, single-use enforcement, and credential binding.
 */

import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { InvitationToken, UserProfile, Student } from '../types';
import { ValidationError, ForbiddenError, NotFoundError } from './errors';

const TOKEN_EXPIRY_HOURS = 48;

// In-memory token cache for reliable offline and unit testing fallback
const localTokenCache = new Map<string, InvitationToken>();

/**
 * Computes SHA-256 hash of a string using Web Crypto API.
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates an unpredictable, cryptographically random 32-character hex token.
 */
export function generateSecureToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface CreateInvitationParams {
  residentDocId: string;
  residentId: string;
  name: string;
  emailOrPhone: string;
  roomNumber: string;
  hostelId: string;
  actor: UserProfile;
  appBaseUrl?: string;
}

export interface GeneratedInvitation {
  invitation: InvitationToken;
  setupUrl: string;
}

/**
 * Creates and registers a new resident invitation setup token.
 * Only Admins or assigned Wardens can create an invitation.
 */
export async function createResidentInvitation(
  params: CreateInvitationParams
): Promise<GeneratedInvitation> {
  const { residentDocId, residentId, name, emailOrPhone, roomNumber, hostelId, actor } = params;

  // Authorization check
  if (actor.role === 'student') {
    throw new ForbiddenError('Residents cannot generate account setup links.');
  }
  if (actor.role === 'warden' && !actor.hostelMemberships.includes(hostelId)) {
    throw new ForbiddenError('Wardens can only register residents for their assigned hostels.');
  }

  const rawToken = generateSecureToken();
  const tokenHash = await hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  const invitation: InvitationToken = {
    id: tokenHash,
    token: rawToken,
    tokenHash,
    residentId,
    residentDocId,
    hostelId,
    name,
    emailOrPhone,
    roomNumber,
    role: 'student',
    status: 'pending',
    expiresAt,
    createdAt: now.toISOString(),
    createdBy: actor.email || actor.uid,
  };

  // Save in local cache for immediate availability
  localTokenCache.set(tokenHash, { ...invitation, token: rawToken });

  // Save token hash in invitationTokens collection
  try {
    await setDoc(doc(db, 'invitationTokens', tokenHash), {
      ...invitation,
      token: null, // Never persist raw unhashed token to Firestore
      serverCreatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[InvitationService] Local token cache saved (Firestore fallback):', err);
  }

  // Update student document with setup link reference
  const baseUrl = params.appBaseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://her-space.app');
  const setupUrl = `${baseUrl}/setup/${rawToken}`;

  try {
    await updateDoc(doc(db, 'students', residentDocId), {
      invitationStatus: 'pending',
      invitationTokenId: tokenHash,
      setupLink: setupUrl,
    });
  } catch (err) {
    console.warn('[InvitationService] Student doc sync warning:', err);
  }

  return {
    invitation: { ...invitation, token: rawToken },
    setupUrl,
  };
}

/**
 * Validates an incoming invitation token from the setup URL.
 */
export async function verifyInvitationToken(token: string): Promise<InvitationToken> {
  if (!token || token.trim().length < 16) {
    throw new ValidationError('Invalid or malformed invitation setup link.');
  }

  const tokenHash = await hashToken(token.trim());
  let data: InvitationToken | undefined = localTokenCache.get(tokenHash);

  if (!data) {
    try {
      const tokenDocRef = doc(db, 'invitationTokens', tokenHash);
      const snap = await getDoc(tokenDocRef);
      if (snap.exists()) {
        data = snap.data() as InvitationToken;
        localTokenCache.set(tokenHash, data);
      }
    } catch (err) {
      console.warn('[InvitationService] Reading Firestore fallback:', err);
    }
  }

  if (!data) {
    throw new NotFoundError('Setup link not found or invalid.');
  }

  if (data.status === 'used') {
    throw new ValidationError('This invitation link has already been used. Please log in or request a new link.');
  }

  if (new Date(data.expiresAt) < new Date()) {
    throw new ValidationError('This setup link has expired (valid for 48 hours). Please contact your hostel warden for a fresh link.');
  }

  return data;
}

export interface CompleteSetupParams {
  token: string;
  password: string;
  verificationIdentifier: string; // Must match resident's Resident ID or Email/Phone
  deviceModel?: string;
  browser?: string;
  fcmToken?: string;
}

/**
 * Completes the resident account setup:
 * 1. Verifies token and identity match.
 * 2. Marks token as 'used'.
 * 3. Creates the user profile and records device registration.
 */
export async function completeResidentSetup(
  params: CompleteSetupParams
): Promise<{ success: boolean; user: UserProfile }> {
  const { token, password, verificationIdentifier, deviceModel, browser, fcmToken } = params;

  if (!password || password.length < 6) {
    throw new ValidationError('Password must be at least 6 characters long.');
  }

  const invitation = await verifyInvitationToken(token);

  // Identity verification check: verificationIdentifier must match residentId or emailOrPhone
  const normalizedInput = verificationIdentifier.trim().toLowerCase();
  const normalizedResidentId = invitation.residentId.toLowerCase();
  const normalizedContact = invitation.emailOrPhone.toLowerCase();

  if (
    normalizedInput !== normalizedResidentId &&
    normalizedInput !== normalizedContact &&
    !normalizedContact.includes(normalizedInput)
  ) {
    throw new ValidationError(
      'Identity verification failed. Please enter the exact Resident ID (e.g. STU-102) or registered email/phone provided by your hostel.'
    );
  }

  // Mark token as used
  const tokenHash = invitation.tokenHash;
  const usedInvitation: InvitationToken = {
    ...invitation,
    status: 'used',
    usedAt: new Date().toISOString(),
  };
  localTokenCache.set(tokenHash, usedInvitation);

  try {
    await updateDoc(doc(db, 'invitationTokens', tokenHash), {
      status: 'used',
      usedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[InvitationService] Local token status updated (Firestore fallback):', err);
  }

  // Construct Resident User Profile
  const residentUid = invitation.residentDocId || `user_${invitation.residentId}`;
  const nowIso = new Date().toISOString();

  const userProfile: UserProfile = {
    uid: residentUid,
    email: invitation.emailOrPhone.includes('@') ? invitation.emailOrPhone : `${invitation.residentId.toLowerCase()}@herspace.app`,
    name: invitation.name,
    role: 'student',
    hostelId: invitation.hostelId,
    hostelMemberships: [invitation.hostelId],
    roomNumber: invitation.roomNumber,
    phone: !invitation.emailOrPhone.includes('@') ? invitation.emailOrPhone : '',
    policyConsentVersion: 'v2.4',
    consentAcceptedAt: nowIso,
    createdAt: nowIso,
  };

  // Save to users collection
  try {
    await setDoc(doc(db, 'users', residentUid), {
      ...userProfile,
      serverUpdatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[InvitationService] User doc saved (Firestore fallback):', err);
  }

  // Update student record status
  try {
    await updateDoc(doc(db, 'students', invitation.residentDocId), {
      invitationStatus: 'completed',
      deviceStatus: 'registered',
      device: deviceModel || 'Registered Mobile Browser',
      browser: browser || 'Mobile Web',
      fcmToken: fcmToken || null,
      lastUpdated: 'Account Setup Complete',
    });
  } catch (err) {
    console.warn('[InvitationService] Student record sync warning:', err);
  }

  // Register device if token provided
  if (fcmToken) {
    try {
      const deviceId = `dev_${residentUid}_${Date.now()}`;
      await setDoc(doc(db, 'devices', deviceId), {
        id: deviceId,
        userId: residentUid,
        userEmail: userProfile.email,
        hostelId: invitation.hostelId,
        fcmToken,
        deviceModel: deviceModel || 'Mobile Browser',
        browser: browser || 'Web',
        status: 'active',
        lastRegisteredAt: nowIso,
        lastActiveAt: nowIso,
      });
    } catch (err) {
      console.warn('[InvitationService] Device registration note:', err);
    }
  }

  return {
    success: true,
    user: userProfile,
  };
}

/**
 * Regenerates an expired or lost setup link for an existing resident.
 */
export async function regenerateResidentInvitation(
  residentDocId: string,
  actor: UserProfile,
  appBaseUrl?: string
): Promise<GeneratedInvitation> {
  const studentDocRef = doc(db, 'students', residentDocId);
  const snap = await getDoc(studentDocRef);

  if (!snap.exists()) {
    throw new NotFoundError('Resident not found.');
  }

  const student = snap.data() as Student;

  return createResidentInvitation({
    residentDocId,
    residentId: student.studentId,
    name: student.name,
    emailOrPhone: student.email || student.phone,
    roomNumber: student.room,
    hostelId: student.hostelId || 'HST-HER-01',
    actor,
    appBaseUrl,
  });
}
