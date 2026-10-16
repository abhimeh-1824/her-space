'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ResidentSetupView } from '@/components/views/ResidentSetupView';

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromQuery = searchParams.get('token') || '';
  const [token, setToken] = useState(tokenFromQuery);
  const [tokenInput, setTokenInput] = useState('');

  useEffect(() => {
    if (tokenFromQuery) {
      setToken(tokenFromQuery);
    }
  }, [tokenFromQuery]);

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-violet-600/20 text-violet-400 border border-violet-500/30 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl">key</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Enter Account Setup Token</h2>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Paste the single-use invitation token or link you received from your hostel administrator or warden to activate your resident account.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              let clean = tokenInput.trim();
              if (clean.includes('/setup/')) {
                clean = clean.split('/setup/')[1].split('?')[0];
              } else if (clean.includes('token=')) {
                clean = clean.split('token=')[1].split('&')[0];
              }
              if (clean) setToken(clean);
            }}
            className="space-y-4"
          >
            <input
              type="text"
              required
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="e.g. 7f8a9b2c... or paste full setup link"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500"
            />
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg shadow-violet-600/20 cursor-pointer"
            >
              Verify & Proceed &rarr;
            </button>
          </form>

          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-xs text-slate-400 hover:text-white"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <ResidentSetupView
      token={token}
      onSuccess={() => router.push('/')}
      onGoToLogin={() => router.push('/')}
    />
  );
}

export default function SetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
          <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <SetupContent />
    </Suspense>
  );
}
