import React, { useState } from 'react';
import { AppScreen, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface Screen1LoginProps {
  onNavigate: (screen: AppScreen) => void;
  onLogin: (role: UserRole, email: string) => void;
}

export const Screen1Login: React.FC<Screen1LoginProps> = ({ onNavigate, onLogin }) => {
  const { login, register, resetPassword, error: authContextError, clearError } = useAuth();
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('admin@test.com');
  const [password, setPassword] = useState('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localAuthError, setLocalAuthError] = useState<string | null>(null);

  // Signup form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regHostelId, setRegHostelId] = useState('HST-SUN-01');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regShowPassword, setRegShowPassword] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  // Password reset modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetToast, setResetToast] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLocalAuthError(null);
    clearError();
    try {
      const profile = await login({ email, password });
      onLogin(profile.role, profile.email);
      onNavigate(profile.role === 'warden' || profile.role === 'super_admin' ? 'warden-dashboard' : 'student-dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid institutional credentials.';
      setLocalAuthError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalAuthError(null);
    clearError();

    if (!regName || !regEmail || !regPassword) {
      setLocalAuthError('Please fill out all required fields.');
      return;
    }
    if (regPassword.length < 6) {
      setLocalAuthError('Password must be at least 6 characters.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setLocalAuthError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const profile = await register({
        email: regEmail,
        password: regPassword,
        name: regName,
        hostelId: regHostelId,
        phone: regPhone,
      });
      setSignupSuccess(true);
      setTimeout(() => {
        setSignupSuccess(false);
        onLogin(profile.role, profile.email);
        onNavigate(profile.role === 'warden' || profile.role === 'super_admin' ? 'warden-dashboard' : 'student-dashboard');
      }, 1200);
    } catch (err: unknown) {
      setLocalAuthError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail || !resetEmail.includes('@')) {
      alert('Please enter a valid institutional email address.');
      return;
    }
    setResetLoading(true);
    try {
      await resetPassword(resetEmail);
      setResetToast(`Password recovery link dispatched to ${resetEmail}. Check your inbox.`);
    } catch {
      setResetToast(`Password recovery request recorded for ${resetEmail}.`);
    } finally {
      setResetLoading(false);
      setTimeout(() => {
        setResetToast(null);
        setShowResetModal(false);
      }, 3500);
    }
  };

  return (
    <div className="bg-surface font-body-md text-on-surface min-h-screen flex flex-col justify-between pt-safe pb-safe">
      {/* Header */}
      <header className="w-full max-w-md mx-auto px-4 pt-6 pb-2 flex flex-col items-center gap-1 text-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary-container shadow-sm">
            <span className="material-symbols-outlined text-[20px]">shield</span>
          </div>
          <span className="font-title-md text-title-md tracking-tight text-on-surface font-bold">HostelGuard</span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed">
          <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
          <span className="font-label-xs text-label-xs uppercase tracking-wider font-semibold">
            Unified Campus Network
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col justify-center items-center w-full max-w-md mx-auto px-4 py-4 bg-surface">
        <div className="flex flex-col w-full pb-6">
          {/* Visual Hero Branding Card */}
          <div className="relative w-full rounded-xl overflow-hidden bg-surface-container-lowest shadow-sm mb-4">
            {/* Illustration Banner */}
            <div className="relative w-full h-36 overflow-hidden">
              <img
                alt="HostelGuard Campus Architecture"
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAwAiYmvkR6ve0owoI9BWaPIO5gY0a7y1dUqeZACpr8cWs2SXA_oU0xHatM3LPaaZkQ9zUe94GkkO7P8s8PlqUoJbHaGKEWNnHgYzKcf3_huSvIh8Aqe9jps7rRbqGiM2tiW-5awgK6RtrhtaXDTOfrZs3f6h3N-hMZ_yC-j6ONLwaklsDWwXaH8kczSjUGsgozl5AX6Z63Te8aZHjgClUPICbb8a7SRYQ8OfmrOja3JlQpIyJT9vlv"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/30 to-transparent"></div>
              {/* Network Live Status Tag */}
              <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-lowest/90 backdrop-blur-sm shadow-sm">
                <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
                <span className="font-label-xs text-label-xs text-on-surface font-semibold tracking-tight">
                  12 Hostels Connected
                </span>
              </div>
            </div>

            {/* Hero Content & Value Prop */}
            <div className="p-4 pt-1 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-label-xs text-label-xs text-primary font-semibold tracking-wider uppercase">
                  Enterprise Roll-Call
                </span>
                <span className="inline-flex items-center gap-1 text-secondary font-label-xs text-label-xs">
                  <span className="material-symbols-outlined text-sm text-primary">verified_user</span>
                  Tier-4 Active
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-secondary leading-snug">
                Centralized night roll-call, real-time curfew verification, and automated safety records across residential halls.
              </p>
              {/* Quick Metrics Pill Row */}
              <div className="grid grid-cols-2 gap-2 pt-2 mt-1">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-container-low">
                  <span className="material-symbols-outlined text-primary text-base">timer</span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-xs text-label-xs font-semibold text-on-surface">99.8% On-Time</span>
                    <span className="font-label-xs text-label-xs text-outline truncate">Check-in rate</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-container-low">
                  <span className="material-symbols-outlined text-primary text-base">nfc</span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-xs text-label-xs font-semibold text-on-surface">NFC &amp; Biometric</span>
                    <span className="font-label-xs text-label-xs text-outline truncate">Instant audit sync</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Direct Database Credentials Badge */}
          <div className="mb-3 p-3 bg-blue-950/30 border border-blue-500/30 rounded-xl flex items-center justify-between text-xs gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-400 text-lg">admin_panel_settings</span>
              <div>
                <div className="font-semibold text-blue-200">Database Admin Credentials</div>
                <div className="text-neutral-400 text-[11px] font-mono">
                  admin@test.com / admin
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setEmail('admin@test.com');
                setPassword('admin');
              }}
              className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-semibold shadow-xs hover:bg-blue-500 transition-colors text-[11px]"
            >
              Use Admin
            </button>
          </div>

          {/* Interactive Auth Container */}
          <div className="w-full bg-surface-container-lowest rounded-xl shadow-md p-4 flex flex-col">
            {/* Segmented Tab Switcher */}
            <div className="w-full bg-surface-container p-1 rounded-lg flex items-center mb-4 select-none">
              <button
                className={`flex-1 py-2 text-center rounded-lg font-label-md text-label-md transition-all duration-150 ${
                  activeTab === 'signin'
                    ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-sm'
                    : 'text-secondary hover:text-on-surface font-medium'
                }`}
                onClick={() => setActiveTab('signin')}
                type="button"
              >
                Sign In
              </button>
              <button
                className={`flex-1 py-2 text-center rounded-lg font-label-md text-label-md transition-all duration-150 ${
                  activeTab === 'signup'
                    ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-sm'
                    : 'text-secondary hover:text-on-surface font-medium'
                }`}
                onClick={() => setActiveTab('signup')}
                type="button"
              >
                Create Account
              </button>
            </div>

            {/* STATE 1: Sign In View */}
            {activeTab === 'signin' && (
              <div className="flex flex-col">
                <div className="flex flex-col mb-4">
                  <h2 className="font-headline-sm text-headline-sm text-on-surface tracking-tight font-bold">
                    Welcome back
                  </h2>
                  <p className="font-body-sm text-body-sm text-secondary mt-0.5">
                    Sign in to manage hostel attendance &amp; verification.
                  </p>
                </div>
                <form className="flex flex-col gap-4" onSubmit={handleSignIn}>
                  {/* Email Field */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-label-sm font-semibold text-secondary flex items-center justify-between" htmlFor="signin-email">
                      <span>Institutional Email</span>
                      <span className="text-outline font-normal font-label-xs text-label-xs">SSO Linked</span>
                    </label>
                    <div className="relative flex items-center rounded-lg bg-surface-container-lowest shadow-sm border border-outline-variant/60 focus-within:border-primary">
                      <span className="material-symbols-outlined absolute left-3 text-outline text-lg pointer-events-none">mail</span>
                      <input
                        autoComplete="username"
                        className="w-full pl-10 pr-3 py-2.5 rounded-lg font-body-md text-body-md text-on-surface bg-surface-container-lowest placeholder:text-outline focus:outline-none focus:bg-surface-container-low transition-colors"
                        id="signin-email"
                        placeholder="student.id@campus.edu or warden@campus.edu"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-label-sm text-label-sm font-semibold text-secondary" htmlFor="signin-password">
                        Password
                      </label>
                      <button
                        className="font-label-xs text-label-xs text-primary font-medium hover:underline cursor-pointer"
                        type="button"
                        onClick={() => {
                          setResetEmail(email);
                          setShowResetModal(true);
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative flex items-center rounded-lg bg-surface-container-lowest shadow-sm border border-outline-variant/60 focus-within:border-primary">
                      <span className="material-symbols-outlined absolute left-3 text-outline text-lg pointer-events-none">lock</span>
                      <input
                        autoComplete="current-password"
                        className="w-full pl-10 pr-10 py-2.5 rounded-lg font-body-md text-body-md text-on-surface bg-surface-container-lowest placeholder:text-outline focus:outline-none focus:bg-surface-container-low transition-colors"
                        id="signin-password"
                        placeholder="Enter your password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        aria-label="Toggle password visibility"
                        className="absolute right-2 p-1.5 text-outline hover:text-on-surface rounded-md transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-lg">
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Remember Me Toggle */}
                  <div className="flex items-center justify-between pt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                        type="checkbox"
                      />
                      <span className="font-label-sm text-label-sm text-on-surface">Remember this device</span>
                    </label>
                    <span className="font-label-xs text-label-xs text-outline">30-day session</span>
                  </div>

                  {/* Primary CTA */}
                  <button
                    className="w-full py-3 px-4 rounded-lg bg-primary-container text-on-primary font-title-sm text-title-sm font-semibold shadow-md hover:bg-primary active:opacity-90 transition-all flex items-center justify-center gap-2 mt-1 cursor-pointer"
                    type="submit"
                  >
                    <span>Sign In</span>
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </button>
                </form>

                {/* Role Access Info Hint */}
                <div className="mt-4 p-3 rounded-lg bg-surface-container-low flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-primary text-base mt-0.5 shrink-0">admin_panel_settings</span>
                  <p className="font-body-sm text-body-sm text-secondary leading-snug">
                    <strong className="font-semibold text-on-surface">Multi-Tier Access:</strong> Resident students, night wardens, and supervisors are routed automatically based on institutional credentials.
                  </p>
                </div>

                {/* Secondary Switcher */}
                <div className="mt-4 pt-2 text-center">
                  <p className="font-body-sm text-body-sm text-secondary">
                    New to HostelGuard?
                    <button
                      className="font-semibold text-primary hover:underline ml-1"
                      onClick={() => setActiveTab('signup')}
                      type="button"
                    >
                      Create an account
                    </button>
                  </p>
                </div>
              </div>
            )}

            {/* STATE 2: Create Account View */}
            {activeTab === 'signup' && (
              <div className="flex flex-col">
                <div className="flex flex-col mb-4">
                  <div className="inline-flex items-center gap-1.5 self-start px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed mb-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                    <span className="font-label-xs text-label-xs uppercase tracking-wider font-semibold">
                      Resident Self-Registration
                    </span>
                  </div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface tracking-tight font-bold">
                    Create Student Account
                  </h2>
                  <p className="font-body-sm text-body-sm text-secondary mt-0.5">
                    Register your institutional profile to connect with your allocated hostel.
                  </p>
                </div>

                {signupSuccess && (
                  <div className="mb-4 p-3 rounded-lg bg-secondary-container text-on-secondary-fixed flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">check_circle</span>
                    <span className="font-body-sm">Account created successfully! Switching to sign in...</span>
                  </div>
                )}

                <form className="flex flex-col gap-4" onSubmit={handleSignUp}>
                  {/* Full Name */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-label-sm font-semibold text-secondary" htmlFor="reg-name">
                      Full Name
                    </label>
                    <div className="relative flex items-center rounded-lg bg-surface-container-lowest shadow-sm border border-outline-variant/60">
                      <span className="material-symbols-outlined absolute left-3 text-outline text-lg pointer-events-none">person</span>
                      <input
                        autoComplete="name"
                        className="w-full pl-10 pr-3 py-2.5 rounded-lg font-body-md text-body-md text-on-surface bg-surface-container-lowest placeholder:text-outline focus:outline-none focus:bg-surface-container-low transition-colors"
                        id="reg-name"
                        placeholder="e.g. Maya Lin"
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Institutional Email */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-label-sm font-semibold text-secondary" htmlFor="reg-email">
                      Institutional Email
                    </label>
                    <div className="relative flex items-center rounded-lg bg-surface-container-lowest shadow-sm border border-outline-variant/60">
                      <span className="material-symbols-outlined absolute left-3 text-outline text-lg pointer-events-none">school</span>
                      <input
                        autoComplete="email"
                        className="w-full pl-10 pr-3 py-2.5 rounded-lg font-body-md text-body-md text-on-surface bg-surface-container-lowest placeholder:text-outline focus:outline-none focus:bg-surface-container-low transition-colors"
                        id="reg-email"
                        placeholder="student.id@campus.edu"
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Assigned Residential Hostel */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-label-sm font-semibold text-secondary" htmlFor="reg-hostel">
                      Assigned Residential Hostel
                    </label>
                    <div className="relative flex items-center rounded-lg bg-surface-container-lowest shadow-sm border border-outline-variant/60">
                      <span className="material-symbols-outlined absolute left-3 text-outline text-lg pointer-events-none">apartment</span>
                      <select
                        id="reg-hostel"
                        className="w-full pl-10 pr-3 py-2.5 rounded-lg font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:bg-surface-container-low transition-colors"
                        value={regHostelId}
                        onChange={(e) => setRegHostelId(e.target.value)}
                        required
                      >
                        <option value="HST-SUN-01">Sunrise Boys Hostel (#HST-SUN-01)</option>
                        <option value="HST-ANN-02">Sunrise Annex Block C (#HST-ANN-02)</option>
                      </select>
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-label-sm font-semibold text-secondary" htmlFor="reg-phone">
                      Curfew Contact Phone
                    </label>
                    <div className="relative flex items-center rounded-lg bg-surface-container-lowest shadow-sm border border-outline-variant/60">
                      <div className="absolute left-3 flex items-center gap-1 text-on-surface font-label-sm text-label-sm pr-1 pointer-events-none">
                        <span className="material-symbols-outlined text-outline text-lg">call</span>
                        <span className="font-medium text-secondary ml-1">+91</span>
                      </div>
                      <input
                        autoComplete="tel"
                        className="w-full pl-16 pr-3 py-2.5 rounded-lg font-body-md text-body-md text-on-surface bg-surface-container-lowest placeholder:text-outline focus:outline-none focus:bg-surface-container-low transition-colors"
                        id="reg-phone"
                        placeholder="98000 12345"
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-label-sm font-semibold text-secondary" htmlFor="reg-password">
                      Password
                    </label>
                    <div className="relative flex items-center rounded-lg bg-surface-container-lowest shadow-sm border border-outline-variant/60">
                      <span className="material-symbols-outlined absolute left-3 text-outline text-lg pointer-events-none">key</span>
                      <input
                        autoComplete="new-password"
                        className="w-full pl-10 pr-10 py-2.5 rounded-lg font-body-md text-body-md text-on-surface bg-surface-container-lowest placeholder:text-outline focus:outline-none focus:bg-surface-container-low transition-colors"
                        id="reg-password"
                        placeholder="Min. 8 characters with 1 number"
                        type={regShowPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        required
                      />
                      <button
                        aria-label="Toggle password visibility"
                        className="absolute right-2 p-1.5 text-outline hover:text-on-surface rounded-md transition-colors"
                        onClick={() => setRegShowPassword(!regShowPassword)}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-lg">
                          {regShowPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-label-sm font-semibold text-secondary" htmlFor="reg-password-confirm">
                      Confirm Password
                    </label>
                    <div className="relative flex items-center rounded-lg bg-surface-container-lowest shadow-sm border border-outline-variant/60">
                      <span className="material-symbols-outlined absolute left-3 text-outline text-lg pointer-events-none">lock_reset</span>
                      <input
                        autoComplete="new-password"
                        className="w-full pl-10 pr-10 py-2.5 rounded-lg font-body-md text-body-md text-on-surface bg-surface-container-lowest placeholder:text-outline focus:outline-none focus:bg-surface-container-low transition-colors"
                        id="reg-password-confirm"
                        placeholder="Re-enter your password"
                        type={regShowPassword ? 'text' : 'password'}
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Role Governance Notice */}
                  <div className="p-3 rounded-lg bg-surface-container-low flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-secondary text-lg mt-0.5 shrink-0">shield</span>
                    <p className="font-body-sm text-body-sm text-secondary leading-snug">
                      <strong className="font-semibold text-on-surface">Institutional Notice:</strong> Public self-registration provisions a Student Resident profile. Hostel Warden, Chief Warden, and Super Admin credentials must be granted directly by the Housing Dean.
                    </p>
                  </div>

                  {/* Submit Button */}
                  <button
                    className="w-full py-3 px-4 rounded-lg bg-primary-container text-on-primary font-title-sm text-title-sm font-semibold shadow-md hover:bg-primary active:opacity-90 transition-all flex items-center justify-center gap-2 mt-1 cursor-pointer"
                    type="submit"
                  >
                    <span>Create Account</span>
                    <span className="material-symbols-outlined text-lg">how_to_reg</span>
                  </button>
                </form>

                {/* Return Link */}
                <div className="mt-4 pt-2 text-center">
                  <p className="font-body-sm text-body-sm text-secondary">
                    Already registered?
                    <button
                      className="font-semibold text-primary hover:underline ml-1"
                      onClick={() => setActiveTab('signin')}
                      type="button"
                    >
                      Return to Sign In
                    </button>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Campus Support & Legal Links */}
          <div className="flex flex-col items-center gap-2 mt-4 px-2">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
              <button
                className="font-label-xs text-label-xs text-outline hover:text-on-surface transition-colors py-1 cursor-pointer"
                onClick={() => onNavigate('terms-privacy')}
              >
                Terms of Service
              </button>
              <span className="text-surface-variant font-label-xs">•</span>
              <button
                className="font-label-xs text-label-xs text-outline hover:text-on-surface transition-colors py-1 cursor-pointer"
                onClick={() => onNavigate('terms-privacy')}
              >
                Biometric Policy
              </button>
              <span className="text-surface-variant font-label-xs">•</span>
              <button
                className="font-label-xs text-label-xs text-primary font-semibold hover:underline inline-flex items-center gap-1 py-1 cursor-pointer"
                onClick={() => alert('Campus Security Dispatch Hotline: +91 1902 222100 (24x7)')}
              >
                <span className="material-symbols-outlined text-xs">emergency</span>
                Security Dispatch
              </button>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-low text-secondary font-label-xs text-label-xs">
              <span className="material-symbols-outlined text-sm text-primary">lock_clock</span>
              Night Roll-Call Active Window: 21:00 — 06:00
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md mx-auto px-4 py-6 flex flex-col items-center gap-1 text-center">
        <div className="flex items-center gap-4">
          <button
            className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface transition-colors py-2 px-1 cursor-pointer"
            onClick={() => onNavigate('terms-privacy')}
          >
            Privacy Policy
          </button>
          <span className="text-outline-variant font-label-xs text-label-xs">•</span>
          <button
            className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface transition-colors py-2 px-1 cursor-pointer"
            onClick={() => alert('Hostel Administrative Helpdesk: room-audit@campus.edu')}
          >
            Help &amp; Support
          </button>
        </div>
        <p className="font-label-xs text-label-xs text-outline tracking-normal text-center">
          Institutional Access Terminal • Encrypted Session
        </p>
      </footer>
      {/* Password Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-neutral-100">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">lock_reset</span>
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 text-sm">Reset Password</h3>
                  <p className="text-[11px] text-neutral-500">HostelGuard Account Recovery</p>
                </div>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {resetToast ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-start gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-base shrink-0">mark_email_read</span>
                <span>{resetToast}</span>
              </div>
            ) : (
              <form onSubmit={handlePasswordResetSubmit} className="space-y-3">
                <p className="text-xs text-neutral-600">
                  Enter your registered institutional email to receive an official password reset authorization link.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Institutional Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="student.id@campus.edu"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {resetLoading ? (
                      <span>Sending...</span>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">send</span>
                        <span>Send Link</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
