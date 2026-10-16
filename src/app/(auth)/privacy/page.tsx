'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { TermsPrivacyView } from '@/components/views';
import { AppScreen } from '@/types';

export default function PrivacyPage() {
  const router = useRouter();

  const handleNavigate = (screen: AppScreen) => {
    if (screen === 'login') router.push('/login');
    else if (screen === 'warden-dashboard') router.push('/warden/dashboard');
    else router.push('/student/dashboard');
  };

  return (
    <div className="min-h-screen bg-surface">
      <TermsPrivacyView onNavigate={handleNavigate} onLogout={() => router.push('/login')} />
    </div>
  );
}
