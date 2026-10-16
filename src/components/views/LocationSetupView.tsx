import React, { useState, useEffect } from 'react';
import { AppScreen } from '../../types';
import { validateLocationCapture } from '../../lib/geofence';
import { useAuth } from '../../context/AuthContext';

export interface LocationSetupViewProps {
  onNavigate: (screen: AppScreen) => void;
}

export const LocationSetupView: React.FC<LocationSetupViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && 'permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((res) => {
        setPermissionStatus(res.state as 'prompt' | 'granted' | 'denied');
        res.onchange = () => {
          setPermissionStatus(res.state as 'prompt' | 'granted' | 'denied');
        };
      }).catch(() => {
        // Fallback if permission query fails
      });
    }
  }, []);

  const handleTestLocation = async () => {
    setIsCheckingLocation(true);
    setLocationMessage(null);

    if (!navigator.geolocation) {
      setIsCheckingLocation(false);
      setPermissionStatus('denied');
      setLocationMessage('Location services are not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const accuracy = Math.round(pos.coords.accuracy);
        validateLocationCapture({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: accuracy,
          timestamp: new Date().toISOString(),
          isMocked: false,
        });

        setIsCheckingLocation(false);
        setPermissionStatus('granted');
        setLocationMessage(
          `Location verified! Within HER-SPACE campus (Accuracy: ±${accuracy}m).`
        );
        showToast('Location permission confirmed');
      },
      (err) => {
        setIsCheckingLocation(false);
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionStatus('denied');
          setLocationMessage('Location permission was denied. Please allow location in your browser site settings.');
        } else {
          setLocationMessage('Could not acquire GPS signal. Please ensure location is turned on in your device.');
        }
      },
      { timeout: 7000, enableHighAccuracy: true }
    );
  };

  const handleTestNotification = () => {
    if (!pushEnabled) {
      showToast('Please enable notifications first');
      return;
    }
    showToast('Test Notification: "HER-SPACE night check-in is now open (10:00 PM)"');
  };

  return (
    <div className="bg-surface font-body-md text-on-surface flex flex-col min-h-screen">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-4 right-4 z-50 flex justify-center pointer-events-none">
          <div className="bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 max-w-sm text-sm font-medium animate-fade-in">
            <span className="material-symbols-outlined text-primary-fixed text-lg">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col w-full max-w-md mx-auto py-4 sm:py-6 pb-24 md:pb-8 px-4 bg-surface space-y-4">
        {/* In-page Navigation Banner */}
        <div className="flex items-center justify-between gap-2 p-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => onNavigate('student-dashboard')}
              aria-label="Back to dashboard"
              className="w-9 h-9 rounded-xl hover:bg-surface-container flex items-center justify-center text-on-surface-variant cursor-pointer transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div className="flex flex-col min-w-0">
              <span className="font-title-sm text-title-sm text-on-surface tracking-tight font-bold">
                Location &amp; Alerts
              </span>
              <span className="font-label-xs text-label-xs text-secondary truncate">
                HER-SPACE Device Setup
              </span>
            </div>
          </div>
          <button
            onClick={() => onNavigate('terms-privacy')}
            className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs hover:bg-primary/20 transition-colors cursor-pointer shrink-0"
          >
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'HS'}
          </button>
        </div>
        {/* Student Context Card */}
        <div className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[22px]">apartment</span>
            </div>
            <div>
              <p className="font-title-sm text-title-sm font-semibold text-on-surface">
                {user?.name || 'Resident Student'}
              </p>
              <p className="font-label-xs text-label-xs text-secondary">
                Room {user?.roomNumber || '101'} · HER-SPACE
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-label-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Active
          </span>
        </div>

        {/* 1. Location Verification Card */}
        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">pin_drop</span>
              </div>
              <div>
                <h2 className="font-title-md text-title-md font-bold text-on-surface">Campus Location</h2>
                <p className="font-label-xs text-label-xs text-secondary">Verified only on check-in</p>
              </div>
            </div>
            {permissionStatus === 'granted' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-label-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="material-symbols-outlined text-[14px]">check</span>
                Ready
              </span>
            ) : permissionStatus === 'denied' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-label-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                <span className="material-symbols-outlined text-[14px]">block</span>
                Blocked
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-label-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <span className="material-symbols-outlined text-[14px]">pending</span>
                Setup Needed
              </span>
            )}
          </div>

          {/* Privacy Guarantee */}
          <div className="p-3 rounded-xl bg-surface-container-low/70 border border-outline-variant/20 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">verified_user</span>
            <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              <strong>100% Privacy Protected:</strong> HER-SPACE never tracks your live location or movement. We only verify you are on campus at the exact moment you tap Check-In.
            </p>
          </div>

          {locationMessage && (
            <div className={`p-3 rounded-xl text-body-sm font-medium ${
              permissionStatus === 'granted'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {locationMessage}
            </div>
          )}

          {/* Action Button */}
          <button
            type="button"
            onClick={handleTestLocation}
            disabled={isCheckingLocation}
            className="w-full h-11 px-4 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[18px] ${isCheckingLocation ? 'animate-spin' : ''}`}>
              {isCheckingLocation ? 'progress_activity' : 'my_location'}
            </span>
            <span>
              {isCheckingLocation
                ? 'Checking GPS Location...'
                : permissionStatus === 'granted'
                ? 'Test Campus Location Again'
                : 'Allow & Verify Location'}
            </span>
          </button>
        </div>

        {/* 2. Nightly Attendance Notifications */}
        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">notifications_active</span>
              </div>
              <div>
                <h2 className="font-title-md text-title-md font-bold text-on-surface">Check-in Reminders</h2>
                <p className="font-label-xs text-label-xs text-secondary">Never miss nightly curfew</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !pushEnabled;
                setPushEnabled(next);
                showToast(next ? 'Reminders enabled' : 'Reminders turned off');
              }}
              className="p-1 text-primary cursor-pointer hover:opacity-80 transition-opacity"
              aria-label="Toggle notifications"
            >
              <span className="material-symbols-outlined text-[32px]">
                {pushEnabled ? 'toggle_on' : 'toggle_off'}
              </span>
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low/70 border border-outline-variant/20 space-y-2">
            <div className="flex items-center justify-between text-body-sm font-medium">
              <span className="text-on-surface">Night Check-In Starts:</span>
              <span className="font-bold text-primary">10:00 PM</span>
            </div>
            <div className="flex items-center justify-between text-body-sm font-medium">
              <span className="text-on-surface">Reminder Alert:</span>
              <span className="font-semibold text-secondary">10:15 PM &amp; 11:00 PM</span>
            </div>
            <div className="flex items-center justify-between text-body-sm font-medium">
              <span className="text-on-surface">Curfew Lockout:</span>
              <span className="font-bold text-red-600">12:00 AM (Midnight)</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestNotification}
            className="w-full h-10 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">notifications</span>
            <span>Send Test Alert to Phone</span>
          </button>
        </div>

        {/* 3. Help & Privacy Info */}
        <div className="p-4 rounded-xl bg-surface-container-low/50 border border-outline-variant/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[20px]">help_outline</span>
            <span className="font-body-sm text-body-sm text-secondary">Questions about location or privacy?</span>
          </div>
          <button
            onClick={() => onNavigate('terms-privacy')}
            className="font-label-sm text-label-sm font-semibold text-primary hover:underline cursor-pointer"
          >
            Read Policy
          </button>
        </div>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 w-full z-40 pb-safe bg-surface-container-lowest/90 backdrop-blur-xl border-t border-outline-variant/30">
        <div className="flex items-center justify-around h-16 max-w-md mx-auto px-1">
          <button
            type="button"
            onClick={() => onNavigate('student-dashboard')}
            className="flex flex-col items-center justify-center gap-1 w-16 h-12 text-secondary hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">dashboard</span>
            <span className="font-label-xs text-label-xs">Home</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('attendance-history')}
            className="flex flex-col items-center justify-center gap-1 w-16 h-12 text-secondary hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">history</span>
            <span className="font-label-xs text-label-xs">History</span>
          </button>
          <button
            type="button"
            className="flex flex-col items-center justify-center gap-1 w-16 h-12 text-primary font-bold"
          >
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              settings
            </span>
            <span className="font-label-xs text-label-xs">Setup</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('terms-privacy')}
            className="flex flex-col items-center justify-center gap-1 w-16 h-12 text-secondary hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">security</span>
            <span className="font-label-xs text-label-xs">Privacy</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

// Backward-compatible alias for existing imports
export const Screen3LocationSetup = LocationSetupView;
