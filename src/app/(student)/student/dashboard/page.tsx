'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { StudentDashboardView } from '@/components/views';
import { Student, AppScreen } from '@/types';
import { subscribeToStudents, updateStudentAttendanceInDb } from '@/lib/db-seed';
import { useAuth } from '@/context/AuthContext';

export default function StudentDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    const unsub = subscribeToStudents((liveStudents) => {
      setStudents(liveStudents);
    });
    return () => unsub();
  }, []);

  const currentStudent = useMemo<Student | null>(() => {
    if (!user) return null;

    const userEmail = (user.email || '').trim().toLowerCase();
    const userUid = user.uid || '';

    // 1. Match by Email (primary institutional binding)
    if (userEmail) {
      const matchByEmail = students.find(
        (s) => s.email && s.email.trim().toLowerCase() === userEmail
      );
      if (matchByEmail) return matchByEmail;
    }

    // 2. Match by UID or Student ID
    const matchById = students.find((s) => {
      if (s.id === userUid) return true;
      if (s.studentId && s.studentId.toLowerCase() === userUid.toLowerCase()) return true;
      if (`user_${s.studentId}`.toLowerCase() === userUid.toLowerCase()) return true;
      if (s.id === userUid.replace(/^user_/, '')) return true;
      return false;
    });
    if (matchById) return matchById;

    // 3. Fallback: If user is authenticated as student, construct active profile
    if (user.role === 'student') {
      const studentId =
        (user as any).studentId ||
        (user.roomNumber ? `HER-${user.roomNumber}` : `STU-${userUid.slice(0, 4)}`);
      return {
        id: user.uid,
        studentId,
        name: user.name || user.email.split('@')[0],
        rollNo: (user as any).rollNo || `#${studentId}`,
        semester: 'Active Resident',
        room: user.roomNumber || 'A-101',
        block: 'Block A',
        floor: 1,
        email: user.email,
        phone: user.phone || '',
        guardianPhone: '',
        status: 'active',
        device: 'Registered Handset',
        browser: 'Mobile Web Client',
        deviceStatus: 'registered',
        attendanceStatus: 'OUT',
        lastUpdated: 'New Session',
        avatarInitials: (user.name || user.email)
          .split(' ')
          .map((n) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
        hostelId: user.hostelId || 'HST-HER-01',
      } as Student;
    }

    return students[0] || null;
  }, [students, user]);

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

  const handleUpdateAttendance = async (
    status: 'IN' | 'OUT' | 'Pending',
    outReason?: string,
    estimatedReturnTime?: string
  ) => {
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (currentStudent && currentStudent.id) {
      try {
        await updateStudentAttendanceInDb(
          currentStudent.id,
          status,
          timeNow,
          undefined,
          outReason,
          estimatedReturnTime
        );
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
