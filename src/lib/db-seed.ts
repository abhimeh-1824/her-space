/**
 * Central Database & Real-Time Sync Service (Free Spark Quota Optimized)
 * 
 * Quota Optimizations:
 * 1. Zero unnecessary writes: Audit logs and event logs are stored locally (0 Firestore writes).
 * 2. Zero dual-writes: Direct Firestore persistence only (no duplicate background API calls).
 * 3. Cache-first reads: Hostels and Wardens are cached in localStorage and queried on-demand,
 *    eliminating persistent WebChannel streaming connections (channel?gsessionid=...) and idle reads.
 * 4. Cross-tab instant synchronization via BroadcastChannel.
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { config } from './config';
import { Student, Hostel, CurfewExtension, AttendanceRecord, AuditLogEntry } from '../types';

export const ADMIN_CREDENTIALS = {
  email: config.admin.email,
  password: config.admin.password,
  role: 'super_admin' as const,
};

export async function ensureDatabaseSeeded(): Promise<void> {
  return Promise.resolve();
}

// -------------------------------------------------------------
// CROSS-TAB BROADCAST BUS
// -------------------------------------------------------------

const SYNC_CHANNEL_NAME = 'herspace_sync_bus';
let syncChannel: BroadcastChannel | null = null;

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
  } catch {}
}

function notifySyncBus(topic: 'students' | 'hostels' | 'wardens') {
  if (syncChannel) {
    try {
      syncChannel.postMessage({ topic, timestamp: Date.now() });
    } catch {}
  }
}

// -------------------------------------------------------------
// HOSTELS CACHE-FIRST HUB (Zero Idle WebChannel Traffic)
// -------------------------------------------------------------

const HOSTELS_CACHE_KEY = 'herspace_hostels_cache';
const hostelListeners = new Set<(hostels: Hostel[]) => void>();
let cachedHostels: Hostel[] = [];
let hostelsFetched = false;

function loadCachedHostels(): Hostel[] {
  if (cachedHostels.length > 0) return cachedHostels;
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HOSTELS_CACHE_KEY);
    if (raw) {
      const parsed: Hostel[] = JSON.parse(raw);
      const seen = new Set<string>();
      cachedHostels = parsed.filter((h) => {
        if (!h.id || seen.has(h.id)) return false;
        seen.add(h.id);
        return true;
      });
      return cachedHostels;
    }
  } catch {}
  return [];
}

function saveCachedHostels(list: Hostel[]) {
  const seen = new Set<string>();
  const unique = list.filter((h) => {
    if (!h.id || seen.has(h.id)) return false;
    seen.add(h.id);
    return true;
  });
  cachedHostels = unique;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(HOSTELS_CACHE_KEY, JSON.stringify(unique));
    } catch {}
  }
}

export async function refetchHostelsFromDb(): Promise<Hostel[]> {
  if (typeof window === 'undefined') return [];
  try {
    const snapshot = await getDocs(collection(db, 'hostels'));
    const seen = new Set<string>();
    const list: Hostel[] = [];
    snapshot.forEach((d) => {
      const data = d.data() as Hostel;
      const id = d.id || data.id;
      if (id && !seen.has(id)) {
        seen.add(id);
        list.push({ ...data, id });
      }
    });
    saveCachedHostels(list);
    hostelListeners.forEach((fn) => fn(list));
    return list;
  } catch (err) {
    console.warn('[refetchHostelsFromDb] Read note:', err);
    return loadCachedHostels();
  }
}

export function subscribeToHostels(callback: (hostels: Hostel[]) => void): () => void {
  const current = loadCachedHostels();
  callback(current);

  hostelListeners.add(callback);

  // Fetch once from Firestore on-demand
  if (!hostelsFetched && typeof window !== 'undefined') {
    hostelsFetched = true;
    refetchHostelsFromDb();
  }

  return () => {
    hostelListeners.delete(callback);
  };
}

function cleanForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) {
      continue;
    }
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      result[key] = cleanForFirestore(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

export async function saveHostelToDb(hostel: Hostel): Promise<void> {
  const current = loadCachedHostels();
  const filtered = current.filter((h) => h.id !== hostel.id);
  const updated = [hostel, ...filtered];

  saveCachedHostels(updated);
  hostelListeners.forEach((fn) => fn(updated));

  // Single authoritative Firestore write (No duplicate API calls)
  try {
    await setDoc(doc(db, 'hostels', hostel.id), cleanForFirestore(hostel), { merge: true });
    notifySyncBus('hostels');
  } catch (err) {
    console.error('[saveHostelToDb] Firestore error:', err);
  }
}

export async function deleteHostelFromDb(hostelId: string): Promise<void> {
  const current = loadCachedHostels();
  const updated = current.filter((h) => h.id !== hostelId);

  saveCachedHostels(updated);
  hostelListeners.forEach((fn) => fn(updated));

  try {
    await deleteDoc(doc(db, 'hostels', hostelId));
    notifySyncBus('hostels');
  } catch (err) {
    console.error('[deleteHostelFromDb] Firestore error:', err);
  }
}

// -------------------------------------------------------------
// WARDENS CACHE-FIRST HUB (Zero Idle WebChannel Traffic)
// -------------------------------------------------------------

const WARDENS_STORAGE_KEY = 'herspace_wardens_cache';
const wardenListeners = new Set<(wardens: any[]) => void>();
let cachedWardensList: any[] = [];
let wardensFetched = false;

export function getCachedWardens(): any[] {
  if (cachedWardensList.length > 0) return cachedWardensList;
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(WARDENS_STORAGE_KEY);
    if (raw) {
      cachedWardensList = JSON.parse(raw);
      return cachedWardensList;
    }
  } catch {}
  return [];
}

export function saveCachedWardens(wardens: any[]): void {
  cachedWardensList = wardens;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(WARDENS_STORAGE_KEY, JSON.stringify(wardens));
    } catch {}
  }
}

export async function refetchWardensFromDb(): Promise<any[]> {
  if (typeof window === 'undefined') return [];
  try {
    const rawList: any[] = [];

    // Query wardens collection
    try {
      const snapWardens = await getDocs(collection(db, 'wardens'));
      snapWardens.forEach((d) => rawList.push(d.data()));
    } catch {}

    // Query users collection with role === 'warden'
    try {
      const { query, where } = await import('firebase/firestore');
      const snapUsers = await getDocs(query(collection(db, 'users'), where('role', '==', 'warden')));
      snapUsers.forEach((d) => rawList.push(d.data()));
    } catch {}

    // Deduplicate strictly by email and id
    const seen = new Set<string>();
    const list: any[] = [];
    for (const item of rawList) {
      const key = (item.email || item.id || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      list.push(item);
    }

    saveCachedWardens(list);
    wardenListeners.forEach((fn) => fn(list));
    return list;
  } catch (err) {
    console.warn('[refetchWardensFromDb] Read note:', err);
    return getCachedWardens();
  }
}

export function subscribeToWardens(callback: (wardens: any[]) => void): () => void {
  const current = getCachedWardens();
  callback(current);

  wardenListeners.add(callback);

  // Fetch once from Firestore on-demand
  if (!wardensFetched && typeof window !== 'undefined') {
    wardensFetched = true;
    refetchWardensFromDb();
  }

  return () => {
    wardenListeners.delete(callback);
  };
}

export function clearAllLocalCaches(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(HOSTELS_CACHE_KEY);
      localStorage.removeItem(WARDENS_STORAGE_KEY);
      localStorage.removeItem('herspace_students_cache');
    } catch {}
  }
  cachedHostels = [];
  cachedWardensList = [];
  hostelListeners.forEach((fn) => fn([]));
  wardenListeners.forEach((fn) => fn([]));
}

export async function saveWardenToDb(wardenData: {
  id: string;
  name: string;
  email: string;
  phone?: string;
  hostelId?: string;
  hostelMemberships?: string[];
  status?: 'active' | 'inactive';
  inviteToken?: string;
  inviteStatus?: 'pending' | 'used' | 'expired';
  passwordSet?: boolean;
}): Promise<void> {
  const cleanEmail = wardenData.email.trim().toLowerCase();
  const assignedHostelId = wardenData.hostelId || '';
  const assignedMemberships = Array.isArray(wardenData.hostelMemberships)
    ? wardenData.hostelMemberships
    : (assignedHostelId ? [assignedHostelId] : []);

  const wardenRecord = {
    uid: wardenData.id,
    id: wardenData.id,
    name: wardenData.name.trim(),
    email: cleanEmail,
    phone: wardenData.phone?.trim() || '',
    role: 'warden' as const,
    hostelId: assignedHostelId,
    hostelMemberships: assignedMemberships,
    status: wardenData.status || 'active',
    inviteToken: wardenData.inviteToken,
    inviteStatus: wardenData.inviteStatus || 'pending',
    passwordSet: wardenData.passwordSet ?? false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const cached = getCachedWardens();
  const existingIdx = cached.findIndex(
    (w) => w.id === wardenData.id || w.email.toLowerCase() === cleanEmail
  );
  const updatedCache = existingIdx >= 0
    ? cached.map((w, i) => (i === existingIdx ? { ...w, ...wardenRecord } : w))
    : [wardenRecord, ...cached];

  saveCachedWardens(updatedCache);
  wardenListeners.forEach((fn) => fn(updatedCache));

  const cleanWarden = cleanForFirestore({
    ...wardenRecord,
    inviteToken: wardenData.inviteToken ?? null,
  });

  // Single authoritative write directly to Firestore (users and wardens)
  try {
    const promises: Promise<any>[] = [
      setDoc(doc(db, 'users', wardenData.id), cleanWarden, { merge: true }),
      setDoc(doc(db, 'wardens', wardenData.id), cleanWarden, { merge: true }),
    ];

    // Synchronize any existing duplicate doc IDs with matching email
    const [uSnaps, wSnaps] = await Promise.all([
      getDocs(query(collection(db, 'users'), where('email', '==', cleanEmail))),
      getDocs(query(collection(db, 'wardens'), where('email', '==', cleanEmail))),
    ]);

    uSnaps.forEach((d) => {
      if (d.id !== wardenData.id) {
        promises.push(
          updateDoc(doc(db, 'users', d.id), {
            hostelId: assignedHostelId,
            hostelMemberships: assignedMemberships,
            name: wardenRecord.name,
            phone: wardenRecord.phone,
            status: wardenRecord.status,
            updatedAt: new Date().toISOString(),
          })
        );
      }
    });

    wSnaps.forEach((d) => {
      if (d.id !== wardenData.id) {
        promises.push(
          updateDoc(doc(db, 'wardens', d.id), {
            hostelId: assignedHostelId,
            hostelMemberships: assignedMemberships,
            name: wardenRecord.name,
            phone: wardenRecord.phone,
            status: wardenRecord.status,
            updatedAt: new Date().toISOString(),
          })
        );
      }
    });

    await Promise.allSettled(promises);
    notifySyncBus('wardens');
  } catch (err) {
    console.error('[saveWardenToDb] Firestore write error:', err);
  }
}

export async function deleteWardenFromDb(wardenId: string): Promise<void> {
  const cached = getCachedWardens();
  const targetWarden = cached.find((w) => w.id === wardenId);
  const updated = cached.filter((w) => w.id !== wardenId);
  saveCachedWardens(updated);
  wardenListeners.forEach((fn) => fn(updated));

  try {
    const promises: Promise<any>[] = [
      deleteDoc(doc(db, 'users', wardenId)),
      deleteDoc(doc(db, 'wardens', wardenId)),
    ];

    if (targetWarden && targetWarden.email) {
      const cleanEmail = targetWarden.email.trim().toLowerCase();
      const [uSnaps, wSnaps] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('email', '==', cleanEmail))),
        getDocs(query(collection(db, 'wardens'), where('email', '==', cleanEmail))),
      ]);
      uSnaps.forEach((d) => promises.push(deleteDoc(doc(db, 'users', d.id))));
      wSnaps.forEach((d) => promises.push(deleteDoc(doc(db, 'wardens', d.id))));
    }

    await Promise.allSettled(promises);
    notifySyncBus('wardens');
  } catch (err) {
    console.error('[deleteWardenFromDb] Firestore delete error:', err);
  }
}

// -------------------------------------------------------------
// STUDENTS ROSTER & ATTENDANCE HUB
// -------------------------------------------------------------

const STUDENTS_CACHE_KEY = 'herspace_students_cache';
const studentListeners = new Set<(students: Student[]) => void>();
let cachedStudents: Student[] = [];
let studentsUnsub: (() => void) | null = null;

function loadCachedStudents(): Student[] {
  if (cachedStudents.length > 0) return cachedStudents;
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STUDENTS_CACHE_KEY);
    if (raw) {
      cachedStudents = JSON.parse(raw);
      return cachedStudents;
    }
  } catch {}
  return [];
}

function saveCachedStudents(list: Student[]) {
  cachedStudents = list;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STUDENTS_CACHE_KEY, JSON.stringify(list));
    } catch {}
  }
}

export function subscribeToStudents(callback: (students: Student[]) => void): () => void {
  const current = loadCachedStudents();
  if (current.length > 0) {
    callback(current);
  }

  studentListeners.add(callback);

  // Attach a single managed listener only while subscriber components are mounted
  if (!studentsUnsub && typeof window !== 'undefined') {
    try {
      const colRef = collection(db, 'students');
      studentsUnsub = onSnapshot(
        colRef,
        (snapshot) => {
          const list: Student[] = [];
          snapshot.forEach((d) => list.push(d.data() as Student));
          saveCachedStudents(list);
          studentListeners.forEach((fn) => fn(list));
        },
        (err) => {
          console.warn('[subscribeToStudents] Firestore snapshot note:', err);
        }
      );
    } catch (err) {
      console.warn('[subscribeToStudents] Listener warning:', err);
    }
  }

  return () => {
    studentListeners.delete(callback);
    // When no component is watching students, immediately unhook to stop WebChannel idle calls
    if (studentListeners.size === 0 && studentsUnsub) {
      studentsUnsub();
      studentsUnsub = null;
    }
  };
}

export async function saveStudentToDb(student: Student): Promise<void> {
  const current = loadCachedStudents();
  const sIdx = current.findIndex((s) => s.id === student.id);
  const updated = sIdx >= 0
    ? current.map((s, i) => (i === sIdx ? student : s))
    : [student, ...current];

  saveCachedStudents(updated);
  studentListeners.forEach((fn) => fn(updated));

  // Authoritative Firestore write
  try {
    await setDoc(doc(db, 'students', student.id), student, { merge: true });

    // Sync to linked users account if exists
    try {
      const q = query(collection(db, 'users'), where('studentId', '==', student.studentId));
      const uSnap = await getDocs(q);
      if (!uSnap.empty) {
        const batch = writeBatch(db);
        uSnap.forEach((uDoc) => {
          batch.update(doc(db, 'users', uDoc.id), {
            displayName: student.name,
            email: student.email,
            phoneNumber: student.phone,
            hostelId: student.hostelId || '',
            accountStatus: student.status,
            updatedAt: new Date().toISOString(),
          });
        });
        await batch.commit();
      }
    } catch (uErr) {
      console.warn('[saveStudentToDb] Warning syncing linked user:', uErr);
    }

    notifySyncBus('students');
  } catch (err) {
    console.error('[saveStudentToDb] Firestore write error:', err);
  }
}

export async function deleteStudentFromDb(studentId: string): Promise<void> {
  const current = loadCachedStudents();
  const studentToDelete = current.find((s) => s.id === studentId);
  const updated = current.filter((s) => s.id !== studentId);

  saveCachedStudents(updated);
  studentListeners.forEach((fn) => fn(updated));

  try {
    await deleteDoc(doc(db, 'students', studentId));
    if (studentToDelete?.studentId) {
      try {
        const q = query(collection(db, 'users'), where('studentId', '==', studentToDelete.studentId));
        const uSnap = await getDocs(q);
        if (!uSnap.empty) {
          const batch = writeBatch(db);
          uSnap.forEach((uDoc) => batch.delete(doc(db, 'users', uDoc.id)));
          await batch.commit();
        }
      } catch (uErr) {
        console.warn('[deleteStudentFromDb] Warning deleting linked user:', uErr);
      }
    }
    notifySyncBus('students');
  } catch (err) {
    console.error('[deleteStudentFromDb] Firestore delete error:', err);
  }
}

export async function batchImportStudentsToDb(students: Student[]): Promise<number> {
  let count = 0;
  const chunkSize = 400;

  try {
    for (let i = 0; i < students.length; i += chunkSize) {
      const chunk = students.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const stu of chunk) {
        batch.set(doc(db, 'students', stu.id), stu, { merge: true });
        count++;
      }
      await batch.commit();
    }
    notifySyncBus('students');
  } catch (err) {
    console.error('[batchImportStudentsToDb] Batch write error:', err);
  }

  return count || students.length;
}

export async function updateStudentAttendanceInDb(
  studentDocId: string,
  status: 'IN' | 'OUT' | 'Pending' | 'Late' | 'Exception',
  timeFormatted?: string,
  notes?: string,
  outReason?: string,
  estimatedReturnTime?: string
): Promise<void> {
  const timeNow = timeFormatted || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const current = loadCachedStudents();
  const sIdx = current.findIndex((s) => s.id === studentDocId);
  if (sIdx >= 0) {
    const updated = {
      ...current[sIdx],
      attendanceStatus: status,
      lastUpdated: timeNow,
      attendanceTime: status === 'IN' ? timeNow : current[sIdx].attendanceTime,
      outTime: status === 'OUT' ? timeNow : current[sIdx].outTime,
      notes: notes !== undefined ? notes : current[sIdx].notes,
      outReason: outReason !== undefined ? outReason : current[sIdx].outReason,
      estimatedReturnTime: estimatedReturnTime !== undefined ? estimatedReturnTime : current[sIdx].estimatedReturnTime,
    };
    const newList = current.map((s, i) => (i === sIdx ? updated : s));
    saveCachedStudents(newList);
    studentListeners.forEach((fn) => fn(newList));
  }

  // Single authoritative Firestore write with merge: true (idempotent, never throws 'No document to update')
  try {
    const updates: Record<string, unknown> = {
      attendanceStatus: status,
      lastUpdated: timeNow,
    };
    if (status === 'IN') updates.attendanceTime = timeNow;
    if (status === 'OUT') updates.outTime = timeNow;
    if (notes) updates.notes = notes;
    if (outReason) updates.outReason = outReason;
    if (estimatedReturnTime) updates.estimatedReturnTime = estimatedReturnTime;

    await setDoc(doc(db, 'students', studentDocId), updates, { merge: true });
    notifySyncBus('students');
  } catch (err) {
    console.error('[updateStudentAttendanceInDb] Firestore error:', err);
  }
}

export async function updateStudentEstimatedReturnTimeInDb(
  studentDocId: string,
  estimatedReturnTime: string
): Promise<void> {
  const current = loadCachedStudents();
  const sIdx = current.findIndex((s) => s.id === studentDocId);
  if (sIdx >= 0) {
    const updated = {
      ...current[sIdx],
      estimatedReturnTime,
      lastUpdated: `Expected return: ${estimatedReturnTime}`,
    };
    const newList = current.map((s, i) => (i === sIdx ? updated : s));
    saveCachedStudents(newList);
    studentListeners.forEach((fn) => fn(newList));
  }

  try {
    await setDoc(
      doc(db, 'students', studentDocId),
      {
        estimatedReturnTime,
        lastUpdated: `Expected return: ${estimatedReturnTime}`,
      },
      { merge: true }
    );
    notifySyncBus('students');
  } catch (err) {
    console.error('[updateStudentEstimatedReturnTimeInDb] Firestore error:', err);
  }
}

export async function sendDirectNotificationToStudent(params: {
  studentDocId: string;
  title: string;
  message: string;
  senderName?: string;
}): Promise<void> {
  const alertData = {
    id: `alert_${Date.now()}`,
    title: params.title || '🚨 Warden Roll-Call Alert',
    message: params.message || 'Urgent notice: Please confirm your curfew attendance or return immediately.',
    sentAt: new Date().toISOString(),
    senderName: params.senderName || 'Warden Administration',
    acknowledged: false,
  };

  const current = loadCachedStudents();
  const sIdx = current.findIndex((s) => s.id === params.studentDocId);
  if (sIdx >= 0) {
    const updated = {
      ...current[sIdx],
      pendingAlert: alertData,
      lastUpdated: `Alert sent at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    };
    const newList = current.map((s, i) => (i === sIdx ? updated : s));
    saveCachedStudents(newList);
    studentListeners.forEach((fn) => fn(newList));
  }

  try {
    await setDoc(
      doc(db, 'students', params.studentDocId),
      {
        pendingAlert: alertData,
        lastUpdated: `Alert sent at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      },
      { merge: true }
    );
    notifySyncBus('students');
  } catch (err) {
    console.error('[sendDirectNotificationToStudent] Firestore error:', err);
  }

  // Also log job to notificationJobs collection
  try {
    const jobId = `job_direct_${params.studentDocId}_${Date.now()}`;
    await setDoc(doc(db, 'notificationJobs', jobId), {
      id: jobId,
      jobType: 'warden_direct_alert',
      targetStudentId: params.studentDocId,
      title: alertData.title,
      body: alertData.message,
      senderName: alertData.senderName,
      status: 'dispatched',
      createdAt: new Date().toISOString(),
    });
  } catch {}
}

export async function acknowledgeStudentAlertInDb(studentDocId: string): Promise<void> {
  const current = loadCachedStudents();
  const sIdx = current.findIndex((s) => s.id === studentDocId);
  if (sIdx >= 0 && current[sIdx].pendingAlert) {
    const updated = {
      ...current[sIdx],
      pendingAlert: {
        ...current[sIdx].pendingAlert!,
        acknowledged: true,
        acknowledgedAt: new Date().toISOString(),
      },
    };
    const newList = current.map((s, i) => (i === sIdx ? updated : s));
    saveCachedStudents(newList);
    studentListeners.forEach((fn) => fn(newList));
  }

  try {
    await setDoc(
      doc(db, 'students', studentDocId),
      {
        'pendingAlert.acknowledged': true,
        'pendingAlert.acknowledgedAt': new Date().toISOString(),
      },
      { merge: true }
    );
    notifySyncBus('students');
  } catch (err) {
    console.error('[acknowledgeStudentAlertInDb] Firestore error:', err);
  }
}

// -------------------------------------------------------------
// EXTENSIONS, ATTENDANCE & AUDIT LOGS (Zero Firestore Overhead)
// -------------------------------------------------------------

export function subscribeToExtensions(callback: (exts: CurfewExtension[]) => void): () => void {
  // Read on-demand if needed
  getDocs(collection(db, 'extensions'))
    .then((snap) => {
      const list: CurfewExtension[] = [];
      snap.forEach((d) => list.push(d.data() as CurfewExtension));
      callback(list);
    })
    .catch(() => callback([]));

  return () => {};
}

export function subscribeToAttendance(callback: (records: AttendanceRecord[]) => void): () => void {
  // Read on-demand if needed
  getDocs(collection(db, 'attendance'))
    .then((snap) => {
      const list: AttendanceRecord[] = [];
      snap.forEach((d) => list.push(d.data() as AttendanceRecord));
      callback(list);
    })
    .catch(() => callback([]));

  return () => {};
}

/**
 * Audit logs subscription (Stored 100% locally in localStorage to preserve Spark Free Quota)
 */
export function subscribeToAuditLogs(callback: (logs: AuditLogEntry[]) => void): () => void {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('herspace_audit_logs');
      callback(raw ? JSON.parse(raw) : []);
    } catch {
      callback([]);
    }
  } else {
    callback([]);
  }
  return () => {};
}

// Cross-tab broadcast receiver
if (typeof window !== 'undefined' && syncChannel) {
  syncChannel.onmessage = (event) => {
    const topic = event.data?.topic;
    if (topic === 'hostels') {
      hostelsFetched = false;
      subscribeToHostels((list) => hostelListeners.forEach((fn) => fn(list)))();
    }
    if (topic === 'wardens') {
      wardensFetched = false;
      subscribeToWardens((list) => wardenListeners.forEach((fn) => fn(list)))();
    }
  };
}
