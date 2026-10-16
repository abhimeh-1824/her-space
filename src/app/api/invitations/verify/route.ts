import { NextRequest, NextResponse } from 'next/server';
import { verifyInvitationToken } from '@/lib/invitation-service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Token query parameter is required' } },
        { status: 400 }
      );
    }

    const invitation = await verifyInvitationToken(token);

    // Return safe resident metadata without revealing sensitive data
    return NextResponse.json({
      success: true,
      data: {
        name: invitation.name,
        residentId: invitation.residentId,
        roomNumber: invitation.roomNumber,
        hostelId: invitation.hostelId,
        expiresAt: invitation.expiresAt,
        status: invitation.status,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid or expired setup token';
    const status = (err as { statusCode?: number })?.statusCode || 400;
    return NextResponse.json(
      { success: false, error: { code: 'TOKEN_INVALID', message } },
      { status }
    );
  }
}
