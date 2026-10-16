'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { HostelRegistrationView } from '@/components/views';
import { useAuth } from '@/context/AuthContext';

export default function HostelsPage() {
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <HostelRegistrationView
      onNavigate={(screen) => {
        if (screen === 'warden-dashboard') router.push('/warden/dashboard');
        else if (screen === 'warden-assignment') router.push('/warden/wardens');
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
