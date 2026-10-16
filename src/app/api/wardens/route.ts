import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';

export async function GET() {
  try {
    const snap = await getDocs(collection(db, 'wardens'));
    const wardens: any[] = [];
    snap.forEach((d) => {
      wardens.push(d.data());
    });
    return NextResponse.json({
      wardens,
      lastUpdated: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json({ wardens: [], error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, email, phone, hostelId, hostelMemberships, status } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    const wardenId = id || `w_${Date.now()}`;
    const cleanEmail = email.trim().toLowerCase();

    const wardenRecord = {
      id: wardenId,
      uid: wardenId,
      name: name.trim(),
      email: cleanEmail,
      phone: phone?.trim() || '',
      role: 'warden' as const,
      hostelId: hostelId || '',
      hostelMemberships: hostelMemberships || (hostelId ? [hostelId] : []),
      status: status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await Promise.allSettled([
      setDoc(doc(db, 'wardens', wardenId), wardenRecord, { merge: true }),
      setDoc(doc(db, 'users', wardenId), wardenRecord, { merge: true }),
    ]);

    return NextResponse.json({
      success: true,
      warden: wardenRecord,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save warden' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Warden ID is required' }, { status: 400 });
    }

    await Promise.allSettled([
      deleteDoc(doc(db, 'wardens', id)),
      deleteDoc(doc(db, 'users', id)),
    ]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete warden' }, { status: 500 });
  }
}
