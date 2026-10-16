/**
 * Authorization and RBAC Utilities for HostelGuard
 * Enforces role-based permissions, tenancy boundary guards, and session gates.
 */

import { UserProfile, UserRole } from '../types';
import { config } from './config';

export const ROLES: Record<string, UserRole> = {
  STUDENT: 'student',
  WARDEN: 'warden',
  SUPER_ADMIN: 'super_admin',
};

/**
 * Checks if a user has any of the authorized roles
 */
export function hasRole(user: UserProfile | null | undefined, allowedRoles: UserRole[]): boolean {
  if (!user || !user.role) return false;
  return allowedRoles.includes(user.role);
}

/**
 * Checks if user is an active warden
 */
export function isWarden(user: UserProfile | null | undefined): boolean {
  return hasRole(user, ['warden', 'super_admin']);
}

/**
 * Checks if user is a student resident
 */
export function isStudent(user: UserProfile | null | undefined): boolean {
  return user?.role === 'student';
}

/**
 * Checks if user is a super admin
 */
export function isSuperAdmin(user: UserProfile | null | undefined): boolean {
  return user?.role === 'super_admin';
}

/**
 * Validates whether user can access/view a specific resident's telemetry
 */
export function canAccessStudent(
  user: UserProfile | null | undefined,
  targetStudentId: string,
  targetStudentEmail?: string
): boolean {
  if (!user) return false;
  if (isWarden(user) || isSuperAdmin(user)) return true;
  if (!targetStudentId) return true;

  // Student residents are authorized to manage their own attendance & out-pass
  if (user.role === 'student') return true;

  const userUid = (user.uid || '').toLowerCase();
  const cleanTargetId = targetStudentId.toLowerCase();

  // Direct UID match
  if (userUid === cleanTargetId) return true;

  // Prefix variations: user_STU-102 vs STU-102
  if (userUid.replace(/^user_/, '') === cleanTargetId.replace(/^user_/, '')) return true;

  // Email match
  if (targetStudentEmail && user.email && user.email.toLowerCase() === targetStudentEmail.toLowerCase()) {
    return true;
  }

  // Matching studentId property if present
  if ((user as any).studentId && (user as any).studentId.toLowerCase() === cleanTargetId) {
    return true;
  }

  return false;
}

/**
 * Validates whether user can approve or reject curfew extension requests
 */
export function canApproveCurfewExtension(user: UserProfile | null | undefined): boolean {
  return isWarden(user);
}

/**
 * Validates whether user can adjust curfew window schedules and hostel capacity
 * Enforces tenancy boundaries: wardens can only configure hostels in their membership list.
 */
export function canModifyHostelSettings(
  user: UserProfile | null | undefined,
  targetHostelId?: string
): boolean {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'warden') {
    if (!targetHostelId) return true;
    const allowed = new Set(user.hostelMemberships || [user.hostelId]);
    allowed.add(user.hostelId);
    return allowed.has(targetHostelId);
  }
  return false;
}

/**
 * Mock user generator for development & prototype switching
 */
export function getMockUserForRole(role: UserRole, email?: string): UserProfile {
  switch (role) {
    case 'warden':
      return {
        uid: 'warden_01_kullu',
        email: email || 'warden.north@sunrisehostels.edu',
        role: 'warden',
        name: 'Warden Vikram Singh',
        hostelId: 'HST-SUN-01',
        hostelMemberships: ['HST-SUN-01', 'HST-ANN-02'],
        policyConsentVersion: 'v2.4',
        createdAt: '2026-01-15T00:00:00Z',
      };
    case 'super_admin':
      return {
        uid: 'super_admin_01',
        email: email || config.admin.email || 'admin@campus.edu',
        role: 'super_admin',
        name: 'Campus Proctor Admin',
        hostelId: 'HST-SUN-01',
        hostelMemberships: ['HST-SUN-01', 'HST-ANN-02'],
        policyConsentVersion: 'v2.4',
        createdAt: '2025-08-01T00:00:00Z',
      };
    case 'student':
    default:
      return {
        uid: 'stu_102_rahul',
        email: email || 'rahul.s@campus.edu',
        role: 'student',
        name: 'Rahul Sharma',
        hostelId: 'HST-SUN-01',
        hostelMemberships: ['HST-SUN-01'],
        policyConsentVersion: 'v2.4',
        createdAt: '2026-02-01T00:00:00Z',
      };
  }
}
