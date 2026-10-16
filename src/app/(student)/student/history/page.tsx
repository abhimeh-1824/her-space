'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { AttendanceHistoryView } from '@/components/views';
import { AppScreen } from '@/types';

export default function StudentAttendanceHistoryPage() {
  const router = useRouter();

  const handleNavigate = (screen: AppScreen) => {
    switch (screen) {
      case 'student-dashboard':
        router.push('/student/dashboard');
        break;
      case 'location-setup':
        router.push('/student/location-setup');
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
      <AttendanceHistoryView onNavigate={handleNavigate} />
    </div>
  );
}
