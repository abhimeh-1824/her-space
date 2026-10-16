'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { HostelSettingsView } from '@/components/views';
import { AppScreen } from '@/types';

export default function WardenSettingsPage() {
  const router = useRouter();

  const handleNavigate = (screen: AppScreen) => {
    switch (screen) {
      case 'warden-dashboard':
        router.push('/warden/dashboard');
        break;
      case 'student-management':
        router.push('/warden/students');
        break;
      case 'attendance-monitoring':
        router.push('/warden/monitoring');
        break;
      case 'login':
        router.push('/login');
        break;
      default:
        router.push('/');
        break;
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <HostelSettingsView onNavigate={handleNavigate} onLogout={() => router.push('/login')} />
    </div>
  );
}
