'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { WardenAssignmentView } from '@/components/views';
import { useAuth } from '@/context/AuthContext';

export default function WardensPage() {
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <WardenAssignmentView
      onNavigate={(screen) => {
        if (screen === 'warden-dashboard') router.push('/warden/dashboard');
        else if (screen === 'hostel-registration') router.push('/warden/hostels');
        else if (screen === 'student-management') router.push('/warden/students');
        else if (screen === 'attendance-monitoring') router.push('/warden/monitoring');
        else if (screen === 'hostel-settings') router.push('/warden/settings');
      }}
      onLogout={async () => {
        await logout();
        router.push('/login');
      }}
    />
  );
}
