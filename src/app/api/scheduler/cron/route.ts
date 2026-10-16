import { NextRequest, NextResponse } from 'next/server';
import { handleCronSchedulerInvocation } from '@/lib/notifications';
import { NotificationJobType } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || undefined;
    const secretHeader = req.headers.get('x-cron-secret') || undefined;

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { slotKey, jobType, hostelId, sessionDate, targetUserIds, scheduledSlot, outResidents, wardenEmail } = body as {
      slotKey?: string;
      jobType?: NotificationJobType | 'night_reminder';
      hostelId?: string;
      sessionDate?: string;
      targetUserIds?: string[];
      scheduledSlot?: string;
      outResidents?: Array<{ name: string; room: string; studentId: string; outTime?: string; estimatedReturnTime?: string }>;
      wardenEmail?: string;
    };

    if (jobType === 'night_reminder') {
      const { processHostelNightReminders } = await import('@/lib/notifications');
      const result = await processHostelNightReminders({
        hostelId: hostelId || 'HST-HER-01',
        scheduledSlot: scheduledSlot || '22:15',
        sessionDate,
        authHeader,
        secretHeader,
        outResidents,
        wardenEmail,
      });

      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    const computedSlot =
      slotKey || `slot_${new Date().toISOString().replace(/[:.]/g, '_').substring(0, 16)}`;
    const computedJobType: NotificationJobType = (jobType as NotificationJobType) || 'curfew_reminder_1';

    const result = await handleCronSchedulerInvocation({
      authHeader,
      secretHeader,
      slotKey: computedSlot,
      jobType: computedJobType,
      hostelId,
      sessionDate,
      targetUserIds,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode || 500;
    const message = err instanceof Error ? err.message : 'Internal Scheduler Error';

    return NextResponse.json(
      {
        success: false,
        error: {
          code: status === 401 ? 'UNAUTHORIZED' : 'SCHEDULER_FAILED',
          message: status === 401 ? 'Unauthorized Cloudflare Cron invocation' : message,
        },
      },
      { status }
    );
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const secretHeader = req.headers.get('x-cron-secret') || '';

  const valid =
    (secretHeader && secretHeader.length > 5) ||
    (authHeader && authHeader.toLowerCase().startsWith('bearer '));

  if (!valid) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing Cloudflare Worker Cron Bearer token.',
        },
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    service: 'HER-SPACE Cloudflare Cron Receiver',
    status: 'ACTIVE_AND_LISTENING',
    timestamp: new Date().toISOString(),
  });
}
