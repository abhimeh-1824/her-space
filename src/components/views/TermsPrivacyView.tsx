import React, { useState, useEffect } from 'react';
import { AppScreen, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { subscribeToWardens } from '../../lib/db-seed';

export interface TermsPrivacyViewProps {
  onNavigate: (screen: AppScreen) => void;
  onLogout?: () => void;
  initialRole?: UserRole;
}

type TabKey = 'curfew' | 'privacy' | 'contacts';

export const TermsPrivacyView: React.FC<TermsPrivacyViewProps> = ({
  onNavigate,
  initialRole = 'student',
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('curfew');
  const [wardens, setWardens] = useState<{ id: string; name: string; email: string; phone?: string }[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToWardens((liveWardens) => {
      setWardens(liveWardens);
    });
    return () => unsub();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const isWarden = user?.role === 'warden' || user?.role === 'super_admin' || initialRole === 'warden';

  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface flex flex-col">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 flex pointer-events-none">
          <div className="bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-fade-in">
            <span className="material-symbols-outlined text-primary-fixed text-lg">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full p-3 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 pb-24 md:pb-8">
        {/* In-page Navigation Banner */}
        <div className="flex items-center justify-between gap-3 p-3 sm:p-4 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate(isWarden ? 'warden-dashboard' : 'student-dashboard')}
              className="p-1.5 rounded-xl hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1.5 text-xs sm:text-sm font-semibold cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              <span>Back</span>
            </button>
            <div className="h-4 w-px bg-outline-variant/40 hidden sm:block"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold text-xs shrink-0">
                <span className="material-symbols-outlined text-[18px]">policy</span>
              </div>
              <div>
                <h1 className="font-title-sm text-sm sm:text-base font-bold text-on-surface leading-tight">HER-SPACE Hostel Rules &amp; Privacy</h1>
                <p className="font-label-xs text-[11px] text-secondary hidden sm:block">
                  Resident safety, night roll-call policy, and data governance
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* Banner */}
        <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-label-xs font-semibold mb-2">
              <span className="material-symbols-outlined text-[14px]">verified</span>
              <span>Official Charter 2026</span>
            </div>
            <h2 className="font-headline-md font-bold text-on-surface">HER-SPACE Resident Guidelines</h2>
            <p className="font-body-sm text-secondary mt-1">
              Clear rules designed for resident safety, privacy, and smooth campus living.
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-outline-variant/30 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('curfew')}
            className={`px-4 py-2 rounded-xl font-label-md font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'curfew'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-secondary hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">bedtime</span>
            <span>Curfew &amp; Roll-Call</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`px-4 py-2 rounded-xl font-label-md font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'privacy'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-secondary hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">lock</span>
            <span>Location &amp; Privacy</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('contacts')}
            className={`px-4 py-2 rounded-xl font-label-md font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'contacts'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-secondary hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">support_agent</span>
            <span>Helpline &amp; Wardens</span>
          </button>
        </div>

        {/* Tab 1: Curfew & Roll-Call */}
        {activeTab === 'curfew' && (
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-xs space-y-4">
            <h3 className="font-title-lg font-bold text-on-surface">Night Curfew &amp; Attendance Rules</h3>
            <div className="space-y-3 font-body-sm text-on-surface-variant">
              <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5">schedule</span>
                <div>
                  <strong className="text-on-surface">Night Attendance Window:</strong> Check-in opens nightly at 10:00 PM and closes strictly at 12:00 AM (Midnight). All students inside HER-SPACE must confirm their presence via the app or during warden floor sweeps.
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5">more_time</span>
                <div>
                  <strong className="text-on-surface">Curfew Extensions:</strong> If you are delayed in the university library or lab, you may request an extension of up to 60 minutes before 11:30 PM. The duty warden reviews and approves requests in real-time.
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5">assignment_turned_in</span>
                <div>
                  <strong className="text-on-surface">Out-Pass &amp; Leave:</strong> Overnight stays outside the hostel require an approved Out-Pass from the warden. While on an approved out-pass, you will not receive night check-in reminders.
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5">group</span>
                <div>
                  <strong className="text-on-surface">Visitor Policy:</strong> Outside guests and non-residents are not permitted inside resident wings after 8:00 PM. Common study halls remain accessible until 10:00 PM.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Location & Privacy */}
        {activeTab === 'privacy' && (
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-xs space-y-4">
            <h3 className="font-title-lg font-bold text-on-surface">Student Privacy &amp; Data Protection</h3>
            <div className="space-y-3 font-body-sm text-on-surface-variant">
              <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-start gap-3">
                <span className="material-symbols-outlined text-emerald-600 text-[20px] shrink-0 mt-0.5">verified_user</span>
                <div>
                  <strong className="text-on-surface">Zero Continuous Tracking:</strong> HER-SPACE never runs GPS in the background. We never track your movement, routes, or daily whereabouts.
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-start gap-3">
                <span className="material-symbols-outlined text-emerald-600 text-[20px] shrink-0 mt-0.5">my_location</span>
                <div>
                  <strong className="text-on-surface">One-Time Snapshot at Check-In:</strong> When you press "Confirm I'm In HER-SPACE", your browser checks whether you are within the hostel radius (150m). Only the confirmation stamp and radius fix are recorded.
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-start gap-3">
                <span className="material-symbols-outlined text-emerald-600 text-[20px] shrink-0 mt-0.5">security</span>
                <div>
                  <strong className="text-on-surface">Confidential &amp; Encrypted:</strong> Attendance records are strictly encrypted in Cloud Firestore. Only authorized wardens assigned to your hostel wing have access to roll-call logs.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Helpline & Wardens */}
        {activeTab === 'contacts' && (
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-xs space-y-6">
            <div>
              <h3 className="font-title-lg font-bold text-on-surface">Official Helpline &amp; Emergency Support</h3>
              <p className="text-xs text-secondary mt-0.5">24/7 dedicated helpline for night roll-call assistance and student safety.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex items-center gap-2 text-primary">
                  <span className="material-symbols-outlined text-2xl">call</span>
                  <span className="font-bold text-sm">Official Helpline Number</span>
                </div>
                <p className="text-xs text-secondary">Direct emergency line for check-in issues, late gate entry, and urgent support.</p>
                <div className="pt-1">
                  <a
                    href="tel:6267549800"
                    className="text-xl sm:text-2xl font-mono font-bold text-primary hover:underline inline-flex items-center gap-2"
                  >
                    <span>6267549800</span>
                    <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-primary/10 text-primary">Tap to Call</span>
                  </a>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200/60 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800">
                  <span className="material-symbols-outlined text-2xl">verified_user</span>
                  <span className="font-bold text-sm">Night Attendance &amp; Security Desk</span>
                </div>
                <p className="text-xs text-emerald-900/80">Active roll-call support during 10:00 PM – Midnight curfew window.</p>
                <div className="pt-1">
                  <a
                    href="tel:6267549800"
                    className="text-xl sm:text-2xl font-mono font-bold text-emerald-800 hover:underline inline-flex items-center gap-2"
                  >
                    <span>6267549800</span>
                    <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">24/7 Available</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Real Registered Wardens from Database */}
            <div className="pt-2 border-t border-outline-variant/20">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-title-sm font-bold text-on-surface">Registered Hostel Wardens</h4>
                <span className="text-xs text-secondary">Live directory from system records</span>
              </div>

              {wardens.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-surface-container-low border border-dashed border-outline-variant/40 space-y-1">
                  <p className="text-xs font-semibold text-on-surface">No wardens registered in the database yet</p>
                  <p className="text-[11px] text-secondary">
                    Administrators can register wardens via the Wardens section. For immediate help, call Helpline{' '}
                    <a href="tel:6267549800" className="font-bold text-primary underline">6267549800</a>.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {wardens.map((w) => (
                    <div key={w.id} className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-on-surface text-sm">{w.name}</p>
                        <span className="text-[10px] uppercase font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                          Duty Warden
                        </span>
                      </div>
                      <p className="text-xs text-secondary font-mono truncate">{w.email}</p>
                      <div className="pt-1 flex items-center justify-between text-xs">
                        <span className="text-secondary">Contact:</span>
                        <a
                          href={`tel:${w.phone || '6267549800'}`}
                          className="font-bold text-primary hover:underline font-mono"
                        >
                          {w.phone || '6267549800'}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// Backward-compatible alias for existing imports
export const Screen9TermsPrivacy = TermsPrivacyView;
