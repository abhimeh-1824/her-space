'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthorizedForRoute } from '@/lib/auth-guard';

import { ProductionNavbar } from '@/components/layout/ProductionNavbar';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user, isInitialized, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || '';

  const authCheck = isAuthorizedForRoute(user?.role, pathname, user?.email);

  useEffect(() => {
    if (!isInitialized) return;

    if (!authCheck.authorized && authCheck.redirectTo) {
      router.replace(authCheck.redirectTo);
    }
  }, [isInitialized, authCheck.authorized, authCheck.redirectTo, router]);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  // While validating credentials, show verification spinner
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-secondary font-medium tracking-wide">Verifying resident access...</p>
        </div>
      </div>
    );
  }

  // If unauthorized for resident portal
  if (!authCheck.authorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-rose-500/40 rounded-3xl p-6 text-center shadow-2xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
            <span className="material-symbols-outlined text-3xl">gpp_bad</span>
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">403 — Access Denied</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              {authCheck.reason || 'You do not have resident authorization to access this page.'}
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => router.replace(authCheck.redirectTo || '/login')}
              className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-lg shadow-violet-600/30 cursor-pointer transition-colors"
            >
              Return to Authorized Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col md:flex-row">
      <ProductionNavbar onLogout={handleLogout} />
      <main className="flex-1 flex flex-col bg-surface overflow-x-hidden md:pl-64 min-w-0">
        {children}
      </main>
    </div>
  );
}
