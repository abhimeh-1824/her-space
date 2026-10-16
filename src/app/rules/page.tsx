'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { TermsPrivacyView } from '@/components/views';
import { ProductionNavbar } from '@/components/layout/ProductionNavbar';
import { useAuth } from '@/context/AuthContext';

export default function RulesPage() {
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-surface flex flex-col md:flex-row">
      <ProductionNavbar
        onLogout={async () => {
          await logout();
          router.push('/login');
        }}
      />
      <main className="flex-1 flex flex-col bg-surface overflow-x-hidden md:pl-64 min-w-0">
        <TermsPrivacyView
          onNavigate={(screen) => {
            if (screen === 'warden-dashboard') router.push('/warden/dashboard');
            else if (screen === 'login') router.push('/login');
            else router.push('/warden/dashboard');
          }}
          onLogout={async () => {
            await logout();
            router.push('/login');
          }}
        />
      </main>
    </div>
  );
}
