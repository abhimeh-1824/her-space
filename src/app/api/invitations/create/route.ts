import { NextRequest, NextResponse } from 'next/server';
import { createResidentInvitation, CreateInvitationParams } from '@/lib/invitation-service';
import { config } from '@/lib/config';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateInvitationParams;

    if (!body.residentId || !body.name || !body.emailOrPhone || !body.roomNumber) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Full name, resident ID, room number, and contact info are required.',
          },
        },
        { status: 400 }
      );
    }

    const host = req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const appBaseUrl = host ? `${proto}://${host}` : config.server.appUrl;

    const result = await createResidentInvitation({
      ...body,
      appBaseUrl,
    });

    return NextResponse.json({
      success: true,
      data: {
        setupUrl: result.setupUrl,
        expiresAt: result.invitation.expiresAt,
        residentId: result.invitation.residentId,
      },
      message: 'Single-use setup link generated successfully.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate invitation';
    const status = (err as { statusCode?: number })?.statusCode || 500;
    return NextResponse.json(
      { success: false, error: { code: 'INVITATION_FAILED', message } },
      { status }
    );
  }
}
