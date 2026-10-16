import { NextRequest, NextResponse } from 'next/server';
import { recordEstimatedReturnTime } from '@/lib/attendance-service';
import { UserProfile } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      studentDocId: string;
      hostelId: string;
      estimatedReturnTime: string;
      actor: UserProfile;
    };

    if (!body.studentDocId || !body.estimatedReturnTime) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Missing student identifier or return time' },
        },
        { status: 400 }
      );
    }

    await recordEstimatedReturnTime(
      body.studentDocId,
      body.hostelId || 'HST-HER-01',
      body.estimatedReturnTime,
      body.actor
    );

    return NextResponse.json({
      success: true,
      message: 'Estimated return time recorded successfully. (Attendance status remains OUT).',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record return time';
    return NextResponse.json(
      { success: false, error: { code: 'RETURN_TIME_FAILED', message } },
      { status: 500 }
    );
  }
}
