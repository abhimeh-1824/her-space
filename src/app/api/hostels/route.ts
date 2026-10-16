import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Hostel } from '@/types';

export async function GET() {
  try {
    const snap = await getDocs(collection(db, 'hostels'));
    const hostels: Hostel[] = [];
    snap.forEach((d) => {
      hostels.push(d.data() as Hostel);
    });
    return NextResponse.json({
      hostels,
      lastUpdated: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json({ hostels: [], error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const hostelData = await req.json();

    if (!hostelData.name) {
      return NextResponse.json({ error: 'Hostel name is required' }, { status: 400 });
    }

    const hostelId = hostelData.id || `HST-${Date.now().toString(36).toUpperCase()}`;
    const payload: Hostel = {
      ...hostelData,
      id: hostelId,
      status: hostelData.status || 'active',
    };

    await setDoc(doc(db, 'hostels', hostelId), payload, { merge: true });

    return NextResponse.json({
      success: true,
      hostel: payload,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save hostel' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Hostel ID is required' }, { status: 400 });
    }

    await deleteDoc(doc(db, 'hostels', id));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete hostel' }, { status: 500 });
  }
}
