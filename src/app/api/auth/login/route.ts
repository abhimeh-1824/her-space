import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { config } from '@/lib/config';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // 1. Super Admin authentication from central config & env
    if (
      config.admin.authorizedEmails.includes(cleanEmail) &&
      config.admin.password &&
      cleanPassword === config.admin.password
    ) {
      return NextResponse.json({
        success: true,
        user: {
          uid: 'admin_user',
          id: 'admin_user',
          email: cleanEmail,
          name: config.admin.name || 'Super Administrator',
          role: 'super_admin',
          hostelId: '',
          hostelMemberships: [],
          phone: '',
        },
      });
    }

    // 2. Query Firestore /users collection for this email
    try {
      const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const matchingDoc = snap.docs.find((d) => {
          const u = d.data();
          return u.password && u.password === cleanPassword;
        });

        if (matchingDoc) {
          const userDoc = matchingDoc.data();
          let assignedHostelId = userDoc.hostelId || '';
          let assignedMemberships = Array.isArray(userDoc.hostelMemberships)
            ? userDoc.hostelMemberships
            : (assignedHostelId ? [assignedHostelId] : []);

          // For wardens, verify against /wardens collection for authoritative admin assignments
          if (userDoc.role === 'warden') {
            try {
              const qW = query(collection(db, 'wardens'), where('email', '==', cleanEmail));
              const wSnap = await getDocs(qW);
              if (!wSnap.empty) {
                const wData = wSnap.docs[0].data();
                assignedHostelId = wData.hostelId || '';
                assignedMemberships = Array.isArray(wData.hostelMemberships)
                  ? wData.hostelMemberships
                  : (assignedHostelId ? [assignedHostelId] : []);
              }
            } catch {}
          }

          return NextResponse.json({
            success: true,
            user: {
              uid: userDoc.uid || matchingDoc.id,
              id: userDoc.id || matchingDoc.id,
              email: userDoc.email,
              name: userDoc.name,
              role: userDoc.role,
              hostelId: assignedHostelId,
              hostelMemberships: assignedMemberships,
              phone: userDoc.phone || '',
            },
          });
        }
      }
    } catch (dbErr) {
      console.warn('[Login Firestore query note]', dbErr);
    }

    // 3. Query Firestore /wardens collection as fallback
    try {
      const qWarden = query(collection(db, 'wardens'), where('email', '==', cleanEmail));
      const wardenSnap = await getDocs(qWarden);

      if (!wardenSnap.empty) {
        const warden = wardenSnap.docs[0].data();
        if (warden.password && warden.password === cleanPassword) {
          const assignedHostelId = warden.hostelId || '';
          const assignedMemberships = Array.isArray(warden.hostelMemberships)
            ? warden.hostelMemberships
            : (assignedHostelId ? [assignedHostelId] : []);

          return NextResponse.json({
            success: true,
            user: {
              uid: warden.id || wardenSnap.docs[0].id,
              id: warden.id || wardenSnap.docs[0].id,
              email: warden.email,
              name: warden.name,
              role: 'warden',
              hostelId: assignedHostelId,
              hostelMemberships: assignedMemberships,
              phone: warden.phone || '',
            },
          });
        }
      }
    } catch (wErr) {
      console.warn('[Login Warden query note]', wErr);
    }

    return NextResponse.json(
      { error: 'Invalid email or password. Please verify your institutional credentials.' },
      { status: 401 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Login failed' }, { status: 500 });
  }
}
