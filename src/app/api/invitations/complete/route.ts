import { NextRequest, NextResponse } from 'next/server';
import { completeResidentSetup, CompleteSetupParams } from '@/lib/invitation-service';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CompleteSetupParams;

    if (!body.token || !body.password || !body.verificationIdentifier) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Token, password, and verification identifier are required.',
          },
        },
        { status: 400 }
      );
    }

    const result = await completeResidentSetup(body);

    return NextResponse.json({
      success: true,
      data: {
        userId: result.user.uid,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        hostelId: result.user.hostelId,
      },
      message: 'Resident account successfully activated and registered.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Account setup failed';
    const status = (err as { statusCode?: number })?.statusCode || 400;
    return NextResponse.json(
      { success: false, error: { code: 'SETUP_FAILED', message } },
      { status }
    );
  }
}
