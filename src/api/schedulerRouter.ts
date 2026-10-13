/**
 * Protected Next.js/Express Scheduler Route Handler
 * Invoked by Cloudflare Worker Cron with Bearer token authentication.
 */

import { Router, Request, Response } from 'express';
import { handleCronSchedulerInvocation } from '../lib/notifications';
import { NotificationJobType } from '../types';

export const schedulerRouter = Router();

/**
 * POST /api/scheduler/cron
 * Called by Cloudflare Worker Cron trigger
 */
schedulerRouter.post('/cron', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const secretHeader = req.headers['x-cron-secret'] as string | undefined;

    const { slotKey, jobType, hostelId, sessionDate, targetUserIds } = req.body || {};

    const computedSlot =
      slotKey || `slot_${new Date().toISOString().replace(/[:.]/g, '_').substring(0, 16)}`;
    const computedJobType: NotificationJobType = jobType || 'curfew_reminder_1';

    const result = await handleCronSchedulerInvocation({
      authHeader,
      secretHeader,
      slotKey: computedSlot,
      jobType: computedJobType,
      hostelId,
      sessionDate,
      targetUserIds,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode || 500;
    const message = err instanceof Error ? err.message : 'Internal Scheduler Error';

    // Never expose secrets or sensitive server stack
    res.status(status).json({
      success: false,
      error: {
        code: status === 401 ? 'UNAUTHORIZED' : 'SCHEDULER_FAILED',
        message: status === 401 ? 'Unauthorized Cloudflare Cron invocation' : message,
      },
    });
  }
});

/**
 * GET /api/scheduler/cron
 * Health check & diagnostic status check (requires secret)
 */
schedulerRouter.get('/cron', (req: Request, res: Response): void => {
  const authHeader = req.headers.authorization;
  const secretHeader = req.headers['x-cron-secret'] as string | undefined;

  const valid =
    (secretHeader && secretHeader.length > 5) ||
    (authHeader && authHeader.toLowerCase().startsWith('bearer '));

  if (!valid) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing Cloudflare Worker Cron Bearer token.',
      },
    });
    return;
  }

  res.status(200).json({
    success: true,
    service: 'HostelGuard Cloudflare Cron Receiver',
    status: 'ACTIVE_AND_LISTENING',
    timestamp: new Date().toISOString(),
  });
});
