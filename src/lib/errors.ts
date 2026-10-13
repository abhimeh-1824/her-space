/**
 * Centralized Error Handling module for HostelGuard
 * Implements strict FirestoreErrorInfo compliance and domain exceptions.
 */

import { FirestoreErrorInfo, OperationType } from '../types';

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, code = 'INTERNAL_ERROR', statusCode = 500, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required to perform this action') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient privileges for this residential jurisdiction') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed against schema specifications', details?: unknown) {
    super(message, 'VALIDATION_FAILED', 422, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} was not found in active tenancy nodes`, 'NOT_FOUND', 404);
  }
}

export interface CurrentAuthContext {
  currentUser?: {
    uid?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerData?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  } | null;
}

/**
 * Mandatory Firestore error handler conforming to skill specifications.
 * Serializes contextual auth and operation data into a structured JSON error string.
 */
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
  authContext?: CurrentAuthContext
): never {
  const user = authContext?.currentUser;

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: user?.uid ?? null,
      email: user?.email ?? null,
      emailVerified: user?.emailVerified ?? null,
      isAnonymous: user?.isAnonymous ?? null,
      tenantId: user?.tenantId ?? null,
      providerInfo:
        user?.providerData?.map((provider) => ({
          providerId: provider.providerId ?? null,
          email: provider.email ?? null,
        })) || [],
    },
  };

  const serialized = JSON.stringify(errInfo);
  console.error('Firestore Error: ', serialized);
  throw new Error(serialized);
}

/**
 * Helper to safely extract FirestoreErrorInfo or fallback error message
 */
export function parseFirestoreError(error: unknown): FirestoreErrorInfo | null {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed === 'object' && 'operationType' in parsed) {
        return parsed as FirestoreErrorInfo;
      }
    } catch {
      return null;
    }
  }
  return null;
}
