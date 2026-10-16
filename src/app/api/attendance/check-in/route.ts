import { NextRequest, NextResponse } from 'next/server';
import { checkInResident, CheckInRequest } from '@/lib/attendance-service';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CheckInRequest;

    if (!body.studentDocId || !body.studentId || !body.location) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Missing student identifier or location coordinates' },
        },
        { status: 400 }
      );
    }

    const result = await checkInResident(body);

    if (result.isOutsideRadius) {
      return NextResponse.json(
        {
          success: false,
          isOutsideRadius: true,
          status: 'Declared OUT',
          data: result.record,
          message:
            "You appear to be outside your hostel's permitted check-in area. Your attendance status has not changed. Please return to the hostel and try again.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.record,
      status: result.status,
      message: result.message,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record check IN';
    const status = (err as { statusCode?: number })?.statusCode || 500;
    return NextResponse.json(
      { success: false, error: { code: 'CHECK_IN_FAILED', message } },
      { status }
    );
  }
}
