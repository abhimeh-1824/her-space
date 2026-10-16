import React, { useState } from 'react';
import { AppScreen, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';

export interface LoginViewProps {
  onNavigate: (screen: AppScreen) => void;
  onLogin: (role: UserRole, email: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onNavigate, onLogin }) => {
  const { login, resetPassword, clearError } = useAuth();

  // Sign In Form State (Unified Single Login)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Password Reset Modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetToast, setResetToast] = useState<string | null>(null);

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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetLoading(true);
    try {
      await resetPassword(resetEmail.trim());
      setResetToast('Password reset link sent to your registered email.');
      setTimeout(() => {
        setShowResetModal(false);
        setResetToast(null);
        setResetEmail('');
      }, 3000);
    } catch (err: unknown) {
      setResetToast(err instanceof Error ? err.message : 'Failed to send reset link.');
    } finally {
      setResetLoading(false);
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

      {/* Forgot Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-white">Reset Account Password</h3>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Enter your registered institutional email to receive a secure password reset link.
            </p>
            {resetToast && (
              <div className="mb-4 p-2.5 rounded-lg bg-violet-500/10 border border-violet-500/30 text-xs text-violet-300">
                {resetToast}
              </div>
            )}
            <form onSubmit={handleResetPassword} className="space-y-4">
              <input
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="name@herspace.app"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-60"
                >
                  {resetLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
