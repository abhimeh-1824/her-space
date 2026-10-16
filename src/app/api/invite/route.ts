import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';

export interface ServerInviteToken {
  token: string;
  email: string;
  name: string;
  role: 'warden' | 'student';
  hostelId: string;
  roomNumber?: string;
  residentId?: string;
  status: 'pending' | 'used';
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  password?: string;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token')?.trim();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const snap = await getDoc(doc(db, 'invitations', token));
    if (!snap.exists()) {
      return NextResponse.json(
        { error: 'Setup link is invalid or does not exist.', notFound: true },
        { status: 404 }
      );
    }

    const inv = snap.data() as ServerInviteToken;

    if (inv.status === 'used') {
      return NextResponse.json(
        {
          error: 'This setup link has already been used to set a password. Link is expired.',
          expired: true,
          invitation: { name: inv.name, email: inv.email, role: inv.role },
        },
        { status: 410 }
      );
    }

    if (new Date(inv.expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        {
          error: 'This setup link has expired (valid for 48 hours). Please request a fresh link from the administrator.',
          expired: true,
        },
        { status: 410 }
      );
    }

    return NextResponse.json({
      success: true,
      invitation: {
        token: inv.token,
        name: inv.name,
        email: inv.email,
        role: inv.role,
        hostelId: inv.hostelId,
        roomNumber: inv.roomNumber || '',
        residentId: inv.residentId || '',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to verify invite link' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Support both explicit action and implicit password setup when token & password are provided
    const action = body.action || (body.token && body.password ? 'setPassword' : undefined);

    // Action A: Generate single-use invitation token
    if (action === 'generate') {
      const { email, name, role, hostelId, roomNumber, residentId } = body;
      if (!email || !name || !role) {
        return NextResponse.json({ error: 'Email, name, and role are required' }, { status: 400 });
      }

      if (role === 'student' && (!hostelId || !hostelId.trim())) {
        return NextResponse.json({ error: 'A valid residential hostel is required to register a resident.' }, { status: 400 });
      }

      const cleanEmail = email.trim().toLowerCase();
      const randomSuffix = Math.random().toString(36).substring(2, 7);
      const token = `inv_${role}_${Date.now().toString(36)}_${randomSuffix}`;

      const newInv: ServerInviteToken = {
        token,
        email: cleanEmail,
        name: name.trim(),
        role: role as 'warden' | 'student',
        hostelId: hostelId || '',
        roomNumber: roomNumber?.trim() || '',
        residentId: residentId?.trim() || '',
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      };

      await setDoc(doc(db, 'invitations', token), newInv);

      return NextResponse.json({
        success: true,
        token,
        setupUrl: `/setup/${token}`,
        invitation: newInv,
      });
    }

    // Action B: Complete setup and activate user password
    if (action === 'setPassword') {
      const { token, password } = body;
      if (!token || !password) {
        return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
      }

      const snap = await getDoc(doc(db, 'invitations', token));
      if (!snap.exists()) {
        return NextResponse.json({ error: 'Invalid invitation token' }, { status: 404 });
      }

      const inv = snap.data() as ServerInviteToken;
      if (inv.status === 'used') {
        return NextResponse.json({ error: 'This setup link has already been used.' }, { status: 410 });
      }

      const cleanEmail = inv.email.trim().toLowerCase();
      const cleanPassword = password.trim();

      // 1. Mark invitation as permanently used
      await updateDoc(doc(db, 'invitations', token), {
        status: 'used',
        usedAt: new Date().toISOString(),
      });

      // 2. Update existing user in 'users' collection or create new
      const qUsers = query(collection(db, 'users'), where('email', '==', cleanEmail));
      const userSnaps = await getDocs(qUsers);
      let primaryUserId = `${inv.role}_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

      if (!userSnaps.empty) {
        primaryUserId = userSnaps.docs[0].id;
        for (const uDoc of userSnaps.docs) {
          await updateDoc(doc(db, 'users', uDoc.id), {
            password: cleanPassword,
            status: 'active',
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        await setDoc(
          doc(db, 'users', primaryUserId),
          {
            uid: primaryUserId,
            id: primaryUserId,
            email: cleanEmail,
            name: inv.name,
            role: inv.role,
            password: cleanPassword,
            hostelId: inv.hostelId || '',
            hostelMemberships: inv.hostelId ? [inv.hostelId] : [],
            status: 'active',
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      // 3. If role is warden, also update or create in 'wardens' collection
      if (inv.role === 'warden') {
        const qWardens = query(collection(db, 'wardens'), where('email', '==', cleanEmail));
        const wardenSnaps = await getDocs(qWardens);
        if (!wardenSnaps.empty) {
          for (const wDoc of wardenSnaps.docs) {
            await updateDoc(doc(db, 'wardens', wDoc.id), {
              password: cleanPassword,
              status: 'active',
              inviteStatus: 'used',
              updatedAt: new Date().toISOString(),
            });
          }
        } else {
          await setDoc(
            doc(db, 'wardens', primaryUserId),
            {
              uid: primaryUserId,
              id: primaryUserId,
              email: cleanEmail,
              name: inv.name,
              role: 'warden',
              password: cleanPassword,
              hostelId: inv.hostelId || '',
              hostelMemberships: inv.hostelId ? [inv.hostelId] : [],
              status: 'active',
              inviteStatus: 'used',
              updatedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }
      }

      // 4. If role is student, update 'students' collection
      if (inv.role === 'student') {
        const qStudents = query(collection(db, 'students'), where('email', '==', cleanEmail));
        const studentSnaps = await getDocs(qStudents);
        if (!studentSnaps.empty) {
          for (const sDoc of studentSnaps.docs) {
            await updateDoc(doc(db, 'students', sDoc.id), {
              password: cleanPassword,
              status: 'active',
              deviceStatus: 'registered',
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Password set successfully. You can now login.',
        role: inv.role,
        email: cleanEmail,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Invitation processing error' }, { status: 500 });
  }
}
