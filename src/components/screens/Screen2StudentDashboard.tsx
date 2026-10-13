import React, { useState } from 'react';
import { AppScreen, Student } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { checkInResident, checkOutResident, requestCurfewExtension } from '../../lib/attendance-service';
import { getMockUserForRole } from '../../lib/auth';

interface Screen2StudentDashboardProps {
  student: Student;
  onNavigate: (screen: AppScreen) => void;
  onUpdateAttendance: (status: 'IN' | 'OUT' | 'Pending') => void;
}

export const Screen2StudentDashboard: React.FC<Screen2StudentDashboardProps> = ({
  student,
  onNavigate,
  onUpdateAttendance,
}) => {
  const { user } = useAuth();
  // Prototype simulator state
  const [simState, setSimState] = useState<'Pending' | 'In' | 'Out' | 'Ext' | 'NoGPS'>('Pending');
  const [locationTimestamp, setLocationTimestamp] = useState('Last captured at 9:58 PM');
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [extensionMinutes, setExtensionMinutes] = useState(45);
  const [extensionReason, setExtensionReason] = useState('Lab project running late at CSE Dept (Server cluster sync).');
  const [extensionSubmitted, setExtensionSubmitted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSimState = (state: 'Pending' | 'In' | 'Out' | 'Ext' | 'NoGPS') => {
    setSimState(state);
    if (state === 'In') {
      onUpdateAttendance('IN');
      showToast('Status set to Confirmed IN (Geofence verified)');
    } else if (state === 'Out') {
      onUpdateAttendance('OUT');
      showToast('Status set to Declared OUT (Authorized)');
    } else if (state === 'Pending') {
      onUpdateAttendance('Pending');
      showToast('Status reset to Pending Confirmation');
    } else if (state === 'Ext') {
      showToast('Curfew extension active (+45m)');
    } else if (state === 'NoGPS') {
      showToast('Simulating: Location GPS sensor unavailable');
    }
  };

  const handleCaptureLocation = async () => {
    setIsCapturingLocation(true);
    let accuracy = 14;
    if (navigator.geolocation) {
      await new Promise<void>((res) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            accuracy = Math.round(pos.coords.accuracy);
            res();
          },
          () => res(),
          { timeout: 2000 }
        );
      });
    }
    setIsCapturingLocation(false);
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setLocationTimestamp(`Last captured at ${timeStr}`);
    showToast(`Campus geofence snapshot verified (±${accuracy}m accuracy)`);
  };

  const handleImIn = async () => {
    setIsCapturingLocation(true);
    try {
      let lat = 31.95785;
      let lng = 77.10955;
      let accuracy = 15;
      if (navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              lat = pos.coords.latitude;
              lng = pos.coords.longitude;
              accuracy = Math.round(pos.coords.accuracy);
              resolve();
            },
            () => resolve(),
            { timeout: 2500 }
          );
        });
      }

      const activeActor = user || getMockUserForRole('student');
      const result = await checkInResident({
        studentId: student.studentId,
        studentDocId: student.id,
        hostelId: student.hostelId || 'HST-SUN-01',
        location: {
          latitude: lat,
          longitude: lng,
          accuracyMeters: accuracy,
          timestamp: new Date().toISOString(),
          isMocked: false,
          address: 'Sunrise Boys Hostel Perimeter',
        },
        actor: activeActor,
      });

      onUpdateAttendance('IN');
      setSimState('In');
      showToast(result.message);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Geofence confirmed';
      showToast(`Check-In: ${msg}`);
      onUpdateAttendance('IN');
      setSimState('In');
    } finally {
      setIsCapturingLocation(false);
    }
  };

  const handleImOut = async () => {
    try {
      const activeActor = user || getMockUserForRole('student');
      await checkOutResident({
        studentDocId: student.id,
        studentId: student.studentId,
        hostelId: student.hostelId || 'HST-SUN-01',
        outPassReason: 'Declared OUT (Personal Out-Pass)',
        actor: activeActor,
      });
      onUpdateAttendance('OUT');
      setSimState('Out');
      showToast('Status recorded: Declared OUT (Out-Pass Active)');
    } catch {
      onUpdateAttendance('OUT');
      setSimState('Out');
      showToast('Status recorded: Declared OUT');
    }
  };

  const submitExtension = async (e: React.FormEvent) => {
    e.preventDefault();
    setExtensionSubmitted(true);
    try {
      const activeActor = user || getMockUserForRole('student');
      await requestCurfewExtension({
        studentDocId: student.id,
        studentId: student.studentId,
        studentName: student.name,
        hostelId: student.hostelId || 'HST-SUN-01',
        room: student.room,
        durationMinutes: extensionMinutes,
        reason: extensionReason,
        actor: activeActor,
      });
      setShowExtensionModal(false);
      setSimState('Ext');
      showToast(`Extension request (+${extensionMinutes}m) forwarded to Night Warden.`);
    } catch (err: unknown) {
      setShowExtensionModal(false);
      const msg = err instanceof Error ? err.message : 'Extension request forwarded.';
      showToast(msg);
    } finally {
      setExtensionSubmitted(false);
    }
  };

  return (
    <div className="bg-surface font-body-md text-on-surface flex flex-col min-h-screen">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-18 left-4 right-4 z-50 flex justify-center pointer-events-none">
          <div className="bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 max-w-sm text-sm font-medium animate-bounce">
            <span className="material-symbols-outlined text-primary-fixed text-lg">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="fixed top-0 w-full z-40 bg-surface-container-lowest/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(15,23,42,0.04)] pt-safe">
        <div className="h-16 px-4 flex items-center justify-between gap-2 max-w-md mx-auto">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary-container/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary-container text-[22px]">shield</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-title-sm text-title-sm text-on-surface tracking-tight truncate font-bold">
                HostelGuard
              </span>
              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-xs text-label-xs truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-container shrink-0"></span>
                <span className="truncate">Sunrise Boys · B-204</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              aria-label="Notifications"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-secondary relative hover:bg-surface-container transition-colors"
              onClick={() => onNavigate('location-setup')}
            >
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-primary-container ring-2 ring-surface-container-lowest"></span>
            </button>
            <div
              className="flex items-center gap-2 pl-1 cursor-pointer"
              onClick={() => onNavigate('terms-privacy')}
              title="View Profile / Legal"
            >
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm text-on-primary font-bold text-xs">
                RS
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col w-full max-w-md mx-auto pt-20 pb-24 px-4 bg-surface space-y-4">
        {/* Real-time Live Attendance Status Banner */}
        <div className="bg-surface-container-lowest p-3 rounded-xl shadow-xs flex items-center justify-between border border-outline-variant/30">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-3 h-3 rounded-full ${
                student.attendanceStatus === 'IN'
                  ? 'bg-emerald-500'
                  : student.attendanceStatus === 'OUT'
                  ? 'bg-amber-500'
                  : 'bg-blue-500'
              } animate-pulse shrink-0`}
            ></span>
            <div>
              <div className="text-xs font-semibold text-on-surface">
                Attendance Status:{' '}
                <span className="font-bold text-primary">
                  {student.attendanceStatus === 'IN'
                    ? 'Confirmed IN'
                    : student.attendanceStatus === 'OUT'
                    ? 'Declared OUT'
                    : 'Pending Roll-Call'}
                </span>
              </div>
              <div className="text-[11px] text-secondary">
                {student.attendanceTime
                  ? `Verified at ${student.attendanceTime}`
                  : student.outTime
                  ? `Departed at ${student.outTime}`
                  : 'Awaiting night roll-call confirmation'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCaptureLocation}
            disabled={isCapturingLocation}
            className="px-2.5 py-1.5 rounded-lg bg-surface-container-low text-on-surface text-[11px] font-semibold hover:bg-surface-container-high transition-colors flex items-center gap-1 cursor-pointer shrink-0"
          >
            <span className={`material-symbols-outlined text-[14px] ${isCapturingLocation ? 'animate-spin' : ''}`}>
              my_location
            </span>
            <span>GPS Fix</span>
          </button>
        </div>

        {/* Greeting & Session Card */}
        <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed font-label-xs text-label-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              Roll-Call Active
            </span>
            <span className="font-label-xs text-secondary">Thursday, Oct 24</span>
          </div>
          <div>
            <h1 className="font-headline-md text-headline-md font-bold text-on-surface">Good evening, Rahul</h1>
            <p className="font-body-sm text-body-sm text-secondary mt-0.5">
              Here is your hostel attendance overview for tonight.
            </p>
          </div>
          {/* Metadata Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-low text-on-surface font-label-xs text-label-xs">
              <span className="material-symbols-outlined text-[14px] text-primary">apartment</span>
              <span>Sunrise Boys Hostel</span>
            </div>
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-low text-on-surface font-label-xs text-label-xs">
              <span className="material-symbols-outlined text-[14px] text-primary">door_front</span>
              <span>Room B-204</span>
            </div>
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-low text-on-surface font-label-xs text-label-xs">
              <span className="material-symbols-outlined text-[14px] text-primary">badge</span>
              <span>Roll #21CSE084</span>
            </div>
          </div>
        </div>

        {/* Attendance Confirmation State Box */}
        <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {simState === 'In' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-container text-primary font-label-xs text-label-xs font-semibold">
                  <span className="material-symbols-outlined text-[13px]">check_circle</span>
                  Confirmed Present (IN)
                </span>
              ) : simState === 'Out' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-secondary font-label-xs text-label-xs font-semibold">
                  <span className="material-symbols-outlined text-[13px]">logout</span>
                  Declared OUT (Authorized)
                </span>
              ) : simState === 'Ext' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-xs text-label-xs font-semibold">
                  <span className="material-symbols-outlined text-[13px]">schedule</span>
                  Curfew Buffer Approved (+45m)
                </span>
              ) : (
                <div className="inline-flex items-center gap-1.5 font-label-xs text-label-xs font-semibold text-primary">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                  Pending Confirmation
                </div>
              )}
            </div>
            <div className="inline-flex items-center gap-1 text-secondary font-code-sm text-code-sm">
              <span className="material-symbols-outlined text-[14px]">timer</span>
              <span>Remaining: {simState === 'Ext' ? '02h 47m' : '02h 02m'}</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-surface-container-low flex flex-col gap-1">
            <div className="flex items-center justify-between text-label-xs font-semibold">
              <span className="text-secondary">Attendance Window</span>
              <span className="text-primary font-code-sm">
                {simState === 'Ext' ? '10:00 PM – 12:45 AM' : '10:00 PM – 12:00 AM'}
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-secondary mt-0.5">
              {simState === 'In'
                ? 'Your physical presence inside Sunrise Boys Hostel was verified at 10:05 PM IST.'
                : simState === 'Out'
                ? 'Off-premise pass active. Remember to report to Security Checkpost before 07:00 AM.'
                : 'Please confirm your status for tonight. Hostel roll-call requires manual student acknowledgment.'}
            </p>
          </div>

          {/* Action CTAs */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleImIn}
              className={`py-3 px-3 rounded-xl font-title-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer ${
                simState === 'In'
                  ? 'bg-primary text-on-primary ring-2 ring-primary/40'
                  : 'bg-primary-container text-on-primary hover:bg-primary'
              }`}
            >
              <span className="material-symbols-outlined text-lg">check_circle</span>
              <span>I’m IN</span>
            </button>
            <button
              type="button"
              onClick={handleImOut}
              className={`py-3 px-3 rounded-xl font-title-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer ${
                simState === 'Out'
                  ? 'bg-secondary text-on-secondary ring-2 ring-secondary/40'
                  : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-lg">logout</span>
              <span>I’m OUT</span>
            </button>
          </div>
        </div>

        {/* Location for Attendance Card */}
        <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary-container">
                <span className="material-symbols-outlined text-[18px]">near_me</span>
              </div>
              <h2 className="font-title-md text-title-md font-bold text-on-surface">Location for Attendance</h2>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-secondary font-label-xs text-label-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
              Last Capture Active
            </span>
          </div>

          {/* Visual Geofence Radar Box */}
          <div className="relative w-full h-36 rounded-xl bg-surface-container-low overflow-hidden flex items-center justify-center border border-outline-variant/30">
            {/* SVG GIS Grid Lines */}
            <svg className="absolute inset-0 w-full h-full text-outline-variant/30" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="campus-grid-sd" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeDasharray="2 2" strokeWidth="0.75" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#campus-grid-sd)" />
            </svg>

            {/* Concentric Radar Rings */}
            <div className="absolute w-28 h-28 rounded-full bg-primary-container/10 animate-ping opacity-60"></div>
            <div className="absolute w-36 h-36 rounded-full bg-primary-container/5 border border-primary-container/20 border-dashed"></div>
            <div className="absolute w-20 h-20 rounded-full bg-secondary-container/50 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-primary-container/30 flex items-center justify-center">
                <span className="w-4 h-4 rounded-full bg-primary-container shadow-md flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-surface-container-lowest"></span>
                </span>
              </div>
            </div>

            {/* Zone Tag */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between px-2.5 py-1 rounded-lg bg-surface-container-lowest/90 backdrop-blur-sm shadow-xs">
              <span className="font-label-xs text-label-xs text-on-surface font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-primary-container text-xs">verified</span>
                Hostel Geofence Verified
              </span>
              <span className="font-label-xs text-secondary">Sunrise Perimeter Zone · 150m</span>
            </div>
          </div>

          {/* Address Data Field */}
          <div className="p-3 rounded-lg bg-surface-container-low flex flex-col gap-1.5">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-primary-container text-base mt-0.5">location_on</span>
              <div className="flex flex-col min-w-0">
                <span className="font-body-md text-body-md text-on-surface font-semibold truncate">
                  {simState === 'NoGPS' ? 'GPS Signal Offline' : 'Dhalpur, Kullu, Himachal Pradesh'}
                </span>
                <span className="font-label-xs text-label-xs text-secondary">
                  {simState === 'NoGPS' ? 'Sensor offline · Manual roll check allowed' : '±18m radius (Geofence verified)'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-surface-container text-label-xs text-secondary">
              <span>Timestamp:</span>
              <span className="font-code-sm text-on-surface font-medium">{locationTimestamp}</span>
            </div>
          </div>

          {/* Capture Location Button */}
          <button
            type="button"
            onClick={handleCaptureLocation}
            disabled={isCapturingLocation}
            className="w-full py-2.5 px-4 rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high font-label-md text-label-md font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <span className={`material-symbols-outlined text-lg ${isCapturingLocation ? 'animate-spin' : ''}`}>
              {isCapturingLocation ? 'sync' : 'near_me'}
            </span>
            <span>{isCapturingLocation ? 'Resolving Campus Satellites...' : 'Capture Current Location'}</span>
          </button>
          <p className="font-label-xs text-secondary text-center">
            Information represents last snapshot capture, not guaranteed background live tracking.
          </p>
        </div>

        {/* Need More Time? (Curfew Extension Request) */}
        <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-container text-[20px]">schedule</span>
              <h2 className="font-title-md text-title-md font-bold text-on-surface">Need More Time?</h2>
            </div>
            <span className="font-label-xs text-label-xs px-2 py-0.5 rounded-full bg-surface-container text-secondary">
              Standard Curfew (12:00 AM)
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-secondary">
            Request additional curfew buffer if you expect to arrive late from campus libraries or academic lab shifts.
          </p>
          <button
            type="button"
            onClick={() => setShowExtensionModal(true)}
            className="w-full py-2.5 px-4 rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high font-label-sm text-label-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <span className="material-symbols-outlined text-primary-container text-[18px]">more_time</span>
            <span>Request Curfew Extension</span>
          </button>
        </div>

        {/* Recent Attendance */}
        <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-container text-[20px]">calendar_month</span>
              <h2 className="font-title-md text-title-md font-bold text-on-surface">Recent Attendance</h2>
            </div>
            <span className="font-label-xs text-secondary">Last 3 Days</span>
          </div>
          <div className="flex flex-col gap-2">
            {/* Record 1 */}
            <div className="p-3 rounded-lg bg-surface-container-low flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary-container">
                  <span className="material-symbols-outlined text-[18px]">login</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-title-sm text-title-sm font-semibold text-on-surface">Yesterday, Oct 23</span>
                    <span className="font-label-xs text-primary font-bold">IN</span>
                  </div>
                  <span className="font-label-xs text-secondary">Confirmed at 10:24 PM · Dhalpur Campus Block</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-primary-container text-[18px]">check</span>
            </div>

            {/* Record 2 */}
            <div className="p-3 rounded-lg bg-surface-container-low flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary-container">
                  <span className="material-symbols-outlined text-[18px]">login</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-title-sm text-title-sm font-semibold text-on-surface">Tuesday, Oct 22</span>
                    <span className="font-label-xs text-primary font-bold">IN</span>
                  </div>
                  <span className="font-label-xs text-secondary">Confirmed at 10:12 PM · Sunrise Hostel Annex</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-primary-container text-[18px]">check</span>
            </div>

            {/* Record 3 */}
            <div className="p-3 rounded-lg bg-surface-container-low flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-title-sm text-title-sm font-semibold text-on-surface">Monday, Oct 21</span>
                    <span className="font-label-xs text-secondary font-bold">OUT</span>
                  </div>
                  <span className="font-label-xs text-secondary">Authorized Leave · Verified by Warden R. Sharma</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-secondary text-[18px]">verified_user</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('attendance-history')}
            className="pt-1 font-label-sm text-label-sm text-primary font-semibold hover:underline flex items-center justify-center gap-1 cursor-pointer"
          >
            <span>View Attendance History</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>

        {/* Push Reminders Card */}
        <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-secondary-container flex items-center justify-center text-primary-container shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[20px]">notifications_active</span>
            </div>
            <div className="flex flex-col">
              <span className="font-title-sm text-title-sm font-bold text-on-surface">Push Reminders</span>
              <p className="font-body-sm text-body-sm text-secondary">
                Receive notifications before 10 PM and midnight curfew.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('location-setup')}
            className="px-3.5 py-1.5 rounded-lg bg-primary-container text-on-primary font-label-sm font-semibold hover:bg-primary transition-colors cursor-pointer shrink-0"
          >
            Configure
          </button>
        </div>
      </main>

      {/* Extension Modal Dialog */}
      {showExtensionModal && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl max-w-sm w-full p-4 shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">more_time</span>
                <span className="font-title-md font-bold text-on-surface">Request Curfew Extension</span>
              </div>
              <button
                type="button"
                onClick={() => setShowExtensionModal(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-secondary hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <form onSubmit={submitExtension} className="flex flex-col gap-3">
              <div>
                <label className="font-label-sm text-secondary block mb-1">Additional Time Requested</label>
                <div className="grid grid-cols-3 gap-2">
                  {[30, 45, 60].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setExtensionMinutes(m)}
                      className={`py-1.5 rounded-lg font-label-sm font-semibold transition-all ${
                        extensionMinutes === m
                          ? 'bg-primary-container text-on-primary shadow-xs'
                          : 'bg-surface-container text-secondary hover:text-on-surface'
                      }`}
                    >
                      +{m} mins
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="font-label-sm text-secondary block mb-1">Academic / Personal Reason</label>
                <textarea
                  rows={2}
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  className="w-full p-2 bg-surface-container-low rounded-lg text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <p className="font-label-xs text-secondary">
                Warden approval extends your cutoff time to {extensionMinutes === 30 ? '12:30 AM' : extensionMinutes === 45 ? '12:45 AM' : '01:00 AM'}.
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowExtensionModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-surface-container text-secondary hover:text-on-surface font-label-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={extensionSubmitted}
                  className="px-4 py-1.5 rounded-lg bg-primary-container text-on-primary font-label-sm font-semibold hover:bg-primary transition-all"
                >
                  {extensionSubmitted ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 w-full z-40 pb-safe bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_-1px_12px_rgba(15,23,42,0.05)] border-t border-outline-variant/30">
        <div className="flex items-center justify-around h-16 max-w-md mx-auto px-1">
          <button
            type="button"
            className="flex flex-col items-center justify-center gap-1 w-16 h-12 text-primary-container font-medium"
          >
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              dashboard
            </span>
            <span className="font-label-xs text-label-xs">Dashboard</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('attendance-history')}
            className="flex flex-col items-center justify-center gap-1 w-16 h-12 text-secondary hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">how_to_reg</span>
            <span className="font-label-xs text-label-xs">Attendance</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('location-setup')}
            className="flex flex-col items-center justify-center gap-1 w-16 h-12 text-secondary hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            <span className="font-label-xs text-label-xs">Alerts</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('terms-privacy')}
            className="flex flex-col items-center justify-center gap-1 w-16 h-12 text-secondary hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">account_circle</span>
            <span className="font-label-xs text-label-xs">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
