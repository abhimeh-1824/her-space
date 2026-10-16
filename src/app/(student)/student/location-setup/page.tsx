'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LocationSetupView } from '@/components/views';
import { AppScreen } from '@/types';

export default function LocationSetupPage() {
  const router = useRouter();

  const handleNavigate = (screen: AppScreen) => {
    switch (screen) {
      case 'student-dashboard':
        router.push('/student/dashboard');
        break;
      case 'attendance-history':
        router.push('/student/history');
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
      <LocationSetupView onNavigate={handleNavigate} />
    </div>
  );
}
