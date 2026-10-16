'use client';

import React, { useEffect } from 'react';
import { AuthProvider } from '@/context/AuthContext';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/firebase-messaging-sw.js')
        .catch((err) => console.warn('[HER-SPACE ServiceWorker] Registration fallback:', err));
    }
  }, []);

  return <AuthProvider>{children}</AuthProvider>;
}
