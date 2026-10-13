/**
 * Real Firestore Seeding & Real-Time Sync Service
 * Ensures admin credentials (admin@test.com / admin) exist directly in the database,
 * provides live data subscriptions, and manages persistent updates.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { Student, Hostel, CurfewExtension, AttendanceRecord, AuditLogEntry, UserProfile } from '../types';
import { INITIAL_STUDENTS, INITIAL_HOSTELS, INITIAL_EXTENSIONS, INITIAL_ATTENDANCE_HISTORY, INITIAL_AUDIT_LOGS } from '../data/mockData';

export const ADMIN_CREDENTIALS = {
  email: 'admin@test.com',
  password: 'admin',
  role: 'super_admin' as const,
};

let seedingPromise: Promise<void> | null = null;

/**
 * Initializes the Firestore database with admin credentials, hostels, and baseline records
 * if the database is newly provisioned or missing the admin user.
 */
export async function ensureDatabaseSeeded(): Promise<void> {
  if (seedingPromise) {
    return seedingPromise;
  }

  seedingPromise = (async () => {
    try {
      // 1. Ensure Admin User exists directly in Firestore (/users/admin_user)
      const adminDocRef = doc(db, 'users', 'admin_user');
      const adminSnap = await getDoc(adminDocRef);

      if (!adminSnap.exists()) {
        const adminProfile: UserProfile & { password: string } = {
          uid: 'admin_user',
          email: 'admin@test.com',
          password: 'admin',
          role: 'super_admin',
          name: 'System Administrator',
          hostelId: 'HST-SUN-01',
          hostelMemberships: ['HST-SUN-01', 'HST-ANN-02'],
          policyConsentVersion: 'v2.4',
          consentAcceptedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          phone: '+91 98000 00000',
        };
        await setDoc(adminDocRef, adminProfile);
        console.log('[HostelGuard DB] Direct Admin user admin@test.com created in Firestore.');
      }

      // 2. Ensure Hostels collection has real documents
      const hostelsSnap = await getDocs(collection(db, 'hostels'));
      if (hostelsSnap.empty) {
        for (const h of INITIAL_HOSTELS) {
          await setDoc(doc(db, 'hostels', h.id), h);
        }
        console.log(`[HostelGuard DB] Seeded ${INITIAL_HOSTELS.length} hostels to Firestore.`);
      }

      // 3. Ensure Students collection has initial real documents if empty
      const studentsSnap = await getDocs(collection(db, 'students'));
      if (studentsSnap.empty) {
        for (const s of INITIAL_STUDENTS) {
          await setDoc(doc(db, 'students', s.id), s);
        }
        console.log(`[HostelGuard DB] Seeded ${INITIAL_STUDENTS.length} students to Firestore.`);
      }

      // 4. Ensure Curfew Extensions collection has initial documents if empty
      const extSnap = await getDocs(collection(db, 'extensions'));
      if (extSnap.empty) {
        for (const ext of INITIAL_EXTENSIONS) {
          await setDoc(doc(db, 'extensions', ext.id), ext);
        }
        console.log(`[HostelGuard DB] Seeded ${INITIAL_EXTENSIONS.length} extensions to Firestore.`);
      }

      // 5. Ensure Attendance history exists if empty
      const attSnap = await getDocs(collection(db, 'attendance'));
      if (attSnap.empty) {
        for (const rec of INITIAL_ATTENDANCE_HISTORY) {
          await setDoc(doc(db, 'attendance', rec.id), rec);
        }
        console.log(`[HostelGuard DB] Seeded ${INITIAL_ATTENDANCE_HISTORY.length} attendance records to Firestore.`);
      }

      // 6. Ensure Audit logs exist if empty
      const auditSnap = await getDocs(collection(db, 'audit_logs'));
      if (auditSnap.empty) {
        for (const l of INITIAL_AUDIT_LOGS) {
          await setDoc(doc(db, 'audit_logs', l.id), l);
        }
        console.log(`[HostelGuard DB] Seeded ${INITIAL_AUDIT_LOGS.length} audit logs to Firestore.`);
      }
    } catch (err) {
      console.warn('[HostelGuard DB] Seeding note (will continue with active data):', err);
    }
  })();

  return seedingPromise;
}

