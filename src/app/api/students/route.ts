import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { Student } from '@/types';

export async function GET() {
  try {
    const snap = await getDocs(collection(db, 'students'));
    const students: Student[] = [];
    snap.forEach((d) => {
      students.push(d.data() as Student);
    });
    return NextResponse.json({
      students,
      lastUpdated: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json({ students: [], error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Check if it's a batch import (array)
    if (Array.isArray(body)) {
      const incomingStudents: Student[] = body;
      const batch = writeBatch(db);
      for (const st of incomingStudents) {
        batch.set(doc(db, 'students', st.id), st, { merge: true });
      }
      await batch.commit();
      return NextResponse.json({ success: true, count: incomingStudents.length });
    }

    const { action, studentDocId, status, timeFormatted, notes, ...studentData } = body;

    // Attendance update flow
    if (action === 'updateAttendance' && studentDocId) {
      const now = timeFormatted || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const updates: Record<string, any> = {
        attendanceStatus: status,
        lastUpdated: now,
      };
      if (status === 'IN') updates.attendanceTime = now;
      if (status === 'OUT') updates.outTime = now;
      if (notes) updates.notes = notes;

      await updateDoc(doc(db, 'students', studentDocId), updates);
      return NextResponse.json({ success: true, studentDocId, updates });
    }

    // Single student creation / update
    const student = studentData as Student;
    if (!student.id || !student.name) {
      return NextResponse.json({ error: 'Student ID and name are required' }, { status: 400 });
    }

    await setDoc(doc(db, 'students', student.id), student, { merge: true });

    return NextResponse.json({ success: true, student });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to process student' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    await deleteDoc(doc(db, 'students', id));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete student' }, { status: 500 });
  }
}
