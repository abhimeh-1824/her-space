'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { WardenDashboardView } from '@/components/views';
import { AppScreen } from '@/types';

export default function WardenDashboardPage() {
  const router = useRouter();

  const handleNavigate = (screen: AppScreen) => {
    switch (screen) {
      case 'student-management':
        router.push('/warden/students');
        break;
      case 'attendance-monitoring':
        router.push('/warden/monitoring');
        break;
      case 'hostel-settings':
        router.push('/warden/settings');
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
      <WardenDashboardView onNavigate={handleNavigate} onLogout={() => router.push('/login')} />
    </div>
  );
}