/**
 * Subscribes to live students from Firestore
 */
export function subscribeToStudents(callback: (students: Student[]) => void): () => void {
  const colRef = collection(db, 'students');
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (!snapshot.empty) {
        const list: Student[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as Student);
        });
        callback(list);
      } else {
        callback([]);
      }
    },
    (err) => {
      console.warn('[subscribeToStudents] Live listener fallback:', err);
    }
  );
}

/**
 * Subscribes to live hostels from Firestore
 */
export function subscribeToHostels(callback: (hostels: Hostel[]) => void): () => void {
  const colRef = collection(db, 'hostels');
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (!snapshot.empty) {
        const list: Hostel[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as Hostel);
        });
        callback(list);
      } else {
        callback(INITIAL_HOSTELS);
      }
    },
    (err) => {
      console.warn('[subscribeToHostels] Live listener fallback:', err);
    }
  );
}

/**
 * Subscribes to live curfew extensions from Firestore
 */
export function subscribeToExtensions(callback: (exts: CurfewExtension[]) => void): () => void {
  const colRef = collection(db, 'extensions');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: CurfewExtension[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as CurfewExtension);
      });
      callback(list);
    },
    (err) => {
      console.warn('[subscribeToExtensions] Live listener fallback:', err);
    }
  );
}

/**
 * Subscribes to live attendance records from Firestore
 */
export function subscribeToAttendance(callback: (records: AttendanceRecord[]) => void): () => void {
  const colRef = collection(db, 'attendance');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: AttendanceRecord[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as AttendanceRecord);
      });
      callback(list);
    },
    (err) => {
      console.warn('[subscribeToAttendance] Live listener fallback:', err);
    }
  );
}

/**
 * Subscribes to live audit logs from Firestore
 */
export function subscribeToAuditLogs(callback: (logs: AuditLogEntry[]) => void): () => void {
  const colRef = collection(db, 'audit_logs');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: AuditLogEntry[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as AuditLogEntry);
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      callback(list);
    },
    (err) => {
      console.warn('[subscribeToAuditLogs] Live listener fallback:', err);
    }
  );
}

/**
 * Saves or updates a student directly in Firestore
 */
export async function saveStudentToDb(student: Student): Promise<void> {
  await setDoc(doc(db, 'students', student.id), student);
}

/**
 * Deletes a student directly from Firestore
 */
export async function deleteStudentFromDb(studentId: string): Promise<void> {
  await deleteDoc(doc(db, 'students', studentId));
}

/**
 * Batch import multiple students into Firestore
 */
export async function batchImportStudentsToDb(students: Student[]): Promise<number> {
  let count = 0;
  // Firestore batches allow max 500 operations per batch
  const chunkSize = 400;
  for (let i = 0; i < students.length; i += chunkSize) {
    const chunk = students.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const stu of chunk) {
      const ref = doc(db, 'students', stu.id);
      batch.set(ref, stu);
      count++;
    }
    await batch.commit();
  }
  return count;
}

/**
 * Update attendance status for a student in Firestore
 */
export async function updateStudentAttendanceInDb(
  studentDocId: string,
  status: 'IN' | 'OUT' | 'Pending' | 'Late' | 'Exception',
  timeFormatted?: string,
  notes?: string
): Promise<void> {
  const updates: Record<string, unknown> = {
    attendanceStatus: status,
    lastUpdated: timeFormatted || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
  if (status === 'IN') {
    updates.attendanceTime = timeFormatted || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (status === 'OUT') {
    updates.outTime = timeFormatted || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (notes) {
    updates.notes = notes;
  }

  await updateDoc(doc(db, 'students', studentDocId), updates);
}
