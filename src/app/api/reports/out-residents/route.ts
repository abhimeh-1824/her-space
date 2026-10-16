import { NextRequest, NextResponse } from 'next/server';
import { generateAbsenceReport } from '@/lib/absence-report-service';

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const hostelId = body.hostelId || 'HST-HER-01';
    const hostelName = body.hostelName || 'HER-SPACE Residency';
    const reminderSlot = body.reminderSlot || '22:15';
    const sessionDate = body.sessionDate;

    const report = await generateAbsenceReport({
      hostelId,
      hostelName,
      reminderSlot,
      sessionDate,
    });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate absence report';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const hostelId = searchParams.get('hostelId') || 'HST-HER-01';
  const reminderSlot = searchParams.get('slot') || '22:15';

  try {
    const report = await generateAbsenceReport({
      hostelId,
      reminderSlot,
    });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: 'Internal Error' }, { status: 500 });
  }
}
