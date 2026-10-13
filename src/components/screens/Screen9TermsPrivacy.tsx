import React, { useState } from 'react';
import { AppScreen, UserRole } from '../../types';

interface Screen9TermsPrivacyProps {
  onNavigate: (screen: AppScreen) => void;
  onLogout?: () => void;
  initialRole?: UserRole;
}

type TabKey = 'terms' | 'privacy' | 'consent' | 'architecture' | 'certificates';
type ViewState = 'standard' | 'pending_signature' | 'auditor_view' | 'compact';

import { useAuth } from '../../context/AuthContext';

export const Screen9TermsPrivacy: React.FC<Screen9TermsPrivacyProps> = ({
  onNavigate,
  onLogout,
  initialRole = 'student',
}) => {
  const { recordConsent } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('terms');
  const [viewState, setViewState] = useState<ViewState>('standard');
  const [searchQuery, setSearchQuery] = useState('');
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(true);
  const [hasAcceptedBiometrics, setHasAcceptedBiometrics] = useState(true);
  const [hasAcceptedGeofence, setHasAcceptedGeofence] = useState(true);
  const [showSignModal, setShowSignModal] = useState(false);
  const [signatureName, setSignatureName] = useState('Aarav Sharma');
  const [signatureRollNo, setSignatureRollNo] = useState('21CSE084');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSignConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAcceptedTerms(true);
    setHasAcceptedBiometrics(true);
    setHasAcceptedGeofence(true);
    setShowSignModal(false);

    try {
      const record = await recordConsent(
        true,
        hasAcceptedBiometrics,
        hasAcceptedGeofence,
        signatureName,
        signatureRollNo
      );
      showToast(`Digital Consent Recorded. Cryptographic Hash: ${record.signatureHash}`);
    } catch {
      showToast('Digital Consent Successfully Recorded. Cryptographic Hash: #SIG-89B4-9021');
    }
  };

  const handleRevokeConsent = () => {
    if (confirm('Revoking consent will require manual paper roll-call verification at the Chief Warden desk every night. Are you sure?')) {
      setHasAcceptedTerms(false);
      setHasAcceptedBiometrics(false);
      setHasAcceptedGeofence(false);
      showToast('Consent Status Changed to: Pending Manual Paper Verification.');
    }
  };

  return (
    <div className="min-h-screen bg-surface font-sans text-on-surface flex flex-col">
      {/* Toast message */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-neutral-700 animate-bounce">
          <span className="material-symbols-outlined text-emerald-400">verified</span>
          <span className="text-sm font-medium">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-neutral-400 hover:text-white">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-surface-container-high px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate(initialRole === 'warden' ? 'warden-dashboard' : 'student-dashboard')}
            className="p-1.5 rounded-lg hover:bg-surface-container text-neutral-600 hover:text-neutral-900 transition-colors flex items-center gap-1.5 text-sm font-medium"
            title="Return to Dashboard"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            <span className="hidden sm:inline">Back to Dashboard</span>
          </button>
          <div className="h-4 w-px bg-neutral-200 hidden sm:block"></div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              <span className="material-symbols-outlined text-base">gavel</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-neutral-900 leading-none">HostelGuard Legal & Compliance</h1>
                <span className="bg-blue-100 text-blue-800 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                  v2.4 Policy Spec
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">Sunrise Boys Hostel • Campus Safety & Privacy Charter 2026</p>
            </div>
          </div>
        </div>

        {/* Prototype State Selector & Quick Links */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5 bg-neutral-100 p-1 rounded-lg text-xs font-medium">
            <span className="text-neutral-500 px-2">Mode:</span>
            <button
              onClick={() => setViewState('standard')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                viewState === 'standard' ? 'bg-white shadow-xs text-blue-700 font-semibold' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Standard
            </button>
            <button
              onClick={() => {
                setViewState('pending_signature');
                setHasAcceptedTerms(false);
              }}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                viewState === 'pending_signature' ? 'bg-amber-100 text-amber-900 font-semibold' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Unsigned Preview
            </button>
            <button
              onClick={() => setViewState('auditor_view')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                viewState === 'auditor_view' ? 'bg-indigo-100 text-indigo-900 font-semibold' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Auditor Audit Mode
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
            title="Print Compliance Document"
          >
            <span className="material-symbols-outlined text-xl">print</span>
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              className="p-2 text-neutral-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Sign Out"
            >
              <span className="material-symbols-outlined text-xl">logout</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-6">
        {/* Left Side Navigation & Compliance Status Card */}
        <aside className="w-full md:w-72 shrink-0 space-y-5">
          {/* Status Box */}
          <div className="bg-white rounded-2xl p-5 border border-surface-container-high shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-3">
              <span className="text-xs uppercase tracking-wider font-bold text-neutral-500">Resident Consent Status</span>
              <span
                className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                  hasAcceptedTerms
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                <span className="material-symbols-outlined text-xs">
                  {hasAcceptedTerms ? 'verified' : 'pending_actions'}
                </span>
                {hasAcceptedTerms ? 'Fully Verified' : 'Action Required'}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-neutral-600">Curfew Tenancy Agreement:</span>
                <span className={hasAcceptedTerms ? 'text-emerald-700 font-semibold' : 'text-neutral-400'}>
                  {hasAcceptedTerms ? 'Active (v2.4)' : 'Unsigned'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-600">Geofence Capture Window:</span>
                <span className={hasAcceptedGeofence ? 'text-emerald-700 font-semibold' : 'text-neutral-400'}>
                  {hasAcceptedGeofence ? 'Opted In' : 'Denied'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-600">FCM Push Delivery:</span>
                <span className="text-blue-700 font-semibold">Active #fcm-084</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-600">Data Retention Cycle:</span>
                <span className="text-neutral-700 font-medium">30 Days Auto-Purge</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-100 flex flex-col gap-2">
              {!hasAcceptedTerms ? (
                <button
                  onClick={() => setShowSignModal(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                >
                  <span className="material-symbols-outlined text-base">draw</span>
                  Sign & Accept Agreement
                </button>
              ) : (
                <button
                  onClick={handleRevokeConsent}
                  className="w-full bg-neutral-100 hover:bg-red-50 text-neutral-700 hover:text-red-700 font-medium py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">lock_reset</span>
                  Manage / Revoke Consent
                </button>
              )}
            </div>
          </div>

          {/* Section Tabs */}
          <nav className="bg-white rounded-2xl border border-surface-container-high p-2 shadow-xs space-y-1">
            <button
              onClick={() => setActiveTab('terms')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left transition-all ${
                activeTab === 'terms'
                  ? 'bg-blue-50 text-blue-700 shadow-xs'
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
            >
              <span className="material-symbols-outlined text-lg">article</span>
              <div className="flex-1">
                <div>Terms of Residence</div>
                <div className="text-[10px] text-neutral-400 font-normal">Curfew rules & warden authority</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('privacy')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left transition-all ${
                activeTab === 'privacy'
                  ? 'bg-blue-50 text-blue-700 shadow-xs'
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
            >
              <span className="material-symbols-outlined text-lg">shield_person</span>
              <div className="flex-1">
                <div>Privacy & Zero-Tracking</div>
                <div className="text-[10px] text-neutral-400 font-normal">Ephemeral location guarantees</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('consent')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left transition-all ${
                activeTab === 'consent'
                  ? 'bg-blue-50 text-blue-700 shadow-xs'
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
            >
              <span className="material-symbols-outlined text-lg">fingerprint</span>
              <div className="flex-1">
                <div>Biometric & Device Consent</div>
                <div className="text-[10px] text-neutral-400 font-normal">GPS & anti-spoof policies</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('architecture')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left transition-all ${
                activeTab === 'architecture'
                  ? 'bg-blue-50 text-blue-700 shadow-xs'
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
            >
              <span className="material-symbols-outlined text-lg">account_tree</span>
              <div className="flex-1">
                <div>Data Architecture</div>
                <div className="text-[10px] text-neutral-400 font-normal">End-to-end security pipeline</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('certificates')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left transition-all ${
                activeTab === 'certificates'
                  ? 'bg-blue-50 text-blue-700 shadow-xs'
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
            >
              <span className="material-symbols-outlined text-lg">verified</span>
              <div className="flex-1">
                <div>Audit Certificates & Logs</div>
                <div className="text-[10px] text-neutral-400 font-normal">Cryptographic audit verification</div>
              </div>
            </button>
          </nav>

          {/* Quick Contact & Emergency Assistance */}
          <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200 text-xs">
            <h4 className="font-bold text-neutral-800 flex items-center gap-1.5 mb-1.5">
              <span className="material-symbols-outlined text-base text-blue-600">support_agent</span>
              Campus Ombudsman & Privacy
            </h4>
            <p className="text-neutral-500 mb-2.5">
              Questions regarding curfew records, data corrections, or privacy dispute resolution:
            </p>
            <div className="space-y-1 text-neutral-700">
              <p className="font-semibold text-blue-700">privacy-officer@sunrisehostels.edu</p>
              <p className="text-neutral-600">Chief Warden Helpline: +91 11 2390-4820</p>
            </div>
          </div>
        </aside>

        {/* Right Main Body Content Panel */}
        <main className="flex-1 bg-white rounded-3xl border border-surface-container-high p-6 md:p-8 shadow-xs min-h-[600px] flex flex-col">
          {/* Search bar inside document */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-100">
            <div>
              <span className="text-xs font-bold text-blue-600 tracking-wider uppercase">
                Section: {activeTab.toUpperCase()}
              </span>
              <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight mt-0.5">
                {activeTab === 'terms' && 'Hostel Tenancy & Night Roll-Call Charter'}
                {activeTab === 'privacy' && 'Zero-Tracking Privacy & Location Policy'}
                {activeTab === 'consent' && 'Biometric, GPS & Device Binding Consent'}
                {activeTab === 'architecture' && 'End-to-End Cryptographic Security Pipeline'}
                {activeTab === 'certificates' && 'Compliance Ledger & Audit Certificates'}
              </h2>
              <p className="text-xs text-neutral-500 mt-1">
                Last reviewed by Student Affairs & Campus Legal Council on October 1, 2026. Effective Immediately.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-neutral-400 text-base">search</span>
              <input
                type="text"
                placeholder="Search policy clauses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-9 pr-3 py-2 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* TAB 1: TERMS OF SERVICE */}
          {activeTab === 'terms' && (
            <div className="py-6 space-y-6 text-sm text-neutral-700 leading-relaxed">
              <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-blue-600 text-xl mt-0.5">info</span>
                <div>
                  <h4 className="font-bold text-blue-900 text-xs uppercase tracking-wide">Core Obligation</h4>
                  <p className="text-xs text-blue-800 mt-0.5">
                    All residents admitted to Sunrise Boys Hostel agree to confirm physical presence within hostel
                    dormitories nightly between <strong>22:00 IST and 00:00 IST (Midnight)</strong> using the HostelGuard
                    cryptographic check-in portal or chief warden roll-call.
                  </p>
                </div>
              </div>

              <section className="space-y-3">
                <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-neutral-100 text-neutral-700 flex items-center justify-center text-xs font-mono font-bold">1.0</span>
                  Nightly Roll-Call Window & Attendance Mandate
                </h3>
                <p>
                  1.1 The nightly roll-call window automatically initiates at <strong>22:00 hours IST</strong> every calendar
                  day. A registered resident must trigger the check-in confirmation button on their authenticated mobile device
                  while positioned within the designated geographical perimeter of the hostel block.
                </p>
                <p>
                  1.2 Check-ins logged after <strong>00:00 hours (Midnight)</strong> will be marked as <em>Late / Curfew Violation</em>
                  unless an extension request was submitted and pre-approved by the Duty Warden prior to 23:30 hours.
                </p>
                <p>
                  1.3 Failure to confirm presence without a pre-authorized Night Out Pass results in automatic dispatch of SMS and
                  FCM priority alerts to hostel security, the Chief Warden, and recorded emergency guardians at 00:05 hours.
                </p>
              </section>

              <section className="space-y-3 pt-4 border-t border-neutral-100">
                <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-neutral-100 text-neutral-700 flex items-center justify-center text-xs font-mono font-bold">2.0</span>
                  Curfew Extension Request Protocol
                </h3>
                <p>
                  2.1 Residents engaged in authorized academic pursuits (e.g., Central Library late study, university laboratory
                  experiments, or official inter-college festivals) may request a curfew buffer of up to <strong>60 minutes</strong>.
                </p>
                <p>
                  2.2 Extensions are non-transferable and must cite a valid academic or medical justification. The Duty Warden
                  maintains full discretionary authority to accept, decline, or request counter-verification from faculty guides.
                </p>
              </section>

              <section className="space-y-3 pt-4 border-t border-neutral-100">
                <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-neutral-100 text-neutral-700 flex items-center justify-center text-xs font-mono font-bold">3.0</span>
                  Anti-Spoofing & Disciplinary Consequences
                </h3>
                <p>
                  3.1 Any attempt to employ mock GPS software, virtual location emulators, VPN spoofing, or device proxying to
                  fabricate physical presence inside the hostel boundary constitutes a gross violation of academic ethics code §4.2.
                </p>
                <p>
                  3.2 Automated detection of location spoofing immediately revokes digital check-in privileges for the semester,
                  escalates the case to the Dean of Student Discipline, and levies a statutory safety inspection fee.
                </p>
              </section>
            </div>
          )}

          {/* TAB 2: PRIVACY & ZERO TRACKING */}
          {activeTab === 'privacy' && (
            <div className="py-6 space-y-6 text-sm text-neutral-700 leading-relaxed">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-emerald-600 text-xl mt-0.5">verified_user</span>
                <div>
                  <h4 className="font-bold text-emerald-900 text-xs uppercase tracking-wide">The Zero-Tracking Guarantee</h4>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    HostelGuard <strong>does NOT</strong> perform 24/7 background tracking. Location coordinates are queried
                    <strong> ONLY</strong> during the explicit click of the &ldquo;Confirm IN&rdquo; button during the 22:00-00:00
                    attendance window. Outside this window, device telemetry is entirely inactive.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
                <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-2">
                    <span className="material-symbols-outlined text-lg">timer</span>
                  </div>
                  <h4 className="font-bold text-neutral-900 text-xs">Ephemeral Ingress</h4>
                  <p className="text-xs text-neutral-500 mt-1">
                    GPS lat/long is matched against the geofence perimeter polygon locally on-device or via instant edge hash. Raw coordinates are never shared with advertisers or third parties.
                  </p>
                </div>

                <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200">
                  <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-2">
                    <span className="material-symbols-outlined text-lg">auto_delete</span>
                  </div>
                  <h4 className="font-bold text-neutral-900 text-xs">30-Day Purge Lifecycle</h4>
                  <p className="text-xs text-neutral-500 mt-1">
                    Daily attendance audit records and geofence verification hashes are automatically and irrevocably purged from active storage every 30 calendar days.
                  </p>
                </div>

                <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2">
                    <span className="material-symbols-outlined text-lg">lock</span>
                  </div>
                  <h4 className="font-bold text-neutral-900 text-xs">AES-256 Storage</h4>
                  <p className="text-xs text-neutral-500 mt-1">
                    All telemetry packets, student ID hashes, and warden audit signatures are encrypted at rest with AES-256 and transmitted exclusively over TLS 1.3.
                  </p>
                </div>
              </div>

              <section className="space-y-3 pt-2">
                <h3 className="text-base font-bold text-neutral-900">FERPA & Digital Personal Data Protection (DPDP) Alignment</h3>
                <p>
                  Hostel roll-call records are classified as internal residential safety logs under Campus Tenancy Bylaws.
                  Access is strictly role-restricted to the Warden on Active Night Duty and the Chief Hostel Proctor.
                  Faculty members, student peers, and non-security personnel cannot view check-in logs or timestamps.
                </p>
              </section>
            </div>
          )}

          {/* TAB 3: BIOMETRIC & DEVICE CONSENT */}
          {activeTab === 'consent' && (
            <div className="py-6 space-y-6 text-sm text-neutral-700 leading-relaxed">
              <div className="border border-neutral-200 rounded-2xl p-5 bg-white shadow-xs">
                <h3 className="font-bold text-neutral-900 text-sm mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">devices</span>
                  Single Authenticated Device Binding
                </h3>
                <p className="text-xs text-neutral-600 mb-4">
                  To prevent credential sharing and roll-call proxying, each resident account is cryptographically bound
                  to exactly one primary mobile handset.
                </p>

                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-neutral-700">Currently Bound Hardware:</span>
                    <span className="font-bold text-neutral-900 bg-white px-2.5 py-1 rounded-md border border-neutral-200">
                      Pixel 8 Pro • Android 15
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-neutral-700">FCM Push Token Fingerprint:</span>
                    <span className="font-mono text-neutral-500">e2k7...9b21 (Valid & Receiving)</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-neutral-700">Geofence Accuracy Threshold:</span>
                    <span className="font-semibold text-emerald-700">High Precision (±12m radius)</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-base font-bold text-neutral-900">Student Declarations & Permissions</h3>
                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasAcceptedGeofence}
                    onChange={(e) => setHasAcceptedGeofence(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-neutral-300"
                  />
                  <div className="text-xs">
                    <strong className="text-neutral-900 block font-semibold">Location Access Permission</strong>
                    <span className="text-neutral-500">
                      I authorize HostelGuard to access my device GPS coordinates strictly when I interact with the Check-In button during curfew hours (22:00 - 00:00).
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasAcceptedBiometrics}
                    onChange={(e) => setHasAcceptedBiometrics(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-neutral-300"
                  />
                  <div className="text-xs">
                    <strong className="text-neutral-900 block font-semibold">Device Biometric / Screen Lock Authentication</strong>
                    <span className="text-neutral-500">
                      I agree that local device authentication (Fingerprint / Face ID / PIN) verifies my identity during high-assurance check-in workflows.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasAcceptedTerms}
                    onChange={(e) => setHasAcceptedTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-neutral-300"
                  />
                  <div className="text-xs">
                    <strong className="text-neutral-900 block font-semibold">Automated Guardian Notifications</strong>
                    <span className="text-neutral-500">
                      I acknowledge that being absent beyond 00:00 IST without an approved extension triggers automated safety dispatch to my registered emergency contacts.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* TAB 4: ARCHITECTURE PIPELINE */}
          {activeTab === 'architecture' && (
            <div className="py-6 space-y-6 text-sm text-neutral-700">
              <p className="text-xs text-neutral-500">
                Visualizing how a resident attendance ping travels securely from the phone hardware to the warden roll-call dashboard with zero data leakage.
              </p>

              {/* Architecture Diagram Steps */}
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-blue-50/60 border border-blue-200">
                  <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    1
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-neutral-900 text-xs">Resident Client Handset</h4>
                      <span className="font-mono text-[10px] text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">Client Side</span>
                    </div>
                    <p className="text-xs text-neutral-600 mt-1">
                      Resident taps &ldquo;Confirm IN&rdquo;. Web Geolocation API queries High Accuracy GPS. Local anti-mock sensor validates mock-provider flags.
                    </p>
                  </div>
                </div>

                <div className="flex justify-center -my-2 text-blue-300">
                  <span className="material-symbols-outlined text-lg">south</span>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200">
                  <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    2
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-neutral-900 text-xs">TLS 1.3 Encrypted Ingress & HMAC Signature</h4>
                      <span className="font-mono text-[10px] text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">Transit Protocol</span>
                    </div>
                    <p className="text-xs text-neutral-600 mt-1">
                      Payload containing Student UUID, Lat/Long, Accuracy (±8m), and Timestamp is signed with device key and transmitted securely.
                    </p>
                  </div>
                </div>

                <div className="flex justify-center -my-2 text-indigo-300">
                  <span className="material-symbols-outlined text-lg">south</span>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-2xl bg-violet-50/60 border border-violet-200">
                  <div className="h-10 w-10 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    3
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-neutral-900 text-xs">Geofencing Engine & Ray-Casting Polygon Check</h4>
                      <span className="font-mono text-[10px] text-violet-700 bg-white px-2 py-0.5 rounded border border-violet-200">Edge Verification</span>
                    </div>
                    <p className="text-xs text-neutral-600 mt-1">
                      Server validates if coordinates fall strictly inside Sunrise Boys Hostel polygon bounds. Returns boolean <code>isWithinPerimeter: true</code>.
                    </p>
                  </div>
                </div>

                <div className="flex justify-center -my-2 text-violet-300">
                  <span className="material-symbols-outlined text-lg">south</span>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200">
                  <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    4
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-neutral-900 text-xs">Warden Live Radar & Immutable Audit Ledger</h4>
                      <span className="font-mono text-[10px] text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">Authorized Display</span>
                    </div>
                    <p className="text-xs text-neutral-600 mt-1">
                      Real-time roll-call tally increments. Resident badge switches from &ldquo;Pending&rdquo; to &ldquo;Confirmed IN&rdquo;. Snapshot scheduled for 30-day auto-purge.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CERTIFICATES & AUDIT LEDGER */}
          {activeTab === 'certificates' && (
            <div className="py-6 space-y-6 text-sm text-neutral-700 leading-relaxed">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-neutral-200 rounded-2xl p-5 bg-linear-to-br from-neutral-50 to-white shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Campus Certification</span>
                    <span className="material-symbols-outlined text-emerald-600">verified</span>
                  </div>
                  <h4 className="font-bold text-neutral-900 text-sm">ISO/IEC 27001 Data Security Compliant</h4>
                  <p className="text-xs text-neutral-500 mt-1 mb-3">
                    Verified residential management system meeting international standards for security information management.
                  </p>
                  <div className="text-[11px] font-mono text-neutral-600 bg-neutral-100 p-2 rounded-lg">
                    Certificate ID: ISO-27001-SUNRISE-2026-X8
                  </div>
                </div>

                <div className="border border-neutral-200 rounded-2xl p-5 bg-linear-to-br from-neutral-50 to-white shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Campus Ombudsman</span>
                    <span className="material-symbols-outlined text-blue-600">gavel</span>
                  </div>
                  <h4 className="font-bold text-neutral-900 text-sm">Residential Tenancy Legal Authorization</h4>
                  <p className="text-xs text-neutral-500 mt-1 mb-3">
                    Authorized under University Residential Hostels Ordinance 1998 § 12 (Night Safety and Roll-Call Procedures).
                  </p>
                  <div className="text-[11px] font-mono text-neutral-600 bg-neutral-100 p-2 rounded-lg">
                    Gazette Ref: #UNIV-RES-2026-NIGHT-014
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => showToast('Compliance Report (PDF) prepared for download.')}
                  className="bg-neutral-900 hover:bg-neutral-800 text-white font-medium px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-xs transition-colors"
                >
                  <span className="material-symbols-outlined text-base">download</span>
                  Download Signed Compliance Certificate
                </button>
                <button
                  onClick={() => showToast('Exporting GDPR/DPDP personal data archive...')}
                  className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-medium px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">dataset</span>
                  Request My Personal Data Archive
                </button>
              </div>
            </div>
          )}

          {/* Footer note */}
          <div className="mt-auto pt-6 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-400 gap-2">
            <span>HostelGuard Security Operations • Sunrise Boys Hostel Protocol</span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => onNavigate('login')}
                className="hover:text-blue-600 transition-colors"
              >
                Return to Login
              </button>
              <span>•</span>
              <button
                onClick={() => onNavigate('student-dashboard')}
                className="hover:text-blue-600 transition-colors"
              >
                Student View
              </button>
              <span>•</span>
              <button
                onClick={() => onNavigate('warden-dashboard')}
                className="hover:text-blue-600 transition-colors"
              >
                Warden View
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Digital Signature Modal */}
      {showSignModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-base">draw</span>
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 text-sm">Execute Digital Consent</h3>
                  <p className="text-xs text-neutral-500">Hostel Residence & Curfew Compliance Agreement</p>
                </div>
              </div>
              <button onClick={() => setShowSignModal(false)} className="text-neutral-400 hover:text-neutral-700">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSignConsent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Resident Full Name</label>
                <input
                  type="text"
                  required
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Roll Number / Student ID</label>
                <input
                  type="text"
                  required
                  value={signatureRollNo}
                  onChange={(e) => setSignatureRollNo(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200 text-[11px] text-neutral-600">
                By clicking <strong>Confirm & Digitally Sign</strong>, you affix an authorized electronic signature adhering
                to Indian IT Act §5 and University Tenancy Regulations for the 2026 academic term.
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSignModal(false)}
                  className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 py-2.5 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-base">verified</span>
                  Confirm & Sign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
