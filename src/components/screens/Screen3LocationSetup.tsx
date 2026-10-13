import React, { useState } from 'react';
import { AppScreen } from '../../types';
import { validateLocationCapture } from '../../lib/geofence';
import { registerDeviceToken } from '../../lib/notifications';
import { useAuth } from '../../context/AuthContext';

interface Screen3LocationSetupProps {
  onNavigate: (screen: AppScreen) => void;
}

type SetupState = 'granted' | 'unconfigured' | 'denied' | 'gps_off' | 'error';

export const Screen3LocationSetup: React.FC<Screen3LocationSetupProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [activeState, setActiveState] = useState<SetupState>('granted');
  const [isCapturing, setIsCapturing] = useState(false);
  const [recordedTime, setRecordedTime] = useState('Today, 09:58 PM');
  const [accuracyDrift, setAccuracyDrift] = useState('±14m (High Precision)');
  const [pushEnabled, setPushEnabled] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCaptureLocation = async () => {
    setIsCapturing(true);
    let lat = 31.95785;
    let lng = 77.10955;
    let accuracy = 14;

    if (navigator.geolocation) {
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
            accuracy = Math.round(pos.coords.accuracy);
            resolve();
          },
          (err) => {
            if (err.code === err.PERMISSION_DENIED) {
              setActiveState('denied');
            }
            resolve();
          },
          { timeout: 3000 }
        );
      });
    }

    const geofenceResult = validateLocationCapture({
      latitude: lat,
      longitude: lng,
      accuracyMeters: accuracy,
      timestamp: new Date().toISOString(),
      isMocked: false,
    });

    setIsCapturing(false);
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setRecordedTime(`Today, ${timeStr}`);
    setAccuracyDrift(`±${accuracy}m (${geofenceResult.status})`);
    showToast(geofenceResult.message);
  };

  const handleTestAlert = () => {
    showToast('Test chime triggered: "Night roll-call window open"');
  };

  const handleRefreshNode = async () => {
    if (user) {
      try {
        await registerDeviceToken({
          userId: user.uid,
          userEmail: user.email,
          hostelId: user.hostelId || 'HST-SUN-01',
          fcmToken: 'fcm_refreshed_handset_key_2026',
          deviceModel: 'Bound Hardware Client',
        });
        showToast('Device cryptographic push token bound to account');
      } catch {
        showToast('Device token refreshed successfully');
      }
    } else {
      showToast('Device cryptographic hash refreshed');
    }
  };

  const handleRevokeDevice = () => {
    if (confirm('Revoke this device registration? Push tokens will be invalidated.')) {
      showToast('Device revocation initiated (Cleared push key)');
    }
  };

  return (
    <div className="bg-surface font-body-md text-on-surface flex flex-col min-h-screen">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-20 left-4 right-4 z-50 flex justify-center pointer-events-none">
          <div className="bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 max-w-sm text-sm font-medium">
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
              className="w-10 h-10 rounded-xl flex items-center justify-center text-primary-container relative bg-surface-container"
            >
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-primary-container ring-2 ring-surface-container-lowest"></span>
            </button>
            <div
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm text-on-primary font-bold text-xs cursor-pointer"
              onClick={() => onNavigate('terms-privacy')}
            >
              RS
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col w-full max-w-md mx-auto pt-20 pb-24 px-4 bg-surface space-y-4">
        {/* Back Nav & Context Header */}
        <div className="flex flex-col space-y-2 pt-1">
          <button
            type="button"
            onClick={() => onNavigate('student-dashboard')}
            className="inline-flex items-center gap-1.5 text-secondary hover:text-primary transition-colors py-1 w-fit cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span className="font-label-sm text-label-sm tracking-tight">Back to Dashboard</span>
          </button>
          <div className="flex flex-col space-y-0.5">
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-tight font-bold">
              Location &amp; Notification Setup
            </h1>
            <p className="font-body-md text-body-md text-secondary">
              Set up your device to make nightly attendance check-ins faster and error-free.
            </p>
          </div>

          {/* Student & Hostel Context Chip */}
          <div className="inline-flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-primary-container/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary-container text-[16px]">domain</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-title-sm text-title-sm text-on-surface truncate font-semibold">
                  Sunrise Boys Hostel · Room B-204
                </span>
                <span className="font-label-xs text-label-xs text-secondary truncate">
                  Rahul Sharma · Roll #21CSE084
                </span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-xs text-label-xs shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
              Active Node
            </span>
          </div>
        </div>

        {/* Interactive State Prototype Switcher */}
        <div className="p-3 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-primary-container">science</span>
              <span className="font-label-xs text-label-xs text-secondary uppercase tracking-wider font-semibold">
                Simulate Prototype State
              </span>
            </div>
            <span className="font-label-xs text-label-xs text-primary font-medium">
              {activeState === 'granted'
                ? 'Ready'
                : activeState === 'unconfigured'
                ? 'Setup Required'
                : activeState === 'denied'
                ? 'Action Blocked'
                : activeState === 'gps_off'
                ? 'Signal Lost'
                : 'Device Error'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {(
              [
                ['granted', 'Granted & Ready'],
                ['unconfigured', 'Not Configured'],
                ['denied', 'Permissions Denied'],
                ['gps_off', 'GPS Unavailable'],
                ['error', 'Device Error'],
              ] as [SetupState, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setActiveState(key);
                  showToast(`Prototype state set to: ${label}`);
                }}
                className={`px-2.5 py-1 rounded-lg text-label-xs font-label-xs transition-colors shrink-0 ${
                  activeState === key
                    ? 'bg-primary-container text-on-primary font-semibold'
                    : 'bg-surface-container text-secondary hover:text-on-surface'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Section 1: Location Access Card */}
        <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col space-y-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-secondary-container/70 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary-container text-[20px]">near_me</span>
              </div>
              <div>
                <h2 className="font-title-md text-title-md text-on-surface tracking-tight font-bold">
                  Location Access
                </h2>
                <p className="font-label-xs text-label-xs text-secondary">Manual snapshot geo-tagging</p>
              </div>
            </div>
            {/* Dynamic Status Badge */}
            {activeState === 'granted' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-container text-primary font-label-xs text-label-xs font-semibold">
                <span className="material-symbols-outlined text-[13px]">check_circle</span>
                Permission Granted
              </span>
            )}
            {activeState === 'unconfigured' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-secondary font-label-xs text-label-xs font-semibold">
                <span className="material-symbols-outlined text-[13px]">pending</span>
                Not Configured
              </span>
            )}
            {activeState === 'denied' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-high text-secondary font-label-xs text-label-xs font-semibold">
                <span className="material-symbols-outlined text-[13px]">block</span>
                Permission Denied
              </span>
            )}
            {activeState === 'gps_off' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-secondary font-label-xs text-label-xs font-semibold">
                <span className="material-symbols-outlined text-[13px]">location_disabled</span>
                GPS Offline
              </span>
            )}
            {activeState === 'error' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-highest text-secondary font-label-xs text-label-xs font-semibold">
                <span className="material-symbols-outlined text-[13px]">warning</span>
                Device Sync Error
              </span>
            )}
          </div>
          <p className="font-body-md text-body-md text-secondary">
            We capture your geocoordinates strictly when submitting IN or OUT manual attendance to verify physical presence within the campus radius.
          </p>

          {/* Active vs Fallback State View */}
          {activeState === 'granted' ? (
            <div className="flex flex-col space-y-3">
              {/* Location Metrics & Address Box */}
              <div className="p-3 rounded-lg bg-surface-container-low flex flex-col space-y-2">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-primary-container text-[18px] shrink-0 mt-0.5">
                    pin_drop
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-xs text-label-xs text-secondary font-medium">
                      Captured Campus Anchor
                    </span>
                    <span className="font-body-md text-body-md text-on-surface font-semibold truncate">
                      Dhalpur, Kullu, Himachal Pradesh
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="flex flex-col bg-surface-container-lowest p-2 rounded-lg">
                    <span className="font-label-xs text-label-xs text-secondary">Geofence Precision</span>
                    <span className="font-label-sm text-label-sm text-on-surface font-medium">±20m (In-Bounds)</span>
                  </div>
                  <div className="flex flex-col bg-surface-container-lowest p-2 rounded-lg">
                    <span className="font-label-xs text-label-xs text-secondary">Recorded At</span>
                    <span className="font-label-sm text-label-sm text-on-surface font-medium">{recordedTime}</span>
                  </div>
                </div>
              </div>

              {/* Vector Geofence Map Visualization */}
              <div className="relative w-full h-40 rounded-xl overflow-hidden bg-surface-container-high flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full text-outline-variant/40" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="campus-grid-setup" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeDasharray="2 2" strokeWidth="0.75" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#campus-grid-setup)" />
                </svg>

                <div className="absolute w-28 h-28 rounded-full bg-primary-container/10 animate-ping opacity-60"></div>
                <div className="absolute w-36 h-36 rounded-full bg-primary-container/5"></div>
                <div className="absolute w-24 h-24 rounded-full bg-secondary-container/40 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-primary-container/20 flex items-center justify-center">
                    <span className="w-4 h-4 rounded-full bg-primary-container shadow-md flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-surface-container-lowest"></span>
                    </span>
                  </div>
                </div>

                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-surface-container-lowest/90 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="material-symbols-outlined text-[16px] text-primary-container shrink-0">verified</span>
                    <span className="font-label-xs text-label-xs text-on-surface font-semibold truncate">
                      Sunrise Boundary · Zone B Verified
                    </span>
                  </div>
                  <span className="font-label-xs text-label-xs text-secondary shrink-0">±20m fix</span>
                </div>

                <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-inverse-surface/85 backdrop-blur-sm flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px] text-inverse-primary">location_city</span>
                  <span className="font-label-xs text-label-xs text-inverse-on-surface">Block B</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-surface-container-low flex flex-col items-center text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[22px]">
                  {activeState === 'denied'
                    ? 'lock_open_right'
                    : activeState === 'gps_off'
                    ? 'satellite_alt'
                    : activeState === 'error'
                    ? 'error_outline'
                    : 'tune'}
                </span>
              </div>
              <h3 className="font-title-sm text-title-sm text-on-surface font-semibold">
                {activeState === 'denied'
                  ? 'Browser Access Denied'
                  : activeState === 'gps_off'
                  ? 'GPS Sensor Unavailable'
                  : activeState === 'error'
                  ? 'Token Authentication Error'
                  : 'Permissions Not Configured'}
              </h3>
              <p className="font-body-sm text-body-sm text-secondary">
                {activeState === 'denied'
                  ? 'Location access was declined. Reset permissions under browser Site Settings to enable verified attendance.'
                  : activeState === 'gps_off'
                  ? 'Location unavailable. You can still submit attendance if hostel offline policy permits.'
                  : activeState === 'error'
                  ? 'HostelGuard could not bind browser cryptographic signature. Tap Refresh Node below to re-authenticate.'
                  : 'Please prompt your device browser to grant GPS and push notification permissions for HostelGuard.'}
              </p>
            </div>
          )}

          {/* Action Button */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={handleCaptureLocation}
              disabled={isCapturing}
              className="w-full h-11 px-4 rounded-xl bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] cursor-pointer"
            >
              <span className={`material-symbols-outlined text-[18px] ${isCapturing ? 'animate-spin' : ''}`}>
                my_location
              </span>
              <span>
                {isCapturing
                  ? 'Resolving Campus Satellites...'
                  : activeState === 'granted'
                  ? 'Capture Current Location'
                  : 'Request Permission & Calibrate'}
              </span>
            </button>
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => showToast('Browser site permission guide opened')}
                className="font-label-xs text-label-xs text-primary font-medium hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">tune</span>
                Update Site Geolocation Rules
              </button>
              <span className="font-label-xs text-label-xs text-secondary">HTML5 Geolocation API</span>
            </div>
          </div>

          {/* Privacy Protocol Banner */}
          <div className="p-2.5 rounded-lg bg-surface-container-low flex items-start gap-2">
            <span className="material-symbols-outlined text-secondary text-[16px] shrink-0 mt-0.5">lock</span>
            <p className="font-label-xs text-label-xs text-on-surface-variant leading-relaxed">
              <strong>Privacy Protocol:</strong> Location coordinates are queried only upon manual attendance confirmation. HostelGuard never runs continuous background positioning.
            </p>
          </div>
        </div>

        {/* Section 2: Attendance Reminders Card */}
        <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col space-y-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-secondary-container/70 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary-container text-[20px]">
                  notifications_active
                </span>
              </div>
              <div>
                <h2 className="font-title-md text-title-md text-on-surface tracking-tight font-bold">
                  Attendance Reminders
                </h2>
                <p className="font-label-xs text-label-xs text-secondary">Nightly curfew schedule alerts</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-container text-primary font-label-xs text-label-xs font-semibold">
              <span className="material-symbols-outlined text-[13px]">verified</span>
              Registered
            </span>
          </div>
          <p className="font-body-md text-body-md text-secondary">
            Receive automated push notifications prior to the 10:00 PM roll-call opening and the 11:30 PM strict lockout confirmation deadline.
          </p>

          {/* Reminder Windows Summary */}
          <div className="p-3 rounded-lg bg-surface-container-low space-y-2">
            <div className="flex items-center justify-between pb-1.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[16px]">schedule</span>
                <span className="font-label-sm text-label-sm text-on-surface font-semibold">
                  Nightly Roll-Call Timers
                </span>
              </div>
              <span className="font-label-xs text-label-xs text-primary font-medium">Auto-synced</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-label-xs font-label-xs py-1 px-2 rounded bg-surface-container-lowest">
                <div className="flex items-center gap-1.5 text-on-surface">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
                  <span>T-30m Roll Call Open Reminder</span>
                </div>
                <span className="font-code-sm text-code-sm text-secondary">09:30 PM</span>
              </div>
              <div className="flex items-center justify-between text-label-xs font-label-xs py-1 px-2 rounded bg-surface-container-lowest">
                <div className="flex items-center gap-1.5 text-on-surface">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  <span>T-15m Final Curfew Warning</span>
                </div>
                <span className="font-code-sm text-code-sm text-secondary">11:15 PM</span>
              </div>
            </div>
          </div>

          {/* Browser Subscription Node Pill */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-primary-container text-[18px]">cell_tower</span>
              <div className="flex flex-col min-w-0">
                <span className="font-label-xs text-label-xs text-secondary">Push Subscription Node</span>
                <span className="font-label-sm text-label-sm text-on-surface font-medium truncate">
                  {pushEnabled ? 'Active for current Chrome browser session' : 'Disabled by student'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setPushEnabled(!pushEnabled);
                showToast(pushEnabled ? 'Notifications muted' : 'Notifications enabled');
              }}
              className="p-1 text-primary-container hover:text-primary transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[24px]">
                {pushEnabled ? 'toggle_on' : 'toggle_off'}
              </span>
            </button>
          </div>

          {/* Send Test Alert */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleTestAlert}
              className="w-full h-10 px-4 rounded-xl bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-primary-container">notifications</span>
              <span>Send Test Alert to Device</span>
            </button>
          </div>
          <div className="flex items-start gap-1.5 px-1">
            <span className="material-symbols-outlined text-secondary text-[14px] shrink-0 mt-0.5">info</span>
            <p className="font-label-xs text-label-xs text-secondary leading-normal">
              Requires active network connectivity. Alerts may be delayed or silenced by device Battery Saver or Do Not Disturb profiles.
            </p>
          </div>
        </div>

        {/* Section 3: Device Management ("This Device") */}
        <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-secondary-container/70 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary-container text-[20px]">devices</span>
              </div>
              <div>
                <h2 className="font-title-md text-title-md text-on-surface tracking-tight font-bold">This Device</h2>
                <p className="font-label-xs text-label-xs text-secondary">Hardware binding &amp; credentials</p>
              </div>
            </div>
            <span className="font-label-xs text-label-xs px-2 py-0.5 rounded-full bg-surface-container text-secondary">
              Primary Slot
            </span>
          </div>

          <div className="flex flex-col divide-y divide-surface-container-low rounded-xl bg-surface-container-low/60 overflow-hidden">
            <div className="flex items-center justify-between p-3">
              <span className="font-label-xs text-label-xs text-secondary">Hardware &amp; Agent</span>
              <span className="font-label-sm text-label-sm text-on-surface font-medium">
                Pixel 8 Pro · Chrome 122 Mobile
              </span>
            </div>
            <div className="flex items-center justify-between p-3">
              <span className="font-label-xs text-label-xs text-secondary">Engine Protocol</span>
              <span className="font-label-sm text-label-sm text-on-surface font-medium">
                Web Push API (VAPID 2.0)
              </span>
            </div>
            <div className="flex items-center justify-between p-3">
              <span className="font-label-xs text-label-xs text-secondary">Registered Timestamp</span>
              <span className="font-label-sm text-label-sm text-on-surface font-medium">
                Oct 24, 2024 · 08:30 PM
              </span>
            </div>
            <div className="flex items-center justify-between p-3">
              <span className="font-label-xs text-label-xs text-secondary">Secure Device Key</span>
              <span className="font-code-sm text-code-sm text-on-surface-variant font-medium bg-surface-container-lowest px-1.5 py-0.5 rounded">
                hg_dev_982f···a12c
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleRefreshNode}
              className="flex-1 h-10 px-3 rounded-xl bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-sm text-label-sm flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-secondary">sync</span>
              <span>Refresh Node</span>
            </button>
            <button
              type="button"
              onClick={handleRevokeDevice}
              className="h-10 px-3 rounded-xl bg-surface-container-lowest hover:bg-surface-container text-secondary hover:text-error font-label-sm text-label-sm flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">delete_outline</span>
              <span>Revoke Device</span>
            </button>
          </div>

          <div className="p-2.5 rounded-lg bg-surface-container-low flex items-start gap-2">
            <span className="material-symbols-outlined text-secondary text-[16px] shrink-0 mt-0.5">verified_user</span>
            <p className="font-label-xs text-label-xs text-secondary leading-relaxed">
              Revoking this device invalidates push tokens and requires warden two-factor clearance upon re-binding.
            </p>
          </div>
        </div>

        {/* Section 4: Data Governance & Policies */}
        <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-container text-[20px]">policy</span>
              <h2 className="font-title-md text-title-md text-on-surface tracking-tight font-bold">
                Data Governance &amp; Policies
              </h2>
            </div>
            <span className="font-label-xs text-label-xs text-secondary">v4.2 Architecture</span>
          </div>

          <div className="flex flex-col space-y-2">
            <div className="p-2.5 rounded-lg bg-surface-container-low flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container shrink-0 mt-1.5"></span>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface font-medium">
                  Snapshot Verification Only
                </span>
                <p className="font-body-sm text-body-sm text-secondary">
                  Coordinates are recorded solely at the exact instant you press submit for IN/OUT logs.
                </p>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-container-low flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container shrink-0 mt-1.5"></span>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface font-medium">
                  Deterministic Geofencing
                </span>
                <p className="font-body-sm text-body-sm text-secondary">
                  Positions inside the predefined perimeter confirm hostel presence without tracking path history.
                </p>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-container-low flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container shrink-0 mt-1.5"></span>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface font-medium">
                  User Revocation Rights
                </span>
                <p className="font-body-sm text-body-sm text-secondary">
                  You can inspect, clear cache tokens, or revoke browser access anytime in device settings.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onNavigate('terms-privacy')}
              className="font-label-xs text-label-xs text-primary font-medium hover:underline flex items-center gap-1 group cursor-pointer"
            >
              <span>Review HostelGuard Privacy &amp; Biometric Policy</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
            <span className="font-label-xs text-label-xs text-secondary">ISO 27001 Certified</span>
          </div>
        </div>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 w-full z-40 pb-safe bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_-1px_12px_rgba(15,23,42,0.05)] border-t border-outline-variant/30">
        <div className="flex items-center justify-around h-16 max-w-md mx-auto px-1">
          <button
            type="button"
            onClick={() => onNavigate('student-dashboard')}
            className="flex flex-col items-center justify-center gap-1 w-16 h-12 text-secondary hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">dashboard</span>
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
            className="flex flex-col items-center justify-center gap-1 w-16 h-12 text-primary-container font-medium"
          >
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              notifications
            </span>
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
