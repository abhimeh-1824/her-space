/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppScreen, UserRole, Student } from './types';
import { INITIAL_STUDENTS } from './data/mockData';
import { ScreenSwitcher } from './components/ScreenSwitcher';

// Screens 1 to 9
import { Screen1Login } from './components/screens/Screen1Login';
import { Screen2StudentDashboard } from './components/screens/Screen2StudentDashboard';
import { Screen3LocationSetup } from './components/screens/Screen3LocationSetup';
import { Screen4AttendanceHistory } from './components/screens/Screen4AttendanceHistory';
import { Screen5WardenDashboard } from './components/screens/Screen5WardenDashboard';
import { Screen6StudentManagement } from './components/screens/Screen6StudentManagement';
import { Screen7AttendanceMonitoring } from './components/screens/Screen7AttendanceMonitoring';
import { Screen8HostelSettings } from './components/screens/Screen8HostelSettings';
import { Screen9TermsPrivacy } from './components/screens/Screen9TermsPrivacy';
import { useAuth } from './context/AuthContext';
import { subscribeToStudents, updateStudentAttendanceInDb } from './lib/db-seed';

export default function App() {
  const { user, role: authRole, logout: authLogout } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(() => {
    if (!user) return 'login';
    return user.role === 'warden' || user.role === 'super_admin' ? 'warden-dashboard' : 'student-dashboard';
  });
  const [currentRole, setCurrentRole] = useState<UserRole>(user?.role || authRole || 'super_admin');
  const [deviceMode, setDeviceMode] = useState<'responsive' | 'mobile-frame'>('responsive');
  
  // Student active session state synced with live Firestore
  const [students, setStudents] = useState<Student[]>([]);
  const [activeStudentId, setActiveStudentId] = useState<string>('STU-102');

  useEffect(() => {
    const unsub = subscribeToStudents((liveStudents) => {
      setStudents(liveStudents);
      if (liveStudents.length > 0 && !liveStudents.some((s) => s.studentId === activeStudentId)) {
        setActiveStudentId(liveStudents[0].studentId);
      }
    });
    return () => unsub();
  }, [activeStudentId]);

  useEffect(() => {
    if (user?.role) {
      setCurrentRole(user.role);
    }
  }, [user]);

  const currentStudent =
    students.find((s) => s.studentId === activeStudentId) || students[0] || INITIAL_STUDENTS[0];

  const handleLogin = (role: UserRole, _email: string) => {
    setCurrentRole(role);
    if (role === 'warden' || role === 'super_admin') {
      setCurrentScreen('warden-dashboard');
    } else {
      setCurrentScreen('student-dashboard');
    }
  };

  const handleLogout = async () => {
    await authLogout();
    setCurrentScreen('login');
  };

  const handleUpdateAttendance = async (status: 'IN' | 'OUT' | 'Pending') => {
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (currentStudent && currentStudent.id) {
      try {
        await updateStudentAttendanceInDb(currentStudent.id, status, timeNow);
      } catch (err) {
        console.warn('Live attendance update note:', err);
      }
    }
    setStudents((prev) =>
      prev.map((s) =>
        s.studentId === currentStudent.studentId
          ? {
              ...s,
              attendanceStatus: status,
              attendanceTime: status === 'IN' ? timeNow : s.attendanceTime,
              outTime: status === 'OUT' ? timeNow : s.outTime,
              lastUpdated: timeNow,
            }
          : s
      )
    );
  };

  const handleSelectRole = (role: UserRole) => {
    setCurrentRole(role);
    if (role === 'warden' && (currentScreen === 'student-dashboard' || currentScreen === 'location-setup' || currentScreen === 'attendance-history')) {
      setCurrentScreen('warden-dashboard');
    } else if (role === 'student' && (currentScreen === 'warden-dashboard' || currentScreen === 'student-management' || currentScreen === 'attendance-monitoring' || currentScreen === 'hostel-settings')) {
      setCurrentScreen('student-dashboard');
    }
  };

  const isMobileOptimizedScreen =
    currentScreen === 'student-dashboard' ||
    currentScreen === 'location-setup' ||
    currentScreen === 'attendance-history' ||
    currentScreen === 'login';

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Universal Screen Switcher Bar */}
      <ScreenSwitcher
        currentScreen={currentScreen}
        onSelectScreen={setCurrentScreen}
        currentRole={currentRole}
        onSelectRole={handleSelectRole}
        deviceMode={deviceMode}
        onToggleDeviceMode={() =>
          setDeviceMode((prev) => (prev === 'responsive' ? 'mobile-frame' : 'responsive'))
        }
      />

      {/* Main Screen Canvas */}
      <main className="flex-1 flex flex-col bg-surface overflow-x-hidden">
        {deviceMode === 'mobile-frame' && isMobileOptimizedScreen ? (
          // Realistic Mobile Chassis Frame Simulator
          <div className="flex-1 bg-neutral-900 py-8 px-4 flex items-center justify-center min-h-[calc(100vh-45px)]">
            <div className="w-full max-w-[420px] bg-black rounded-[48px] p-3 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] border-[6px] border-neutral-700/80 relative transition-all">
              {/* Phone Speaker & Dynamic Island */}
              <div className="absolute top-6 left-1/2 -translate-x-1/2 h-5 w-28 bg-black rounded-full z-50 flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-neutral-800 ml-auto mr-2"></div>
              </div>

              {/* Status bar mock */}
              <div className="bg-white rounded-t-[36px] pt-3 px-6 pb-1 text-[11px] font-semibold text-neutral-800 flex items-center justify-between select-none">
                <span>9:41</span>
                <div className="flex items-center gap-1.5 text-neutral-600">
                  <span className="material-symbols-outlined text-[13px]">signal_cellular_4_bar</span>
                  <span className="material-symbols-outlined text-[13px]">wifi</span>
                  <span className="material-symbols-outlined text-[14px]">battery_full</span>
                </div>
              </div>

              {/* Screen Content Wrapper */}
              <div className="overflow-y-auto max-h-[780px] rounded-b-[36px] bg-surface custom-scrollbar">
                {currentScreen === 'login' && (
                  <Screen1Login onNavigate={setCurrentScreen} onLogin={handleLogin} />
                )}
                {currentScreen === 'student-dashboard' && (
                  <Screen2StudentDashboard
                    student={currentStudent}
                    onNavigate={setCurrentScreen}
                    onUpdateAttendance={handleUpdateAttendance}
                  />
                )}
                {currentScreen === 'location-setup' && (
                  <Screen3LocationSetup onNavigate={setCurrentScreen} />
                )}
                {currentScreen === 'attendance-history' && (
                  <Screen4AttendanceHistory onNavigate={setCurrentScreen} />
                )}
              </div>

              {/* Home indicator bar */}
              <div className="h-4 w-full flex items-center justify-center bg-white rounded-b-[36px] pb-1">
                <div className="h-1 w-32 bg-neutral-300 rounded-full"></div>
              </div>
            </div>
          </div>
        ) : (
          // Full Responsive Viewport
          <div className="flex-1 w-full flex flex-col">
            {currentScreen === 'login' && (
              <Screen1Login onNavigate={setCurrentScreen} onLogin={handleLogin} />
            )}
            {currentScreen === 'student-dashboard' && (
              <Screen2StudentDashboard
                student={currentStudent}
                onNavigate={setCurrentScreen}
                onUpdateAttendance={handleUpdateAttendance}
              />
            )}
            {currentScreen === 'location-setup' && (
              <Screen3LocationSetup onNavigate={setCurrentScreen} />
            )}
            {currentScreen === 'attendance-history' && (
              <Screen4AttendanceHistory onNavigate={setCurrentScreen} />
            )}
            {currentScreen === 'warden-dashboard' && (
              <Screen5WardenDashboard onNavigate={setCurrentScreen} onLogout={handleLogout} />
            )}
            {currentScreen === 'student-management' && (
              <Screen6StudentManagement onNavigate={setCurrentScreen} onLogout={handleLogout} />
            )}
            {currentScreen === 'attendance-monitoring' && (
              <Screen7AttendanceMonitoring onNavigate={setCurrentScreen} onLogout={handleLogout} />
            )}
            {currentScreen === 'hostel-settings' && (
              <Screen8HostelSettings onNavigate={setCurrentScreen} onLogout={handleLogout} />
            )}
            {currentScreen === 'terms-privacy' && (
              <Screen9TermsPrivacy
                onNavigate={setCurrentScreen}
                onLogout={handleLogout}
                initialRole={currentRole}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
