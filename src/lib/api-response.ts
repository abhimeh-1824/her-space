/**
 * Shared API Response schemas and builder utilities for HostelGuard
 * Ensures consistent serialization between client, server proxy, and audit logs.
 */

import { ApiResponse } from '../types';

export function createSuccessResponse<T>(
  data: T,
  meta?: {
    requestId?: string;
    pagination?: {
      total: number;
      page: number;
      pageSize: number;
      hasMore: boolean;
    };
  }
): ApiResponse<T> {
  return {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      requestId: meta?.requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      version: '2.4.0',
      pagination: meta?.pagination,
    },
  };
}

export function createErrorResponse(
  code: string,
  message: string,
  details?: unknown,
  requestId?: string
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      requestId: requestId || `err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      version: '2.4.0',
    },
  };
}

export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
): ApiResponse<T[]> {
  const hasMore = page * pageSize < total;
  return createSuccessResponse(items, {
    pagination: {
      total,
      page,
      pageSize,
      hasMore,
    },
  });
}
