import { NextRequest, NextResponse } from 'next/server';
import { checkOutResident } from '@/lib/attendance-service';
import { CheckOutRequest } from '@/lib/attendance-service';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CheckOutRequest;

    if (!body.studentDocId || !body.studentId) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Missing student identifier' } },
        { status: 400 }
      );
    }

    const record = await checkOutResident(body);

    return NextResponse.json({
      success: true,
      data: record,
      message: 'Check OUT successful. Authoritative server timestamp recorded.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record check OUT';
    const status = (err as { statusCode?: number })?.statusCode || 500;
    return NextResponse.json(
      { success: false, error: { code: 'CHECK_OUT_FAILED', message } },
      { status }
    );
  }
}
