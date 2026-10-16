import React, { useState } from 'react';
import { AppScreen, Student } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { checkInResident, checkOutResident, recordEstimatedReturnTime } from '../../lib/attendance-service';
import { getMockUserForRole } from '../../lib/auth';

export interface StudentDashboardViewProps {
  student?: Student | null;
  onNavigate: (screen: AppScreen) => void;
  onUpdateAttendance: (status: 'IN' | 'OUT' | 'Pending') => void;
}

export const StudentDashboardView: React.FC<StudentDashboardViewProps> = ({
  student,
  onNavigate,
  onUpdateAttendance,
}) => {
  const { user, logout } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOutModal, setShowOutModal] = useState(false);
  const [outReason, setOutReason] = useState('');
  const [returnTimeInput, setReturnTimeInput] = useState(student?.estimatedReturnTime || '');
  const [returnTimeSubmitted, setReturnTimeSubmitted] = useState(!!student?.estimatedReturnTime);
  const [outsideWarning, setOutsideWarning] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

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

    try {
      const activeActor = user || getMockUserForRole('student');
      await checkOutResident({
        studentDocId: student.id,
        studentId: student.studentId,
        hostelId: student.hostelId || 'HST-HER-01',
        outPassReason: outReason.trim() || 'Leaving hostel premises',
        actor: activeActor,
      });

      onUpdateAttendance('OUT');
      setShowOutModal(false);
      setOutReason('');
      setReturnTimeSubmitted(false);
      showToast('Checked OUT recorded. Safe travels!', 'info');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to record check OUT.', 'error');
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
    try {
      const activeActor = user || getMockUserForRole('student');
      await recordEstimatedReturnTime(
        student.id,
        student.hostelId || 'HST-HER-01',
        returnTimeInput.trim(),
        activeActor
      );
      setReturnTimeSubmitted(true);
      showToast('Expected return time submitted to your hostel warden.', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to record return time.', 'error');
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
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2 text-violet-400 font-bold text-sm">
                <span className="material-symbols-outlined text-base">schedule</span>
                <span>Expected Return Time</span>
              </div>
              <p className="text-xs text-slate-300">
                Let your hostel warden know when you plan to return tonight:
              </p>

              <form onSubmit={handleReturnTimeSubmit} className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    required
                    value={returnTimeInput}
                    onChange={(e) => setReturnTimeInput(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono outline-none focus:border-violet-500"
                  />
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
                {returnTimeSubmitted && (
                  <p className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                    <span className="material-symbols-outlined text-sm">done</span>
                    <span>Estimated return noted for tonight. (Status remains OUT).</span>
                  </p>
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
                  Optional Reason or Note
                </label>
                <input
                  type="text"
                  value={outReason}
                  onChange={(e) => setOutReason(e.target.value)}
                  placeholder="e.g. Campus Library, Grocery, Visiting family..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-violet-500"
                />
              </div>

              {/* Quick Reason Chips */}
              <div className="flex flex-wrap gap-1.5">
                {['Library', 'Dinner', 'Grocery', 'Market', 'Class'].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setOutReason(chip)}
                    className="px-2.5 py-1 rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
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
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer shadow-md disabled:opacity-50"
                >
                  Confirm OUT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
