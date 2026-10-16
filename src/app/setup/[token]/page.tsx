'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ResidentSetupView } from '@/components/views/ResidentSetupView';

export default function SetupTokenPage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params?.token === 'string' ? params.token : Array.isArray(params?.token) ? params.token[0] : '';

  return (
    <ResidentSetupView
      token={token}
      onSuccess={() => {
        // Stay on success screen until user clicks "Go to Login"
      }}
      onGoToLogin={() => {
        router.push('/login');
      }}
    />
  );
}
