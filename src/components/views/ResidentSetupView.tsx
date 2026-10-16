'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile } from '../../types';

export interface ResidentSetupViewProps {
  token: string;
  onSuccess?: (user?: UserProfile) => void;
  onGoToLogin?: () => void;
}

export const ResidentSetupView: React.FC<ResidentSetupViewProps> = ({
  token,
  onSuccess,
  onGoToLogin,
}) => {
  const [invitation, setInvitation] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  // Form inputs
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setError('No invitation token provided in URL.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await fetch(`/api/invite?token=${encodeURIComponent(token.trim())}`);
        const data = await res.json();
        if (res.ok && data.success) {
          setInvitation(data.invitation);
          setError(null);
          setIsExpired(false);
        } else {
          setError(data.error || 'Invalid or expired setup link.');
          if (data.expired) setIsExpired(true);
          if (data.invitation) setInvitation(data.invitation);
        }
      } catch (err: any) {
        setError(err.message || 'Unable to connect to server to verify setup link.');
      } finally {
        setLoading(false);
      }
    }
    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setPassword',
          token: token.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSetupComplete(true);
        setIsExpired(false);
      } else {
        setError(data.error || 'Failed to complete password setup.');
        if (data.expired) setIsExpired(true);
      }
    } catch (err: any) {
      setError(err.message || 'Network error while setting password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoLogin = () => {
    if (onGoToLogin) {
      onGoToLogin();
    } else if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="font-medium text-slate-300">Verifying your secure invitation link...</p>
        </div>
      </div>
    );
  }

  if (isExpired || (error && !invitation)) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 rounded-3xl p-6 sm:p-8 border border-rose-500/30 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl">link_off</span>
          </div>
          <h2 className="text-xl font-bold text-white">Setup Link Expired or Already Used</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            {error || 'This invitation link has already been used to set a password or has expired. Each link can only be used once for security.'}
          </p>
          <div className="pt-3">
            <button
              onClick={handleGoLogin}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold transition-colors cursor-pointer shadow-lg shadow-violet-600/30"
            >
              Proceed to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (setupComplete) {
    const isWarden = invitation?.role === 'warden';
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 rounded-3xl p-6 sm:p-8 border border-emerald-500/30 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl">verified</span>
          </div>
          <h2 className="text-2xl font-bold text-white">Password Set Successfully!</h2>
          <p className="text-sm text-slate-300">
            Welcome, <span className="font-semibold text-white">{invitation?.name}</span>! Your password has been saved, your {isWarden ? 'Warden' : 'Resident'} account is now fully active, and this link has expired.
          </p>
          <div className="bg-slate-800/80 p-4 rounded-2xl text-left text-xs space-y-1.5 border border-slate-700">
            <p className="text-slate-400">Login Email: <span className="text-white font-mono font-medium">{invitation?.email}</span></p>
            <p className="text-slate-400">Role: <span className="text-white font-medium capitalize">{invitation?.role}</span></p>
            {invitation?.hostelId && (
              <p className="text-slate-400">Hostel Jurisdiction: <span className="text-white font-medium">{invitation?.hostelId}</span></p>
            )}
          </div>
          <button
            onClick={handleGoLogin}
            className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold transition-colors shadow-lg shadow-violet-600/30 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Go to Login</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      </div>
    );
  }

  const isWarden = invitation?.role === 'warden';

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-lg w-full bg-slate-900/90 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl space-y-6">
        {/* Brand header */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="w-10 h-10 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30 flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-xl">shield</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">HER-SPACE</h1>
            <p className="text-xs text-slate-400">
              {isWarden ? 'Hostel Warden Activation' : 'Resident Account Activation'}
            </p>
          </div>
        </div>

        {/* Welcome card */}
        <div className="bg-violet-950/40 border border-violet-500/30 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">
              Invitation Verified
            </p>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-violet-600/30 text-violet-300 px-2 py-0.5 rounded">
              {isWarden ? 'Duty Warden' : 'Resident'}
            </span>
          </div>
          <p className="text-base font-bold text-white">Welcome, {invitation?.name}</p>
          <p className="text-xs text-slate-300">
            {invitation?.email} {invitation?.hostelId ? `· Hostel: ${invitation.hostelId}` : ''}
          </p>
        </div>

        {error && (
          <div className="bg-rose-500/20 border border-rose-500/40 text-rose-200 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Set Your Account Password (min 6 characters) *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Confirm Password *
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <p className="text-[11px] text-slate-400">
            Note: Once you save your password, this invitation link will expire automatically for security. You can then log in using your email and password.
          </p>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold transition-all shadow-lg shadow-violet-600/30 cursor-pointer flex items-center justify-center gap-2 mt-4"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Saving Password...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">lock</span>
                <span>Set Password & Activate Account</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
