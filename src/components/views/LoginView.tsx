import React, { useState } from 'react';
import { AppScreen, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';

export interface LoginViewProps {
  onNavigate: (screen: AppScreen) => void;
  onLogin: (role: UserRole, email: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onNavigate, onLogin }) => {
  const { login, clearError } = useAuth();

  // Sign In Form State (Unified Single Login)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Password Reset Policy Modal
  const [showResetModal, setShowResetModal] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setLocalError('Please enter both your registered email and password.');
      return;
    }

    setIsSubmitting(true);
    setLocalError(null);
    clearError();

    try {
      const profile = await login({ email: email.trim(), password });

      onLogin(profile.role, profile.email);

      // Automatic intelligent routing based on credentials and verified account role
      if (profile.role === 'super_admin' || profile.role === 'warden') {
        onNavigate('warden-dashboard');
      } else {
        onNavigate('student-dashboard');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials. Please verify your email and password.';
      setLocalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 font-sans relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Authentication Card */}
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 shadow-lg shadow-violet-500/25 mb-3.5">
            <span className="material-symbols-outlined text-3xl text-white">shield</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">HER-SPACE</h1>
          <p className="text-xs text-slate-400 mt-1">Hostel Night Roll-Call & Curfew Attendance</p>
        </div>

        {/* Error Alert */}
        {localError && (
          <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-300">
            <span className="material-symbols-outlined text-base text-red-400 shrink-0">error</span>
            <div className="leading-relaxed">{localError}</div>
          </div>
        )}

        {/* Unified Login Form */}
        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Registered Email
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-base">
                mail
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@herspace.app or your registered email"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-300">Password</label>
              <button
                type="button"
                onClick={() => setShowResetModal(true)}
                className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-base">
                lock
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 shadow-lg shadow-violet-600/25 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer Legal Link */}
      <footer className="mt-8 text-center text-xs text-slate-500 relative z-10 flex items-center gap-4">
        <span>&copy; {new Date().getFullYear()} HER-SPACE Safety & Attendance</span>
        <span>&bull;</span>
        <button
          type="button"
          onClick={() => onNavigate('terms-privacy')}
          className="hover:text-slate-400 transition-colors cursor-pointer"
        >
          Terms & Privacy Policy
        </button>
      </footer>

      {/* Password Reset Policy Notice Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative overflow-hidden">
            {/* Ambient accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-start justify-between mb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-inner">
                  <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Password Reset Policy</h3>
                  <p className="text-xs text-amber-400/90 font-medium">Self-Service Reset Disabled</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Information Notice */}
            <div className="space-y-3.5 mb-6 text-xs text-slate-300 relative z-10 leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200">
                <p className="font-medium">
                  Hostel security protocols require verified identification before account access or password changes can occur.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2.5">
                <div className="font-semibold text-slate-200 flex items-center gap-2">
                  <span className="material-symbols-outlined text-violet-400 text-sm">vpn_key</span>
                  <span>How to get your access link:</span>
                </div>
                <ul className="space-y-2 text-slate-400 pl-1">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                    <span>Contact your <strong>Assigned Hostel Warden</strong> or <strong>Super Admin</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                    <span>Provide your registered <strong>Student ID</strong> or Room Number.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                    <span>The Warden will click <strong>&quot;Regenerate Link&quot;</strong> in the roster dashboard to issue an official, single-use 48-hour password setup link for you.</span>
                  </li>
                </ul>
              </div>

              <p className="text-[11px] text-slate-500 text-center">
                This prevents unauthorized device takeovers and ensures student curfew safety.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 relative z-10">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-600/25 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Understood</span>
                <span className="material-symbols-outlined text-sm">check</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
