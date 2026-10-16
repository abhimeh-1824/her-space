'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginView } from '@/components/views';
import { AppScreen, UserRole } from '@/types';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { user, isInitialized } = useAuth();

  useEffect(() => {
    if (!isInitialized || !user) return;
    if (user.role === 'warden' || user.role === 'super_admin') {
      router.replace('/warden/dashboard');
    } else if (user.role === 'student') {
      router.replace('/student/dashboard');
    }
  }, [user, isInitialized, router]);

  const handleNavigate = (screen: AppScreen) => {
    switch (screen) {
      case 'student-dashboard':
        router.push('/student/dashboard');
        break;
      case 'location-setup':
        router.push('/student/location-setup');
        break;
      case 'attendance-history':
        router.push('/student/history');
        break;
      case 'warden-dashboard':
        router.push('/warden/dashboard');
        break;
      case 'student-management':
        router.push('/warden/students');
        break;
      case 'attendance-monitoring':
        router.push('/warden/monitoring');
        break;
      case 'hostel-settings':
        router.push('/warden/settings');
        break;
      case 'terms-privacy':
        router.push('/terms');
        break;
      default:
        router.push('/');
        break;
    }
  };

  const handleLogin = (role: UserRole) => {
    if (role === 'warden' || role === 'super_admin') {
      router.push('/warden/dashboard');
    } else {
      router.push('/student/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <LoginView onNavigate={handleNavigate} onLogin={handleLogin} />
    </div>
  );
}
