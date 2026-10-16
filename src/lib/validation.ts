/**
 * HER-SPACE — Typed Request & Domain Validation Schemas
 * Implements strict input validation, bounds checks, and sanitization.
 */

import { ValidationError } from './errors';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Validates institutional email address
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Validates 24-hour time in "HH:MM" format
 */
export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time.trim());
}

export const Validation = {
  /**
   * Validate User Registration Payload
   */
  validateRegistration(input: {
    email?: string;
    password?: string;
    name?: string;
    hostelId?: string;
    phone?: string;
    termsAccepted?: boolean;
  }): {
    email: string;
    password: string;
    name: string;
    hostelId: string;
    phone: string;
    termsAccepted: boolean;
  } {
    if (!input.name || input.name.trim().length < 2) {
      throw new ValidationError('Name is required (minimum 2 characters).');
    }
    if (!input.email || !isValidEmail(input.email)) {
      throw new ValidationError('Valid institutional email address is required.');
    }
    if (!input.password || input.password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters.');
    }
    if (!input.hostelId || input.hostelId.trim().length === 0) {
      throw new ValidationError('Residential hostel selection is required.');
    }
    if (!input.termsAccepted) {
      throw new ValidationError('Acceptance of Terms of Service and Privacy Policy is required.');
    }

    return {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
      hostelId: input.hostelId.trim(),
      phone: input.phone?.trim() || '',
      termsAccepted: true,
    };
  },

  /**
   * Validate Login Payload
   */
  validateLogin(input: { email?: string; password?: string }): { email: string; password: string } {
    if (!input.email || !isValidEmail(input.email)) {
      throw new ValidationError('Valid institutional email is required.');
    }
    if (!input.password || input.password.length === 0) {
      throw new ValidationError('Password is required.');
    }
    return {
      email: input.email.trim().toLowerCase(),
      password: input.password.trim(),
    };
  },

  /**
   * Validate Curfew Extension Request
   */
  validateExtension(input: {
    durationMinutes?: number;
    reason?: string;
    studentDocId?: string;
  }): { durationMinutes: number; reason: string; studentDocId: string } {
    const mins = Number(input.durationMinutes);
    if (isNaN(mins) || mins < 15 || mins > 180) {
      throw new ValidationError('Curfew extension buffer must be between 15 and 180 minutes.');
    }
    if (!input.reason || input.reason.trim().length < 5) {
      throw new ValidationError('A detailed reason (minimum 5 characters) is required for curfew extension.');
    }
    if (!input.studentDocId) {
      throw new ValidationError('Student identifier is required.');
    }
    return {
      durationMinutes: mins,
      reason: input.reason.trim(),
      studentDocId: input.studentDocId,
    };
  },

  /**
   * Validate Hostel Settings
   */
  validateHostelSettings(input: {
    windowOpen?: string;
    curfewCutoff?: string;
    reminder1?: string;
    reminder2?: string;
    maxExtensionMins?: number;
    geofenceRadiusMeters?: number;
  }) {
    if (input.windowOpen && !isValidTime(input.windowOpen)) {
      throw new ValidationError(`Window open time "${input.windowOpen}" must be in HH:MM (24-hour) format.`);
    }
    if (input.curfewCutoff && !isValidTime(input.curfewCutoff)) {
      throw new ValidationError(`Curfew cutoff time "${input.curfewCutoff}" must be in HH:MM (24-hour) format.`);
    }
    if (input.reminder1 && !isValidTime(input.reminder1)) {
      throw new ValidationError(`Reminder 1 time "${input.reminder1}" must be in HH:MM format.`);
    }
    if (input.reminder2 && !isValidTime(input.reminder2)) {
      throw new ValidationError(`Reminder 2 time "${input.reminder2}" must be in HH:MM format.`);
    }
    if (input.maxExtensionMins !== undefined) {
      const mins = Number(input.maxExtensionMins);
      if (isNaN(mins) || mins < 15 || mins > 180) {
        throw new ValidationError('Max extension buffer must be between 15 and 180 minutes.');
      }
    }
    if (input.geofenceRadiusMeters !== undefined) {
      const radius = Number(input.geofenceRadiusMeters);
      if (isNaN(radius) || radius < 10 || radius > 1000) {
        throw new ValidationError('Geofence perimeter radius must be between 10 and 1,000 meters.');
      }
    }
    return input;
  },

  /**
   * Validate FCM Device Registration
   */
  validateDeviceRegistration(input: { userId?: string; fcmToken?: string; hostelId?: string }) {
    if (!input.userId) throw new ValidationError('User ID is required for device push token binding.');
    if (!input.fcmToken || input.fcmToken.trim().length === 0) {
      throw new ValidationError('FCM token cannot be empty.');
    }
    return {
      userId: input.userId,
      fcmToken: input.fcmToken.trim(),
      hostelId: input.hostelId || 'HST-HER-01',
    };
  },
};
