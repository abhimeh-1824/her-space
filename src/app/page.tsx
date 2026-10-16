'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const { user, isLoading, isInitialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isInitialized || isLoading) return;
    if (user?.role === 'warden' || user?.role === 'super_admin') {
      router.replace('/warden/dashboard');
    } else if (user?.role === 'student') {
      router.replace('/student/dashboard');
    } else {
      router.replace('/login');
    }
  }, [user, isLoading, isInitialized, router]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-secondary font-medium tracking-wide">Loading HER-SPACE...</p>
      </div>
    </div>
  );
}
