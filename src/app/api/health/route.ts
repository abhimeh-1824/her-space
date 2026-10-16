import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    app: 'HER-SPACE Secure Hostel Night Attendance System',
    version: '2.4.0',
    timestamp: new Date().toISOString(),
  });
}
