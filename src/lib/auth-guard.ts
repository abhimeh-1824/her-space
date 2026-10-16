/**
 * Role-Based Access Control (RBAC) & Anti-Tamper Route Guard
 * Enforces strict URL authorization and validates session integrity against tampering.
 */

import { UserRole, UserProfile } from '../types';
import { config } from './config';

// Authoritative Super Admin emails loaded from central environment config
export const AUTHORIZED_SUPER_ADMIN_EMAILS = new Set(config.admin.authorizedEmails);

/**
 * Validates a UserProfile loaded from storage against tampering.
 * If someone modifies 'role' to 'super_admin' in localStorage,
 * this function detects that the email is not an authorized administrator and strips the escalated privilege.
 */
export function validateUserProfile(profile: any): UserProfile | null {
  if (!profile || typeof profile !== 'object') return null;
  if (!profile.email || typeof profile.email !== 'string') return null;

  const email = profile.email.trim().toLowerCase();
  let role: UserRole = profile.role || 'student';

  // Anti-tamper check 1: Super Admin role can ONLY belong to authorized admin emails
  if (role === 'super_admin') {
    if (!AUTHORIZED_SUPER_ADMIN_EMAILS.has(email)) {
      console.warn(`[Security Alert] Unauthorized super_admin claim detected for ${email}. Privilege revoked.`);
      // Downgrade to warden if email matches warden pattern, else student
      role = email.includes('warden') ? 'warden' : 'student';
    }
  }

  return {
    ...profile,
    email,
    role,
  };
}

/**
 * Checks if a given role and email are authorized to access the requested pathname.
 */
export function isAuthorizedForRoute(
  role: UserRole | undefined,
  pathname: string,
  email?: string
): { authorized: boolean; redirectTo?: string; reason?: string } {
  const cleanEmail = (email || '').trim().toLowerCase();

  // 1. Admin-Only Routes: Only super_admin with verified admin email can access
  const isAdminOnlyRoute =
    pathname.startsWith('/warden/wardens') ||
    pathname.startsWith('/warden/hostels');

  if (isAdminOnlyRoute) {
    if (role === 'super_admin' && AUTHORIZED_SUPER_ADMIN_EMAILS.has(cleanEmail)) {
      return { authorized: true };
    }
    if (role === 'warden') {
      return {
        authorized: false,
        redirectTo: '/warden/dashboard',
        reason: 'Restricted: Administrator privileges required for this section.',
      };
    }
    if (role === 'student') {
      return {
        authorized: false,
        redirectTo: '/student/dashboard',
        reason: 'Restricted: Resident accounts cannot access administrative settings.',
      };
    }
    return {
      authorized: false,
      redirectTo: '/login',
      reason: 'Please sign in to access this page.',
    };
  }

  // 2. Warden & Admin General Routes (/warden/*)
  if (pathname.startsWith('/warden')) {
    if (role === 'super_admin' || role === 'warden') {
      return { authorized: true };
    }
    if (role === 'student') {
      return {
        authorized: false,
        redirectTo: '/student/dashboard',
        reason: 'Restricted: Resident accounts cannot access the Warden Portal.',
      };
    }
    return {
      authorized: false,
      redirectTo: '/login',
      reason: 'Please sign in to access the Warden Portal.',
    };
  }

  // 3. Student Routes (/student/*)
  if (pathname.startsWith('/student')) {
    if (role === 'student' || role === 'super_admin') {
      return { authorized: true };
    }
    if (role === 'warden') {
      return {
        authorized: false,
        redirectTo: '/warden/dashboard',
        reason: 'Warden accounts cannot access the Resident Portal.',
      };
    }
    return {
      authorized: false,
      redirectTo: '/login',
      reason: 'Please sign in to access the Resident Portal.',
    };
  }

  // All other public routes (e.g. /login, /setup, /rules)
  return { authorized: true };
}
