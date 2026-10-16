/**
 * HER-SPACE — Automated Absence Report Service
 * 
 * Generates and dispatches consolidated absence reports 5 minutes after each scheduled
 * curfew reminder to designated emergency & administrative numbers:
 * 1. Primary Helpline: 6267549800
 * 2. Designated Monitor: 9399667720
 */

import { collection, doc, getDocs, setDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { config } from './config';
import { Student } from '../types';

export const REPORT_RECIPIENT_NUMBERS = [
  '6267549800', // Helpline Number
  '9399667720', // Monitor Number
] as const;

export interface AbsenceReportData {
  id: string;
  hostelId: string;
  hostelName: string;
  reminderSlot: string; // e.g. "19:05" or "22:15"
  reportTriggerSlot: string; // e.g. "19:10" or "22:20" (5 mins post reminder)
  sessionDate: string; // YYYY-MM-DD
  generatedAt: string;
  totalOutCount: number;
  outStudents: Array<{
    id: string;
    studentId: string;
    name: string;
    room: string;
    rollNo: string;
    phone: string;
    guardianPhone: string;
    outTime: string;
    outReason: string;
    estimatedReturnTime: string;
  }>;
  recipients: string[];
  reportText: string;
  whatsappUrls: Record<string, string>;
}

/**
 * Calculates time formatted HH:MM adding 5 minutes
 */
export function addFiveMinutes(timeHHMM: string): string {
  try {
    const [hStr, mStr] = timeHHMM.split(':');
    let h = parseInt(hStr, 10);
    let m = parseInt(mStr, 10) + 5;
    if (m >= 60) {
      m -= 60;
      h = (h + 1) % 24;
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  } catch {
    return timeHHMM;
  }
}

/**
 * Formats a 24hr HH:MM time into 12-hr readable AM/PM string
 */
export function formatTime12(time24: string): string {
  if (!time24) return '';
  const [h, m] = time24.split(':');
  const hours = parseInt(h, 10);
  if (isNaN(hours)) return time24;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${m || '00'} ${ampm}`;
}

/**
 * Generates and stores the authoritative 5-min post-reminder absence report
 */
export async function generateAbsenceReport(params: {
  hostelId: string;
  hostelName?: string;
  reminderSlot: string;
  sessionDate?: string;
  studentsList?: Student[];
}): Promise<AbsenceReportData> {
  const { hostelId, reminderSlot } = params;
  const sessionDate = params.sessionDate || new Date().toISOString().slice(0, 10);
  const now = new Date();
  const reportTriggerSlot = addFiveMinutes(reminderSlot);

  // 1. Gather all students
  let allStudents = params.studentsList;
  if (!allStudents || allStudents.length === 0) {
    try {
      const q = query(collection(db, 'students'), where('hostelId', '==', hostelId));
      const snap = await getDocs(q);
      allStudents = snap.docs.map((d) => d.data() as Student);
    } catch {
      allStudents = [];
    }
  }

  // Filter students whose official status is OUT
  const outStudents = (allStudents || []).filter(
    (s) => s.attendanceStatus === 'OUT' || s.attendanceStatus === 'Late'
  );

  const hostelDisplayName = params.hostelName || hostelId || 'HER-SPACE Hostel';

  // 2. Format detailed text report
  let text = `🚨 *HER-SPACE HOSTEL ABSENCE REPORT*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `🏢 *Hostel:* ${hostelDisplayName}\n`;
  text += `⏰ *Curfew Reminder:* ${formatTime12(reminderSlot)} (Report dispatched +5 min: ${formatTime12(reportTriggerSlot)})\n`;
  text += `📅 *Date:* ${sessionDate}\n`;
  text += `⚠️ *Total Residents Currently OUT:* ${outStudents.length}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (outStudents.length === 0) {
    text += `✅ *All residents are physically inside the hostel boundary.*\n`;
    text += `Zero unverified absences at this post-reminder check.\n`;
  } else {
    text += `📋 *List of Absent / OUT Residents:*\n\n`;
    outStudents.forEach((s, idx) => {
      text += `${idx + 1}. *${s.name}*\n`;
      text += `   • Room: ${s.room || 'N/A'} | ID: ${s.studentId || s.id}\n`;
      text += `   • OUT Since: ${s.outTime || 'Earlier'}\n`;
      text += `   • Reason / Destination: ${s.outReason || 'Not declared'}\n`;
      text += `   • Expected Return: ${s.estimatedReturnTime || 'Pending response'}\n`;
      text += `   • Student Phone: ${s.phone || 'N/A'}\n`;
      text += `   • Parent Phone: ${s.guardianPhone || 'N/A'}\n\n`;
    });
  }

  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📞 Helpline: +91 6267549800\n`;
  text += `📱 Administrative Monitor: +91 9399667720\n`;
  text += `Verified by HER-SPACE Security System`;

  const reportId = `rep_${hostelId}_${sessionDate.replace(/-/g, '')}_${reminderSlot.replace(':', '')}`;

  // 3. Build WhatsApp Links
  const encodedText = encodeURIComponent(text);
  const whatsappUrls: Record<string, string> = {
    '6267549800': `https://api.whatsapp.com/send?phone=916267549800&text=${encodedText}`,
    '9399667720': `https://api.whatsapp.com/send?phone=919399667720&text=${encodedText}`,
  };

  const reportData: AbsenceReportData = {
    id: reportId,
    hostelId,
    hostelName: hostelDisplayName,
    reminderSlot,
    reportTriggerSlot,
    sessionDate,
    generatedAt: now.toISOString(),
    totalOutCount: outStudents.length,
    outStudents: outStudents.map((s) => ({
      id: s.id,
      studentId: s.studentId || s.id,
      name: s.name,
      room: s.room || '',
      rollNo: s.rollNo || '',
      phone: s.phone || '',
      guardianPhone: s.guardianPhone || '',
      outTime: s.outTime || '',
      outReason: s.outReason || '',
      estimatedReturnTime: s.estimatedReturnTime || '',
    })),
    recipients: [...REPORT_RECIPIENT_NUMBERS],
    reportText: text,
    whatsappUrls,
  };

  // 4. Save to Firestore
  try {
    await setDoc(doc(db, 'absenceReports', reportId), {
      ...reportData,
      serverCreatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn('[AbsenceReport] Firestore write fallback:', err);
  }

  return reportData;
}
