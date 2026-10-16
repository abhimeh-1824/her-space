import React, { useState, useEffect } from 'react';
import { AppScreen, Student, Hostel } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { checkInResident, checkOutResident, recordEstimatedReturnTime } from '../../lib/attendance-service';
import { getMockUserForRole } from '../../lib/auth';
import { subscribeToHostels, acknowledgeStudentAlertInDb } from '../../lib/db-seed';

export interface StudentDashboardViewProps {
  student?: Student | null;
  onNavigate: (screen: AppScreen) => void;
  onUpdateAttendance: (status: 'IN' | 'OUT' | 'Pending', outReason?: string, estimatedReturnTime?: string) => void;
}

export const StudentDashboardView: React.FC<StudentDashboardViewProps> = ({
  student,
  onNavigate,
  onUpdateAttendance,
}) => {
  const { user, logout, authorizedHostels, availableHostels } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOutModal, setShowOutModal] = useState(false);
  const [outReason, setOutReason] = useState('');

  const todayDateStr = new Date().toISOString().slice(0, 10);

  // Live subscribed hostels (so changes from warden are instantly received)
  const [liveHostels, setLiveHostels] = useState<Hostel[]>(availableHostels || []);

  useEffect(() => {
    const unsub = subscribeToHostels((hList) => {
      setLiveHostels(hList);
    });
    return () => unsub();
  }, []);

  // Return date & time states for card
  const [returnDateInput, setReturnDateInput] = useState(() => {
    if (student?.estimatedReturnTime && student.estimatedReturnTime.includes('at')) {
      return student.estimatedReturnTime.split('at')[0].trim();
    }
    return todayDateStr;
  });

  const [returnTimeInput, setReturnTimeInput] = useState(() => {
    if (student?.estimatedReturnTime && student.estimatedReturnTime.includes('at')) {
      return student.estimatedReturnTime.split('at')[1].trim();
    }
    return student?.estimatedReturnTime || '22:00';
  });

  const [returnTimeSubmitted, setReturnTimeSubmitted] = useState(!!student?.estimatedReturnTime);

  // Modal Return date & time states
  const [modalReturnDate, setModalReturnDate] = useState(todayDateStr);
  const [modalReturnTime, setModalReturnTime] = useState('22:00');

  const [outsideWarning, setOutsideWarning] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [pushPermission, setPushPermission] = useState<'default' | 'granted' | 'denied'>('default');
  const [activeWardenAlert, setActiveWardenAlert] = useState<{
    id: string;
    title: string;
    message: string;
    sentAt: string;
    senderName?: string;
  } | null>(null);

  const activeHostel =
    liveHostels.find((h) => h.id === student?.hostelId) ||
    (authorizedHostels || []).find((h) => h.id === student?.hostelId) ||
    liveHostels[0] ||
    authorizedHostels?.[0];

  const formatTimeDisplay = (timeVal: string) => {
    if (!timeVal) return '';
    if (timeVal.includes('AM') || timeVal.includes('PM')) return timeVal;
    const parts = timeVal.split(':');
    if (parts.length < 2) return timeVal;
    const hours = parseInt(parts[0], 10);
    if (isNaN(hours)) return timeVal;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${parts[1]} ${ampm}`;
  };

  const applyReturnPreset = (target: 'modal' | 'card', preset: string) => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    let d = today;
    let t = '22:00';

    if (preset === 'tonight-10') {
      d = today;
      t = '22:00';
    } else if (preset === 'tonight-1030') {
      d = today;
      t = '22:30';
    } else if (preset === 'tonight-11') {
      d = today;
      t = '23:00';
    } else if (preset === 'tomorrow-morning') {
      d = tomorrow;
      t = '08:00';
    } else if (preset === 'tomorrow-night') {
      d = tomorrow;
      t = '22:00';
    } else if (preset === 'weekend') {
      const dayOfWeek = now.getDay();
      const daysUntilMonday = ((1 - dayOfWeek + 7) % 7) || 7;
      const monday = new Date(now.getTime() + daysUntilMonday * 86400000).toISOString().slice(0, 10);
      d = monday;
      t = '08:00';
    }

    if (target === 'modal') {
      setModalReturnDate(d);
      setModalReturnTime(t);
    } else {
      setReturnDateInput(d);
      setReturnTimeInput(t);
    }
  };

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  // Real-time listener for direct warden alerts sent to this student
  useEffect(() => {
    if (!student?.pendingAlert) return;
    const alert = student.pendingAlert;
    if (alert.acknowledged) {
      setActiveWardenAlert(null);
      return;
    }

    const alertKey = `alert_ack_${student.id}_${alert.id}`;
    if (typeof window !== 'undefined' && sessionStorage.getItem(alertKey)) return;

    setActiveWardenAlert(alert);
    playNotificationChime();
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([400, 150, 400, 150, 400]);
      } catch {}
    }
    triggerMobileNotification(alert.title || '🚨 Urgent Warden Alert', {
      body: alert.message,
      tag: `warden-alert-${alert.id}`,
    });
  }, [student?.pendingAlert]);

  const handleAcknowledgeAlert = async () => {
    if (!activeWardenAlert || !student) return;
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`alert_ack_${student.id}_${activeWardenAlert.id}`, 'true');
      }
      await acknowledgeStudentAlertInDb(student.id);
      setActiveWardenAlert(null);
      showToast('Warden alert acknowledged.', 'info');
    } catch {
      setActiveWardenAlert(null);
    }
  };

  const playNotificationChime = () => {
    if (typeof window === 'undefined') return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  };

  const matchesCurfewSlot = (slot: string, date: Date): boolean => {
    if (!slot) return false;

    const currentHH = date.getHours();
    const currentMM = date.getMinutes();
    const currentMMStr = String(currentMM).padStart(2, '0');
    const currentHH24Str = String(currentHH).padStart(2, '0');
    const time24 = `${currentHH24Str}:${currentMMStr}`; // e.g. "19:50"

    const current12Hour = currentHH % 12 || 12;
    const time12NoPad = `${current12Hour}:${currentMMStr}`; // e.g. "7:50"
    const time12Padded = `${String(current12Hour).padStart(2, '0')}:${currentMMStr}`; // e.g. "07:50"

    const cleanSlot = slot.trim().toLowerCase();

    // 1. Direct match with 24-hr ("19:50" === "19:50")
    if (cleanSlot === time24) return true;

    // 2. Direct match with 12-hr ("7:50" === "7:50" or "07:50" === "07:50")
    if (cleanSlot === time12NoPad || cleanSlot === time12Padded) return true;

    // 3. Match with AM/PM (e.g. "7:50 pm" or "07:50 pm")
    const ampm = currentHH >= 12 ? 'pm' : 'am';
    if (cleanSlot.includes(ampm)) {
      const withoutAmpm = cleanSlot.replace(ampm, '').trim();
      if (withoutAmpm === time12NoPad || withoutAmpm === time12Padded || withoutAmpm === time24) {
        return true;
      }
    }

    // 4. Evening equivalence: if current time is evening (hour >= 12, e.g. 7:50 PM = 19:50)
    // and user entered "7:50" or "07:50" (without PM) in the time input
    const parts = slot.split(':');
    if (parts.length >= 2) {
      const sHour = parseInt(parts[0], 10);
      const sMin = parseInt(parts[1].replace(/[^0-9]/g, ''), 10);
      if (!isNaN(sHour) && !isNaN(sMin)) {
        if (sMin === currentMM) {
          if (sHour === currentHH) return true;
          if (sHour === current12Hour) return true;
          if (sHour + 12 === currentHH) return true;
        }
      }
    }

    return false;
  };

  const triggerMobileNotification = async (title: string, options: NotificationOptions) => {
    playNotificationChime();
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([300, 100, 300, 100, 300]);
      } catch {}
    }

    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    // Mobile Android Chrome strictly requires ServiceWorkerRegistration.showNotification()
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          const notifOpts: Record<string, unknown> = {
            ...options,
            vibrate: [300, 100, 300, 100, 300],
          };
          if (options.icon) notifOpts.icon = options.icon;
          if (options.badge) notifOpts.badge = options.badge;
          await reg.showNotification(title, notifOpts as NotificationOptions);
          return;
        }
      } catch (swErr) {
        console.warn('[Notification] ServiceWorker ready fallback:', swErr);
      }
    }

    try {
      new Notification(title, options);
    } catch (winErr) {
      console.warn('[Notification] Window notification fallback:', winErr);
    }
  };

  const handleRequestPushPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showToast('Notifications are not supported by this browser.', 'info');
      return;
    }
    try {
      const res = await Notification.requestPermission();
      setPushPermission(res);
      if (res === 'granted') {
        if ('serviceWorker' in navigator) {
          try {
            await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          } catch {}
        }
        await triggerMobileNotification('HER-SPACE Curfew Alerts Enabled ✅', {
          body: 'Night roll-call notifications are now active on your mobile phone.',
          tag: 'her-space-enabled',
        });
        showToast('Push notifications enabled for curfew alerts!', 'success');
      } else {
        showToast('Notification permission denied in browser settings.', 'error');
      }
    } catch {
      showToast('Error requesting notification permission.', 'error');
    }
  };

  const handleSendTestNotification = async () => {
    try {
      await triggerMobileNotification('HER-SPACE Test Alert 🔔', {
        body: 'Curfew roll-call alerts are working successfully on this device!',
        tag: 'her-space-test',
      });
      showToast('Test notification dispatched with sound & vibration!', 'success');
    } catch {
      showToast('Could not dispatch test notification.', 'error');
    }
  };

  // Live in-browser reminder watcher for configured curfew times (e.g. 7:50, 7:52, 7:55, 22:00, etc.)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const interval = setInterval(() => {
      if (!student) return;

      const now = new Date();
      const currentHH = String(now.getHours()).padStart(2, '0');
      const currentMM = String(now.getMinutes()).padStart(2, '0');
      const timeStr = `${currentHH}:${currentMM}`;

      const schedule = [
        activeHostel?.curfewStart,
        ...(activeHostel?.reminderSchedule || []),
        activeHostel?.reminder1,
        activeHostel?.reminder2,
        activeHostel?.reminder3,
      ].filter(Boolean) as string[];

      // Check if any scheduled slot matches the current minute
      const matchedSlot = schedule.find((slot) => matchesCurfewSlot(slot, now));

      if (matchedSlot) {
        const notifKey = `curfew_alert_${student.id}_${timeStr}_${now.toISOString().slice(0, 10)}`;
        if (!sessionStorage.getItem(notifKey)) {
          sessionStorage.setItem(notifKey, 'true');
          const isOut = student.attendanceStatus === 'OUT';
          const alertBody = isOut
            ? `Night roll-call reminder (${formatTimeDisplay(matchedSlot)}): You are currently marked OUT. Please return inside hostel boundary.`
            : `Night roll-call reminder (${formatTimeDisplay(matchedSlot)}): Roll-call is active. Your attendance is confirmed IN.`;

          triggerMobileNotification('HER-SPACE Curfew Alert ⏰', {
            body: alertBody,
            tag: `curfew-${matchedSlot}`,
          });

          showToast(alertBody, isOut ? 'error' : 'info');
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [student, activeHostel]);

  if (!student) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
        <header className="bg-slate-800/90 border-b border-slate-700/80 px-4 py-3.5 sticky top-0 z-30 backdrop-blur-md">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-violet-600/30 text-violet-400 border border-violet-500/40 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[20px]">shield</span>
              </div>
              <div>
                <h1 className="font-bold text-sm tracking-tight">HER-SPACE</h1>
                <p className="text-[11px] text-slate-400">Night Attendance System</p>
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">logout</span>
            </button>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
            <span className="material-symbols-outlined text-3xl">person_off</span>
          </div>
          <h2 className="font-bold text-lg text-white">No Resident Profile Linked</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            There is currently no registered resident record active for this account. Contact your hostel administrator or complete registration to check in.
          </p>
          <button
            onClick={() => onNavigate('login')}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  const isCheckedIn = student.attendanceStatus === 'IN';
  const isCheckedOut = student.attendanceStatus === 'OUT';

  // Flow D: Check OUT (anywhere, optional note, idempotent)
  const handleCheckOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setOutsideWarning(null);

    const activeActor = user || getMockUserForRole('student');
    const studentDocId = student.id || student.studentId || user?.uid || 'STU-101';
    const studentId = student.studentId || student.id || 'STU-101';
    const studentEmail = student.email || user?.email;
    const finalReason = outReason.trim() || 'Leaving hostel premises';
    const formattedReturn = modalReturnTime
      ? `${modalReturnDate || todayDateStr} at ${formatTimeDisplay(modalReturnTime)}`
      : '';

    try {
      await checkOutResident({
        studentDocId,
        studentId,
        studentEmail,
        hostelId: student.hostelId || activeHostel?.id || 'HST-HER-01',
        outPassReason: finalReason,
        estimatedReturnTime: formattedReturn,
        actor: {
          ...activeActor,
          role: activeActor.role || 'student',
        },
      });

      onUpdateAttendance('OUT', finalReason, formattedReturn);
      setShowOutModal(false);
      setOutReason('');
      setReturnDateInput(modalReturnDate || todayDateStr);
      setReturnTimeInput(modalReturnTime);
      setReturnTimeSubmitted(!!formattedReturn);
      showToast('Checked OUT recorded successfully. Safe travels!', 'success');
    } catch (err: unknown) {
      console.warn('[CheckOut] Local fallback:', err);
      // Guarantee student attendance changes to OUT even if network hiccups
      onUpdateAttendance('OUT', finalReason, formattedReturn);
      setShowOutModal(false);
      setOutReason('');
      setReturnDateInput(modalReturnDate || todayDateStr);
      setReturnTimeInput(modalReturnTime);
      setReturnTimeSubmitted(!!formattedReturn);
      showToast('Checked OUT recorded. Safe travels!', 'success');
    } finally {
      setIsProcessing(false);
    }
  };

  // Flow E: Check IN (Location Verification with exact outside warning)
  const handleCheckInClick = async () => {
    setIsProcessing(true);
    setOutsideWarning(null);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setIsProcessing(false);
      showToast('Geolocation is not supported by your browser. Please use a modern mobile browser.', 'error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy);

        try {
          const activeActor = user || getMockUserForRole('student');
          const result = await checkInResident({
            studentId: student.studentId,
            studentDocId: student.id,
            studentEmail: student.email,
            hostelId: student.hostelId || 'HST-HER-01',
            location: {
              latitude: lat,
              longitude: lng,
              accuracyMeters: accuracy,
              timestamp: new Date().toISOString(),
              isMocked: false,
              address: 'Campus Geofence Boundary',
            },
            actor: activeActor,
          });

          if (result.isOutsideRadius) {
            // EXACT required warning string from Section 8
            setOutsideWarning(
              "You appear to be outside your hostel's permitted check-in area. Your attendance status has not changed. Please return to the hostel and try again."
            );
            // Official status remains OUT
            onUpdateAttendance('OUT');
          } else {
            // Inside permitted radius: official status becomes IN
            onUpdateAttendance('IN');
            setOutsideWarning(null);
            showToast(result.message || 'Check IN confirmed! Welcome back.', 'success');
          }
        } catch (err: unknown) {
          showToast(err instanceof Error ? err.message : 'Error validating location.', 'error');
        } finally {
          setIsProcessing(false);
        }
      },
      (err) => {
        setIsProcessing(false);
        let errorMsg = 'Location permission is required to verify your check-in inside the hostel.';
        if (err.code === err.PERMISSION_DENIED) {
          errorMsg = 'Location permission was denied. Please allow location access in your browser settings to check in.';
        } else if (err.code === err.TIMEOUT) {
          errorMsg = 'Location request timed out. Please check your GPS signal and try again.';
        }
        showToast(errorMsg, 'error');
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // Flow F: Estimated Return Time submission (informational only)
  const handleReturnTimeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnTimeInput.trim()) return;

    setIsProcessing(true);
    const activeActor = user || getMockUserForRole('student');
    const studentDocId = student.id || student.studentId || user?.uid || 'STU-101';
    const formattedReturn = `${returnDateInput || todayDateStr} at ${formatTimeDisplay(returnTimeInput)}`;

    try {
      await recordEstimatedReturnTime(
        studentDocId,
        student.hostelId || activeHostel?.id || 'HST-HER-01',
        formattedReturn,
        {
          ...activeActor,
          role: activeActor.role || 'student',
        }
      );
      onUpdateAttendance('OUT', student.outReason, formattedReturn);
      setReturnTimeSubmitted(true);
      showToast(`Expected return noted: ${formattedReturn}`, 'success');
    } catch (err: unknown) {
      console.warn('[recordEstimatedReturnTime] Local note:', err);
      onUpdateAttendance('OUT', student.outReason, formattedReturn);
      setReturnTimeSubmitted(true);
      showToast(`Expected return noted: ${formattedReturn}`, 'success');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-semibold max-w-sm w-full mx-4 border animate-bounce bg-slate-800 text-white border-slate-600">
          <span
            className={`material-symbols-outlined text-lg ${
              toastMessage.type === 'success'
                ? 'text-emerald-400'
                : toastMessage.type === 'error'
                ? 'text-rose-400'
                : 'text-sky-400'
            }`}
          >
            {toastMessage.type === 'success' ? 'check_circle' : toastMessage.type === 'error' ? 'error' : 'info'}
          </span>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Main Content (Mobile-First Thumb-Friendly) */}
      <main className="max-w-md w-full mx-auto px-4 py-5 pb-24 md:pb-8 flex-1 flex flex-col justify-between space-y-6">
        <div className="space-y-5">
          {/* Resident Identity Card */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 shadow-xl flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 text-white flex items-center justify-center font-bold text-lg shadow-md">
                {student.avatarInitials || student.name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="font-bold text-base text-white">{student.name}</h2>
                <p className="text-xs text-slate-400">
                  Room <span className="font-semibold text-slate-200">{student.room}</span> · ID: <span className="font-mono text-slate-300">{student.studentId}</span>
                </p>
                <p className="text-[11px] text-violet-400 font-medium">{student.hostelId || 'HER-SPACE Residency'}</p>
              </div>
            </div>

            {/* Current Status Pill */}
            <div className="text-right">
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
                  isCheckedIn
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                <span>{isCheckedIn ? 'IN HOSTEL' : 'OUTSIDE'}</span>
              </span>
              <p className="text-[10px] text-slate-400 mt-1">
                {isCheckedIn ? `In since ${student.attendanceTime || 'Today'}` : `Out since ${student.outTime || 'Earlier'}`}
              </p>
            </div>
          </div>

          {/* Notification Permission Card */}
          {pushPermission !== 'granted' ? (
            <div className="bg-gradient-to-r from-violet-950/70 to-indigo-950/70 border border-violet-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs shadow-lg">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="material-symbols-outlined text-violet-400 text-xl shrink-0">notifications_active</span>
                <div className="min-w-0">
                  <p className="font-semibold text-white">Enable Curfew Alerts</p>
                  <p className="text-[11px] text-slate-300 truncate">Get roll-call reminders on this phone</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRequestPushPermission}
                className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs shrink-0 cursor-pointer shadow-md transition-colors"
              >
                Enable
              </button>
            </div>
          ) : (
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs shadow-md">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-emerald-400 text-base shrink-0">check_circle</span>
                <div className="min-w-0">
                  <p className="font-semibold text-white text-[12px]">Curfew Alerts Active</p>
                  <p className="text-[10px] text-slate-400">Mobile notifications enabled for this session</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSendTestNotification}
                className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-medium shrink-0 cursor-pointer transition-colors"
              >
                Test Alert
              </button>
            </div>
          )}

          {/* Flow E Warning Banner: Exactly required when outside geofence */}
          {outsideWarning && (
            <div className="bg-amber-950/60 border border-amber-500/50 rounded-2xl p-4 text-xs space-y-2 shadow-lg">
              <div className="flex items-start gap-2.5 text-amber-300 font-bold">
                <span className="material-symbols-outlined text-lg mt-0.5">location_off</span>
                <span>Outside Check-in Area</span>
              </div>
              <p className="text-amber-100/90 leading-relaxed font-medium">
                {outsideWarning}
              </p>
              <div className="pt-1 flex items-center justify-between text-[11px] text-amber-300/80">
                <span>Status remains: <strong>OUT</strong></span>
                <span>Attempt recorded</span>
              </div>
            </div>
          )}

          {/* Primary Action Hero Card */}
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 shadow-xl text-center space-y-5">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {isCheckedIn ? 'Departing Hostel' : 'Returning to Hostel'}
              </p>
              <h3 className="text-xl font-bold text-white">
                {isCheckedIn ? 'Ready to Leave?' : 'Back at HER-SPACE?'}
              </h3>
              <p className="text-xs text-slate-300 max-w-xs mx-auto">
                {isCheckedIn
                  ? 'Tap Check OUT when leaving hostel premises. You can check OUT from anywhere.'
                  : 'Tap Check IN when you have physically arrived inside your hostel boundary.'}
              </p>
            </div>

            {/* ONE CLEAR PRIMARY BUTTON */}
            {isCheckedIn ? (
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setShowOutModal(true)}
                className="w-full py-4 rounded-2xl bg-amber-600 hover:bg-amber-500 active:scale-98 disabled:opacity-50 text-white font-bold text-base shadow-lg shadow-amber-900/40 transition-all cursor-pointer flex items-center justify-center gap-2.5"
              >
                <span className="material-symbols-outlined text-2xl">logout</span>
                <span>Check OUT</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleCheckInClick}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 disabled:opacity-50 text-white font-bold text-base shadow-lg shadow-emerald-900/40 transition-all cursor-pointer flex items-center justify-center gap-2.5"
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Verifying Location...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-2xl">my_location</span>
                    <span>Check IN (Verify Location)</span>
                  </>
                )}
              </button>
            )}

            {/* Location Safeguard Caption */}
            <p className="text-[11px] text-slate-400">
              {isCheckedIn
                ? 'Check OUT does not require location verification.'
                : 'Check IN uses temporary browser GPS to verify you are within the hostel boundary.'}
            </p>
          </div>

          {/* Flow F: Estimated Return Time Form (Shown when OUT) */}
          {isCheckedOut && (
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-violet-400 font-bold text-sm">
                  <span className="material-symbols-outlined text-base">schedule</span>
                  <span>Expected Return Date &amp; Time</span>
                </div>
                {student.estimatedReturnTime && (
                  <span className="px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-semibold border border-violet-500/30">
                    Active Note
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-300">
                Let your hostel warden know when you plan to return:
              </p>

              {/* Quick Preset Chips */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {[
                  { label: 'Tonight 10:00 PM', id: 'tonight-10' },
                  { label: 'Tonight 10:30 PM', id: 'tonight-1030' },
                  { label: 'Tomorrow 08:00 AM', id: 'tomorrow-morning' },
                  { label: 'Tomorrow 10:00 PM', id: 'tomorrow-night' },
                  { label: 'Weekend / Monday', id: 'weekend' },
                ].map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => applyReturnPreset('card', chip.id)}
                    className="px-2.5 py-1 rounded-lg bg-slate-700/70 hover:bg-violet-600 hover:text-white text-slate-300 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleReturnTimeSubmit} className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Return Date
                    </label>
                    <input
                      type="date"
                      required
                      min={todayDateStr}
                      value={returnDateInput}
                      onChange={(e) => setReturnDateInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-violet-500 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Return Time
                    </label>
                    <input
                      type="time"
                      required
                      value={returnTimeInput}
                      onChange={(e) => setReturnTimeInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-violet-500 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-slate-400">
                    {returnDateInput && returnTimeInput
                      ? `Expected: ${returnDateInput} at ${formatTimeDisplay(returnTimeInput)}`
                      : 'Choose your estimated return'}
                  </span>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-98 text-white font-bold text-xs transition-all cursor-pointer shadow-md disabled:opacity-50"
                  >
                    Save Return
                  </button>
                </div>

                {returnTimeSubmitted && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-[11px] text-emerald-300 flex items-center gap-2 font-medium">
                    <span className="material-symbols-outlined text-base text-emerald-400">check_circle</span>
                    <span>Expected return recorded: {student.estimatedReturnTime || `${returnDateInput} at ${formatTimeDisplay(returnTimeInput)}`}</span>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Last Captured Location Card */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span className="font-semibold uppercase tracking-wider">Last Captured Location</span>
              <span>{student.lastUpdated || 'Today'}</span>
            </div>
            <p className="font-semibold text-slate-200">
              {student.lastLocationSnapshot || 'No location fix captured today'}
            </p>
            {student.locationAccuracy && (
              <p className="text-[11px] text-slate-400">
                Accuracy: {student.locationAccuracy}
              </p>
            )}
            <p className="text-[10px] text-slate-500 italic pt-1">
              Note: Recorded only at check-in attempt. Continuous background tracking is never used.
            </p>
          </div>
        </div>

        {/* Bottom Navigation Shortcut */}
        <div className="pt-4 text-center">
          <button
            onClick={() => onNavigate('terms-privacy')}
            className="text-xs text-slate-400 hover:text-slate-300 underline cursor-pointer"
          >
            Hostel Rules, Terms & Privacy Policy
          </button>
        </div>
      </main>

      {/* Check OUT Modal (Optional Reason / Note) */}
      {showOutModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="max-w-sm w-full bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400">logout</span>
                <h3 className="font-bold text-base text-white">Check OUT Confirmation</h3>
              </div>
              <button
                onClick={() => setShowOutModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleCheckOutSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  Destination / Reason for Leaving
                </label>
                <input
                  type="text"
                  value={outReason}
                  onChange={(e) => setOutReason(e.target.value)}
                  placeholder="e.g. Campus Library, Grocery, Coaching, Going Home..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-violet-500"
                />
              </div>

              {/* Quick Reason Chips */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Campus Library',
                  'Dinner / Food',
                  'Grocery / Market',
                  'Class / Coaching',
                  'Going Home / Village',
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setOutReason(chip)}
                    className="px-2.5 py-1 rounded-lg bg-slate-700/80 hover:bg-violet-600 hover:text-white text-slate-300 text-xs font-medium cursor-pointer transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Expected Return Date & Time Section */}
              <div className="pt-2 border-t border-slate-700/70 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-violet-400">schedule</span>
                    <span>Expected Return Date &amp; Time</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Optional</span>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Tonight 10:00 PM', id: 'tonight-10' },
                    { label: 'Tonight 10:30 PM', id: 'tonight-1030' },
                    { label: 'Tomorrow 08:00 AM', id: 'tomorrow-morning' },
                    { label: 'Tomorrow 10:00 PM', id: 'tomorrow-night' },
                    { label: 'Weekend / Monday', id: 'weekend' },
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => applyReturnPreset('modal', chip.id)}
                      className="px-2 py-0.5 rounded-md bg-slate-700/60 hover:bg-slate-700 text-slate-300 text-[10px] font-medium cursor-pointer"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Return Date</label>
                    <input
                      type="date"
                      min={todayDateStr}
                      value={modalReturnDate}
                      onChange={(e) => setModalReturnDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white outline-none focus:border-violet-500 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Return Time</label>
                    <input
                      type="time"
                      value={modalReturnTime}
                      onChange={(e) => setModalReturnTime(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white font-mono outline-none focus:border-violet-500 cursor-pointer"
                    />
                  </div>
                </div>

                <p className="text-[10px] text-slate-400">
                  {modalReturnDate && modalReturnTime
                    ? `Noted return: ${modalReturnDate} at ${formatTimeDisplay(modalReturnTime)}`
                    : 'Set your estimated return time for the warden.'}
                </p>
              </div>

              <div className="bg-slate-900/60 rounded-xl p-3 text-[11px] text-slate-400 space-y-1">
                <p>• An authoritative server OUT timestamp will be recorded.</p>
                <p>• Your status will change to OUT immediately.</p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowOutModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white cursor-pointer font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer shadow-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Confirm OUT</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Direct Warden Alert Modal */}
      {activeWardenAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-800 border-2 border-red-500/80 rounded-3xl max-w-sm w-full p-6 text-white shadow-2xl relative space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-600/30 text-red-400 border border-red-500/50 flex items-center justify-center shrink-0 animate-bounce">
                <span className="material-symbols-outlined text-2xl">campaign</span>
              </div>
              <div className="min-w-0">
                <span className="inline-block px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold border border-red-500/40 uppercase tracking-wider">
                  Direct Warden Alert
                </span>
                <h3 className="font-bold text-base text-white truncate mt-0.5">
                  {activeWardenAlert.title || 'Curfew Roll-Call Alert'}
                </h3>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 text-sm text-slate-200 leading-relaxed font-medium">
              {activeWardenAlert.message}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>From: <strong className="text-slate-300">{activeWardenAlert.senderName || 'Warden Administration'}</strong></span>
              <span>{activeWardenAlert.sentAt ? new Date(activeWardenAlert.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</span>
            </div>

            <button
              type="button"
              onClick={handleAcknowledgeAlert}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm shadow-lg shadow-red-600/30 cursor-pointer flex items-center justify-center gap-2 transition-transform active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">check_circle</span>
              <span>I Acknowledge / Understood</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
