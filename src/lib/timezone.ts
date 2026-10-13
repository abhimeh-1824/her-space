/**
 * Timezone and Midnight Curfew Transition Engine for HostelGuard
 * Handles Indian Standard Time (IST, UTC+05:30), day-boundary rollover,
 * and server-authoritative timestamps.
 */

export const IST_OFFSET_MINUTES = 330; // UTC + 5:30

export interface CurfewWindow {
  sessionDate: string; // YYYY-MM-DD
  windowStart: Date;
  standardCutoff: Date;
  effectiveCutoff: Date; // including approved extension
  extensionMinutes: number;
}

/**
 * Converts a Date to an IST Date representation
 */
export function toIST(date: Date = new Date()): Date {
  const utcTime = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utcTime + IST_OFFSET_MINUTES * 60000);
}

/**
 * Returns today's session date string in YYYY-MM-DD format (IST)
 */
export function getCurrentSessionDate(date: Date = new Date()): string {
  const istDate = toIST(date);
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, '0');
  const day = String(istDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses time string (e.g. "22:00" or "00:00") on a base date.
 * Handles the critical midnight boundary: "00:00" is next calendar day (+1 day relative to "22:00").
 */
export function calculateCurfewWindow(
  sessionDate: string, // "YYYY-MM-DD"
  windowStartStr = '22:00',
  cutoffStr = '00:00',
  approvedExtensionMinutes = 0
): CurfewWindow {
  const [year, month, day] = sessionDate.split('-').map(Number);

  // Window starts on sessionDate at windowStartStr (e.g. 2026-10-13 22:00)
  const [startHour, startMinute] = windowStartStr.split(':').map(Number);
  const windowStart = new Date(year, month - 1, day, startHour, startMinute, 0, 0);

  // Midnight cutoff rollover:
  // If cutoffStr is "00:00" or has hours less than startHour, it rolls over into next calendar day
  const [cutoffHour, cutoffMinute] = cutoffStr.split(':').map(Number);
  const cutoffDay = cutoffHour < startHour ? day + 1 : day;
  const standardCutoff = new Date(year, month - 1, cutoffDay, cutoffHour, cutoffMinute, 0, 0);

  // Effective cutoff extends standardCutoff by approved buffer minutes
  const effectiveCutoff = new Date(standardCutoff.getTime() + approvedExtensionMinutes * 60000);

  return {
    sessionDate,
    windowStart,
    standardCutoff,
    effectiveCutoff,
    extensionMinutes: approvedExtensionMinutes,
  };
}

export interface WindowEvaluation {
  isWithinWindow: boolean;
  isTooEarly: boolean;
  isLate: boolean;
  hasExtensionApplied: boolean;
  timeRemainingMs: number;
}

/**
 * Evaluates whether a server-authoritative timestamp falls strictly within the curfew window.
 */
export function evaluateCurfewStatus(
  checkInTime: Date,
  window: CurfewWindow
): WindowEvaluation {
  const time = checkInTime.getTime();
  const start = window.windowStart.getTime();
  const standard = window.standardCutoff.getTime();
  const effective = window.effectiveCutoff.getTime();

  if (time < start) {
    return {
      isWithinWindow: false,
      isTooEarly: true,
      isLate: false,
      hasExtensionApplied: false,
      timeRemainingMs: start - time,
    };
  }

  if (time <= effective) {
    const isPastStandard = time > standard;
    return {
      isWithinWindow: true,
      isTooEarly: false,
      isLate: false,
      hasExtensionApplied: isPastStandard && window.extensionMinutes > 0,
      timeRemainingMs: effective - time,
    };
  }

  // After effective cutoff -> Late check-in
  return {
    isWithinWindow: false,
    isTooEarly: false,
    isLate: true,
    hasExtensionApplied: window.extensionMinutes > 0,
    timeRemainingMs: 0,
  };
}
