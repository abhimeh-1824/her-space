'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { StudentDashboardView } from '@/components/views';
import { Student, AppScreen } from '@/types';
import { subscribeToStudents, updateStudentAttendanceInDb } from '@/lib/db-seed';

export default function StudentDashboardPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    const unsub = subscribeToStudents((liveStudents) => {
      setStudents(liveStudents);
    });
    return () => unsub();
  }, []);

  const currentStudent = students[0] || null;

  const handleNavigate = (screen: AppScreen) => {
    switch (screen) {
      case 'login':
        router.push('/login');
        break;
      case 'location-setup':
        router.push('/student/location-setup');
        break;
      case 'attendance-history':
        router.push('/student/history');
        break;
      case 'terms-privacy':
        router.push('/terms');
        break;
      default:
        router.push('/');
        break;
    }
  };

  const handleUpdateAttendance = async (status: 'IN' | 'OUT' | 'Pending') => {
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (currentStudent && currentStudent.id) {
      try {
        await updateStudentAttendanceInDb(currentStudent.id, status, timeNow);
      } catch (err) {
        console.warn('Live attendance note:', err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <StudentDashboardView
        student={currentStudent}
        onNavigate={handleNavigate}
        onUpdateAttendance={handleUpdateAttendance}
      />
    </div>
  );
}
