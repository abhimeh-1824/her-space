'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { StudentManagementView } from '@/components/views';
import { AppScreen } from '@/types';

export default function WardenStudentsPage() {
  const router = useRouter();

  const handleNavigate = (screen: AppScreen) => {
    switch (screen) {
      case 'warden-dashboard':
        router.push('/warden/dashboard');
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
      <StudentManagementView onNavigate={handleNavigate} onLogout={() => router.push('/login')} />
    </div>
  );
}
