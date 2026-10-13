import React, { useState, useEffect } from 'react';
import { AppScreen, Student } from '../../types';
import { exportAttendanceToCsv } from '../../lib/hostel-service';
import { useAuth } from '../../context/AuthContext';
import { subscribeToStudents, updateStudentAttendanceInDb } from '../../lib/db-seed';

interface Screen7AttendanceMonitoringProps {
  onNavigate: (screen: AppScreen) => void;
  onLogout: () => void;
}

type TabType = 'all' | 'exceptions' | 'checked-in' | 'checked-out';

export const Screen7AttendanceMonitoring: React.FC<Screen7AttendanceMonitoringProps> = ({
  onNavigate,
  onLogout,
}) => {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [roomFilter, setRoomFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  useEffect(() => {
    const unsub = subscribeToStudents((liveList) => {
      setStudents(liveList);
      if (liveList.length > 0 && !selectedStudent) {
        setSelectedStudent(liveList[0]);
      }
    });
    return () => unsub();
  }, []);

  // Modals & Drawers
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditStatus, setAuditStatus] = useState<'present' | 'extended' | 'absent'>('present');
  const [auditReason, setAuditReason] = useState('room-physical');
  const [auditNote, setAuditNote] = useState(
    'Inspected Room B-204 in person during night floor sweep. Resident present and studying. Resident device was charging.'
  );
  const [requireCoSignature, setRequireCoSignature] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredStudents = students.filter((stu) => {
    const matchesSearch =
      stu.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stu.rollNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stu.studentId.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRoom =
      roomFilter === 'all'
        ? true
        : roomFilter === 'A'
        ? stu.block === 'Block A'
        : roomFilter === 'B'
        ? stu.block === 'Block B'
        : stu.block === 'Block C';

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'checked-in'
        ? stu.attendanceStatus === 'IN'
        : statusFilter === 'checked-out'
        ? stu.attendanceStatus === 'OUT'
        : statusFilter === 'pending'
        ? stu.attendanceStatus === 'Pending'
        : stu.attendanceStatus === 'Exception';

    const matchesTab =
      activeTab === 'all'
        ? true
        : activeTab === 'exceptions'
        ? stu.attendanceStatus !== 'IN'
        : activeTab === 'checked-in'
        ? stu.attendanceStatus === 'IN'
        : stu.attendanceStatus === 'OUT';

    return matchesSearch && matchesRoom && matchesStatus && matchesTab;
  });

  const handleOpenReview = (stu: Student) => {
    setSelectedStudent(stu);
    setIsDetailsDrawerOpen(true);
  };

  const handleOpenAuditModal = (stu: Student) => {
    setSelectedStudent(stu);
    setIsAuditModalOpen(true);
  };

  const handleSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setIsAuditModalOpen(false);

    const timeFormatted = `${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Manual Audit)`;
    const targetStatus = auditStatus === 'present' ? 'IN' : auditStatus === 'extended' ? 'Late' : 'Exception';

    // Update student status locally
    setStudents((prev) =>
      prev.map((s) =>
        s.id === selectedStudent.id
          ? {
              ...s,
              attendanceStatus: targetStatus,
              attendanceTime: timeFormatted,
              notes: auditNote,
            }
          : s
      )
    );

    try {
      const { checkInResident } = await import('../../lib/attendance-service');
      const { getMockUserForRole } = await import('../../lib/auth');
      const actor = user || getMockUserForRole('warden');
      await checkInResident({
        studentId: selectedStudent.studentId,
        studentDocId: selectedStudent.id,
        hostelId: selectedStudent.hostelId || 'HST-SUN-01',
        location: {
          latitude: 31.95785,
          longitude: 77.10955,
          accuracyMeters: 5,
          timestamp: new Date().toISOString(),
          isMocked: false,
          address: 'Physical Roll-Call Desk',
        },
        actor,
        forceManualAuditOverride: true,
        overrideReason: auditNote || 'Manual physical roll-call by Warden on duty',
      });
      await updateStudentAttendanceInDb(selectedStudent.id, targetStatus, timeFormatted, auditNote);
    } catch (err) {
      console.warn('Attendance audit note:', err);
      await updateStudentAttendanceInDb(selectedStudent.id, targetStatus, timeFormatted, auditNote);
    }

    showToast(`Manual audit recorded for ${selectedStudent.name}. Logged under Warden audit ledger.`);
  };

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen flex">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 flex pointer-events-none">
          <div className="bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium">
            <span className="material-symbols-outlined text-primary-fixed text-lg">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Left Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 hidden lg:flex flex-col justify-between border-r border-outline-variant/30">
        <div className="flex flex-col">
          <div className="p-4 flex flex-col gap-1 border-b border-surface-container">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm">
                <span className="material-symbols-outlined text-[20px]">verified_user</span>
              </div>
              <div className="flex flex-col">
                <span className="font-title-md text-title-md font-bold text-on-surface tracking-tight leading-tight">
                  HostelGuard
                </span>
                <span className="font-code-sm text-code-sm text-secondary">v2.4 NightAudit</span>
              </div>
            </div>
            <div className="mt-1 px-2 py-1 rounded-lg bg-surface-container-low flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-tertiary">domain</span>
              <span className="font-label-xs text-label-xs text-on-surface-variant truncate">
                Warden Portal · North Campus
              </span>
            </div>
          </div>

          <div className="px-4 py-2">
            <span className="font-label-xs text-label-xs text-secondary tracking-wider uppercase font-semibold">
              Operations
            </span>
          </div>

          <nav className="flex flex-col gap-1 px-4">
            <button
              type="button"
              onClick={() => onNavigate('warden-dashboard')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md transition-colors text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">dashboard</span>
              <span>Overview</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-sm shadow-xs text-left"
            >
              <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
              <span className="flex-1">Attendance Monitoring</span>
              <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('student-management')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md transition-colors text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">school</span>
              <span>Student Management</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('hostel-settings')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md transition-colors text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">history</span>
              <span>Reports &amp; History</span>
            </button>
          </nav>

          <div className="px-4 pt-4 pb-2">
            <span className="font-label-xs text-label-xs text-secondary tracking-wider uppercase font-semibold">
              Administration
            </span>
          </div>
          <nav className="flex flex-col gap-1 px-4">
            <button
              type="button"
              onClick={() => onNavigate('hostel-settings')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md transition-colors text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">settings</span>
              <span>Hostel Settings</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('terms-privacy')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md transition-colors text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">policy</span>
              <span>Legal Center</span>
            </button>
          </nav>
        </div>

        <div className="p-4 bg-surface-container-low/60 m-4 rounded-xl flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              <span className="font-label-xs text-label-xs text-on-surface-variant">Night Roll-Call Active</span>
            </div>
            <span className="font-code-sm text-code-sm text-secondary">23:14</span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-surface-container-lowest text-error hover:bg-error-container hover:text-on-error-container transition-colors font-label-md text-label-md shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span>Logout / Switch</span>
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Header */}
        <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-30 flex items-center justify-between px-6 border-b border-surface-container">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface">
              <span className="material-symbols-outlined text-[18px] text-primary">apartment</span>
              <div className="flex flex-col text-left">
                <span className="font-title-sm text-title-sm font-semibold leading-tight">Sunrise Boys Hostel</span>
                <span className="font-label-xs text-label-xs text-secondary leading-tight">Active · 120 Students</span>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface">
              <span className="material-symbols-outlined text-[18px] text-secondary">calendar_today</span>
              <span className="font-label-md text-label-md">Today · Oct 24, 2026</span>
            </div>
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-fixed">
              <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
              <span className="font-label-xs text-label-xs font-semibold">Session Active (10:00 PM - 12:00 AM)</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-right">
              <div className="hidden sm:flex flex-col">
                <span className="font-title-sm text-title-sm text-on-surface leading-tight font-semibold">
                  Warden Sharma
                </span>
                <span className="font-code-sm text-code-sm text-secondary leading-tight">ID: W-402</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs">
                WS
              </div>
            </div>
          </div>
        </header>

        {/* Main Body */}
        <main className="relative pt-20 pb-16 px-4 md:px-8 bg-surface min-h-screen flex flex-col gap-6">
          {/* Operational Control Strip */}
          <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 text-secondary font-label-xs text-label-xs tracking-wider uppercase">
                  <span>Operations Hub</span>
                  <span>/</span>
                  <span>Night Roll-Call</span>
                  <span>/</span>
                  <span className="text-primary font-semibold">Active Monitoring</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight font-bold">
                    Attendance Monitoring
                  </h1>
                  <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-code-sm text-xs font-medium">
                    Session #NC-2410
                  </span>
                </div>
                <p className="font-body-md text-body-md text-secondary mt-0.5">
                  Monitor student check-ins, check-outs, and pending attendance for Sunrise Boys Hostel.
                </p>
              </div>

              {/* Action Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center bg-surface-container-low rounded-xl p-1 shadow-xs">
                  <button className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:bg-surface-container">
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  <div className="flex items-center gap-1.5 px-3 py-1 font-label-md text-label-md text-on-surface font-semibold">
                    <span className="material-symbols-outlined text-[16px] text-primary">calendar_month</span>
                    <span>Today (24 Oct 2026)</span>
                  </div>
                  <button className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:bg-surface-container">
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5 bg-surface-container-low px-3 py-1.5 rounded-xl text-secondary font-code-sm text-xs">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                  <span>Live Sync · 30s</span>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary-container text-on-secondary-fixed shadow-xs">
                  <span className="material-symbols-outlined text-[18px] text-primary">bedtime</span>
                  <div className="flex flex-col">
                    <span className="font-label-xs text-[10px] leading-none font-bold uppercase">Active Session</span>
                    <span className="font-code-sm text-xs leading-tight">
                      10:00 PM – 12:00 AM · <strong className="text-primary font-bold">01h 38m left</strong>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const sessionRecords = students.map((s) => ({
                      id: `att_${s.id}`,
                      refId: `#ATT-${s.studentId}`,
                      studentId: s.studentId,
                      date: new Date().toISOString().slice(0, 10),
                      status:
                        s.attendanceStatus === 'IN'
                          ? ('Confirmed IN' as const)
                          : s.attendanceStatus === 'OUT'
                          ? ('Declared OUT' as const)
                          : ('Pending / Unconfirmed' as const),
                      confirmationTime: s.attendanceTime || '',
                      capturedAddress: s.lastLocationSnapshot || 'Sunrise Boys Hostel',
                      accuracy: s.locationAccuracy || '±12m',
                      method: 'Geofence Hardware Ping',
                    }));
                    const csv = exportAttendanceToCsv(sessionRecords, students);
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.setAttribute('href', url);
                    link.setAttribute('download', `HostelGuard_Monitoring_Session_${new Date().toISOString().slice(0, 10)}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    showToast('Exported live session attendance records to CSV.');
                  }}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-sm font-semibold cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">file_download</span>
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-sm font-semibold cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  <span>Print Sheet</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Filter Presets Strip */}
          <div className="bg-surface-container-lowest p-2.5 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-secondary font-label-xs font-semibold">
              <span className="material-symbols-outlined text-[18px] text-primary">filter_alt</span>
              <span className="uppercase tracking-wider">Quick Presets:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setIsDetailsDrawerOpen(false);
                  setIsAuditModalOpen(false);
                }}
                className="px-3 py-1 rounded-lg font-label-xs font-semibold bg-primary text-on-primary shadow-xs cursor-pointer"
              >
                Normal Roster View
              </button>
              <button
                type="button"
                onClick={() => {
                  if (students.length > 0) setSelectedStudent(students[0]);
                  setIsDetailsDrawerOpen(true);
                  setIsAuditModalOpen(false);
                }}
                className="px-3 py-1 rounded-lg font-label-xs font-semibold bg-surface-container-low text-on-surface-variant hover:bg-surface-container cursor-pointer"
              >
                Details Drawer Open
              </button>
              <button
                type="button"
                onClick={() => {
                  if (students.length > 0) setSelectedStudent(students[0]);
                  setIsAuditModalOpen(true);
                  setIsDetailsDrawerOpen(false);
                }}
                className="px-3 py-1 rounded-lg font-label-xs font-semibold bg-surface-container-low text-on-surface-variant hover:bg-surface-container cursor-pointer"
              >
                Manual Audit Modal
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('NonExistentQueryXYZ');
                }}
                className="px-3 py-1 rounded-lg font-label-xs font-semibold bg-surface-container-low text-on-surface-variant hover:bg-surface-container cursor-pointer"
              >
                Empty / Mismatch State
              </button>
            </div>
          </div>

          {/* KPI Summary Grid (4 Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-secondary uppercase tracking-wider font-semibold">Total Residents</span>
                <span className="w-8 h-8 rounded-lg bg-surface-container-low text-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">group</span>
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-headline-lg font-bold text-on-surface">120</span>
                <span className="font-label-sm text-secondary font-medium">Allocated beds</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 font-label-xs text-secondary">
                <span className="w-2 h-2 rounded-full bg-secondary"></span>
                <span>100% active residents registered</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-secondary uppercase tracking-wider font-semibold">
                  Checked In (Roll-Call)
                </span>
                <span className="w-8 h-8 rounded-lg bg-secondary-container text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-headline-lg font-bold text-on-surface">86</span>
                <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-code-sm font-semibold">
                  71.7%
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 font-label-xs text-primary font-semibold">
                <span className="material-symbols-outlined text-[14px]">my_location</span>
                <span>Geofence / Pin Verified</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-secondary uppercase tracking-wider font-semibold">Checked Out</span>
                <span className="w-8 h-8 rounded-lg bg-surface-container-low text-tertiary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">exit_to_app</span>
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-headline-lg font-bold text-on-surface">12</span>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-code-sm font-semibold">
                  10.0%
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 font-label-xs text-secondary">
                <span className="material-symbols-outlined text-[14px] text-tertiary">fact_check</span>
                <span>Authorized Leave Passes</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-secondary uppercase tracking-wider font-semibold">Pending Triage</span>
                <span className="w-8 h-8 rounded-lg bg-error-container text-on-error-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">priority_high</span>
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-headline-lg font-bold text-error">22</span>
                <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-code-sm font-semibold">
                  18.3%
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 font-label-xs text-error font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping"></span>
                <span>17 Awaiting · 5 Offline/Unreachable</span>
              </div>
            </div>
          </div>

          {/* Table Container & Filter Surface */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm flex flex-col overflow-hidden">
            {/* Tabbed Rail */}
            <div className="p-4 flex flex-wrap items-center justify-between gap-4 bg-surface-container-low/40">
              <div className="flex items-center bg-surface-container p-1 rounded-xl gap-1">
                {(
                  [
                    ['all', 'All Attendance (120)'],
                    ['exceptions', 'Exceptions & Triage (22)'],
                    ['checked-in', 'Checked In (86)'],
                    ['checked-out', 'Checked Out (12)'],
                  ] as [TabType, string][]
                ).map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded-lg font-label-sm font-semibold transition-all cursor-pointer ${
                      activeTab === tab
                        ? 'bg-surface-container-lowest text-on-surface shadow-xs font-bold'
                        : 'text-secondary hover:text-on-surface'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-secondary font-code-sm text-xs">
                <span className="material-symbols-outlined text-[16px] text-primary">security</span>
                <span>Policy: Roll-call closed at 00:00 sharp</span>
              </div>
            </div>

            {/* Search & Filters */}
            <div className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[260px] max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-secondary">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by student name, roll number, or ID..."
                  className="w-full pl-10 pr-4 py-2 bg-surface-container-low rounded-xl text-on-surface placeholder:text-secondary focus:bg-surface-container-lowest focus:outline-none focus:ring-1 focus:ring-primary text-body-sm"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={roomFilter}
                  onChange={(e) => setRoomFilter(e.target.value)}
                  className="bg-surface-container-low px-3 py-2 rounded-xl font-label-sm text-on-surface focus:outline-none cursor-pointer"
                >
                  <option value="all">All Rooms</option>
                  <option value="A">Block A</option>
                  <option value="B">Block B</option>
                  <option value="C">Block C</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-surface-container-low px-3 py-2 rounded-xl font-label-sm text-on-surface focus:outline-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="checked-in">Checked In</option>
                  <option value="checked-out">Checked Out</option>
                  <option value="pending">Pending</option>
                  <option value="exception">Offline Exception</option>
                </select>

                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setRoomFilter('all');
                    setStatusFilter('all');
                    setActiveTab('all');
                  }}
                  className="px-3 py-2 text-secondary hover:text-primary font-label-sm font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">filter_alt_off</span>
                  <span>Clear Filters</span>
                </button>
              </div>
            </div>

            {/* Table */}
            {filteredStudents.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center px-4">
                <span className="material-symbols-outlined text-[36px] text-secondary mb-2">filter_list_off</span>
                <h3 className="font-title-md font-bold text-on-surface">No students match current filter criteria</h3>
                <p className="font-body-sm text-secondary max-w-sm mt-1">
                  Try clearing your search parameters to view all active residents.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setRoomFilter('all');
                    setStatusFilter('all');
                    setActiveTab('all');
                  }}
                  className="mt-3 px-4 py-2 bg-primary text-on-primary rounded-xl font-label-md cursor-pointer"
                >
                  Reset Filter Selections
                </button>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-secondary font-label-xs uppercase tracking-wider">
                      <th className="py-3 px-4 font-semibold">Student Name &amp; Identity</th>
                      <th className="py-3 px-4 font-semibold">Room</th>
                      <th className="py-3 px-4 font-semibold">IN Status</th>
                      <th className="py-3 px-4 font-semibold">IN Time</th>
                      <th className="py-3 px-4 font-semibold">OUT Status</th>
                      <th className="py-3 px-4 font-semibold">OUT Time</th>
                      <th className="py-3 px-4 font-semibold">Last Location Snapshot</th>
                      <th className="py-3 px-4 font-semibold">Updated</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container text-on-surface font-body-md">
                    {filteredStudents.map((stu) => (
                      <tr
                        key={stu.id}
                        onClick={() => handleOpenReview(stu)}
                        className={`hover:bg-surface-container-low/50 transition-colors group cursor-pointer ${
                          stu.attendanceStatus === 'Exception' ? 'bg-error-container/15' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="relative w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center font-title-sm text-primary font-bold overflow-hidden shadow-xs">
                              {stu.avatarUrl ? (
                                <img src={stu.avatarUrl} alt={stu.name} className="w-full h-full object-cover" />
                              ) : (
                                stu.avatarInitials
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-title-sm font-semibold text-on-surface group-hover:text-primary transition-colors">
                                {stu.name}
                              </span>
                              <span className="font-code-sm text-xs text-secondary">
                                {stu.studentId} · {stu.rollNo}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-code-sm text-xs px-2 py-0.5 rounded-lg bg-surface-container font-semibold">
                            {stu.room}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {stu.attendanceStatus === 'IN' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed font-label-xs font-semibold">
                              <span className="material-symbols-outlined text-[12px] text-primary">verified</span>
                              Hostel Geofence Valid
                            </span>
                          ) : stu.attendanceStatus === 'Late' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-xs font-semibold">
                              <span className="material-symbols-outlined text-[12px]">schedule</span>
                              Ext Approved (+45m)
                            </span>
                          ) : stu.attendanceStatus === 'Exception' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container font-label-xs font-bold">
                              <span className="material-symbols-outlined text-[12px]">phonelink_erase</span>
                              Offline / Battery Dead
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container font-label-xs font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                              Pending Verification
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-code-sm text-xs text-secondary">
                          {stu.attendanceTime || '—'}
                        </td>
                        <td className="py-3 px-4 font-body-sm text-xs text-secondary">
                          {stu.outPass || '—'}
                        </td>
                        <td className="py-3 px-4 font-code-sm text-xs text-secondary">
                          {stu.outTime || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1 text-on-surface font-body-sm">
                            <span className="material-symbols-outlined text-[16px] text-tertiary">pin_drop</span>
                            <span className="truncate max-w-[160px]">{stu.lastLocationSnapshot || 'Unavailable'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-code-sm text-xs text-secondary">{stu.lastUpdated}</td>
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenReview(stu)}
                              className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-xs font-semibold cursor-pointer"
                            >
                              Review
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenAuditModal(stu)}
                              className="p-1 rounded-lg text-secondary hover:bg-surface-container-high hover:text-primary transition-colors cursor-pointer"
                              title="Manual Audit Override"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit_note</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Footer */}
            <div className="p-4 bg-surface-container-low/40 flex flex-wrap items-center justify-between gap-3 border-t border-surface-container">
              <span className="font-label-sm text-secondary">
                Showing 1–{filteredStudents.length} of 120 records · Sunrise Boys Hostel (Wardens: 2 on duty)
              </span>
              <div className="flex items-center gap-1 font-label-sm">
                <button
                  type="button"
                  disabled
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary opacity-40 cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <button className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary text-on-primary font-semibold shadow-xs">
                  1
                </button>
                <button className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:bg-surface-container">
                  2
                </button>
                <button className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:bg-surface-container">
                  3
                </button>
                <span className="px-1 text-secondary">…</span>
                <button className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:bg-surface-container">
                  15
                </button>
                <button className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:bg-surface-container">
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Student Details Slide-Over Drawer */}
      {isDetailsDrawerOpen && selectedStudent && (
        <div
          className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex justify-end"
          onClick={() => setIsDetailsDrawerOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-surface-container-lowest h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar */}
            <div className="p-6 bg-surface-container-low flex items-start justify-between border-b border-surface-container">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold text-title-md shadow-xs overflow-hidden">
                  {selectedStudent.avatarUrl ? (
                    <img src={selectedStudent.avatarUrl} alt={selectedStudent.name} className="w-full h-full object-cover" />
                  ) : (
                    selectedStudent.avatarInitials
                  )}
                </div>
                <div className="flex flex-col">
                  <h2 className="font-title-md text-title-md text-on-surface font-bold leading-tight">
                    {selectedStudent.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5 font-code-sm text-xs">
                    <span className="text-secondary">{selectedStudent.studentId} ({selectedStudent.rollNo})</span>
                    <span className="text-outline-variant">·</span>
                    <span className="font-semibold text-primary">Room {selectedStudent.room}</span>
                  </div>
                  <span className="font-label-xs text-secondary mt-0.5">
                    Sunrise Boys Hostel · 2nd Floor Wing
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailsDrawerOpen(false)}
                className="p-1 rounded-lg text-secondary hover:bg-surface-container hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-5">
              {/* Status Indicator */}
              <div className="p-4 rounded-xl bg-surface-container-low flex items-center justify-between">
                <span className="font-label-sm text-secondary">Current Session Verification</span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-fixed font-label-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  {selectedStudent.attendanceStatus === 'IN' ? 'Confirmed IN' : selectedStudent.attendanceStatus}
                </span>
              </div>

              {/* FCM Push Box */}
              <div className="p-4 rounded-xl bg-surface-container flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">mark_chat_read</span>
                <div className="flex flex-col">
                  <span className="font-title-sm font-semibold text-on-surface">FCM Push Health: Delivered</span>
                  <p className="font-body-sm text-secondary mt-0.5">
                    Automated night roll-call push notification acknowledged by resident device ({selectedStudent.device}) at 10:05 PM IST.
                  </p>
                  <span className="font-code-sm text-[11px] text-tertiary mt-1">
                    Firebase Delivery ID: msg_882910_ack
                  </span>
                </div>
              </div>

              {/* Times Panel */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-surface-container-low flex flex-col">
                  <span className="font-label-xs text-secondary uppercase tracking-wider font-semibold">Check-In Time</span>
                  <span className="font-headline-sm font-bold text-on-surface mt-1">
                    {selectedStudent.attendanceTime || '—'}
                  </span>
                  <span className="font-body-sm text-secondary text-xs mt-0.5">Geofence validation: In-Radius</span>
                </div>
                <div className="p-4 rounded-xl bg-surface-container-low flex flex-col">
                  <span className="font-label-xs text-secondary uppercase tracking-wider font-semibold">Check-Out Time</span>
                  <span className="font-headline-sm font-bold text-on-surface mt-1">
                    {selectedStudent.outTime || '—'}
                  </span>
                  <span className="font-body-sm text-secondary text-xs mt-0.5">{selectedStudent.outPass || 'No day passes filed'}</span>
                </div>
              </div>

              {/* Location Card with Map */}
              <div className="rounded-xl bg-surface-container-low p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-on-surface font-title-sm font-semibold">
                    <span className="material-symbols-outlined text-[18px] text-primary">pin_drop</span>
                    <span>Last Captured Location</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-secondary font-code-sm text-[11px]">
                    Point-in-Time
                  </span>
                </div>

                <div
                  className="w-full h-36 rounded-xl bg-cover bg-center shadow-inner relative overflow-hidden"
                  style={{
                    backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuDvTywO85GAqufJ6-XmjpAVOtElRvWyTHjE5V1j_3eh99CvIHO4sOA6Nk8iXNRw2zPyqZMTD0tT5a23qPAduQ9OoD7XDaizeRPCZomsV-oLfXihZmAEHRgJCODAc0MhE9qrxYBMddVtXDhWicxur42AwXxKxjdQq2pHDZFN2jz16YIRRklcIebvIxabNybgDMJutfOjAh6MzvMuuAUBDi91TKBxpiApRnR7IgWuyahmGLxNPqktgbOP')`,
                  }}
                >
                  <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                    <div className="p-2 rounded-full bg-primary text-on-primary shadow-lg animate-bounce">
                      <span className="material-symbols-outlined text-[20px]">location_on</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 bg-surface-container-lowest p-3 rounded-lg text-body-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-secondary">Capture Coordinates:</span>
                    <span className="font-code-sm text-xs font-semibold text-on-surface">31.9578° N, 77.1095° E</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-secondary">Reported Accuracy:</span>
                    <span className="font-code-sm text-xs font-semibold text-on-surface">±20m fix (Mobile GPS)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-secondary">Geo Reverse Address:</span>
                    <span className="font-medium text-on-surface truncate max-w-[200px]">
                      {selectedStudent.lastLocationSnapshot || 'Dhalpur, Kullu, HP'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-secondary">Timestamp:</span>
                    <span className="font-code-sm text-xs text-primary font-semibold">10:15 PM IST</span>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="flex flex-col gap-2">
                <span className="font-label-sm text-secondary uppercase tracking-wider font-semibold">
                  Today's Session Sequence
                </span>
                <div className="relative pl-6 flex flex-col gap-3 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-container-high">
                  <div className="relative flex flex-col">
                    <span className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-primary ring-4 ring-surface-container-lowest"></span>
                    <span className="font-code-sm text-xs font-semibold text-on-surface">10:00 PM</span>
                    <span className="font-body-sm text-xs text-secondary">Attendance session opened</span>
                  </div>
                  <div className="relative flex flex-col">
                    <span className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-primary ring-4 ring-surface-container-lowest"></span>
                    <span className="font-code-sm text-xs font-semibold text-on-surface">10:05 PM</span>
                    <span className="font-body-sm text-xs text-secondary">Automated FCM reminder push delivered</span>
                  </div>
                  <div className="relative flex flex-col">
                    <span className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-tertiary ring-4 ring-surface-container-lowest"></span>
                    <span className="font-code-sm text-xs font-semibold text-on-surface">10:15 PM</span>
                    <span className="font-body-sm text-xs text-secondary">Location snapshot queried: Dhalpur, Kullu</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-surface-container-low flex flex-col gap-2 border-t border-surface-container">
              <button
                type="button"
                onClick={() => {
                  setIsDetailsDrawerOpen(false);
                  setIsAuditModalOpen(true);
                }}
                className="w-full py-2.5 rounded-xl bg-primary text-on-primary font-label-md font-semibold hover:bg-primary-container transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">verified_user</span>
                <span>Perform Manual Attendance Audit</span>
              </button>
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailsDrawerOpen(false);
                    onNavigate('attendance-history');
                  }}
                  className="font-label-sm text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>View Full History</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDetailsDrawerOpen(false)}
                  className="font-label-sm text-secondary hover:text-on-surface cursor-pointer"
                >
                  Close Panel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Audit Correction Modal */}
      {isAuditModalOpen && selectedStudent && (
        <div
          className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setIsAuditModalOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-surface-container-lowest rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 bg-surface-container-low flex items-start justify-between border-b border-surface-container">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[20px]">edit_calendar</span>
                </div>
                <div className="flex flex-col">
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Manual Attendance Audit</h3>
                  <span className="font-code-sm text-xs text-secondary">
                    Override Record for: {selectedStudent.name} ({selectedStudent.studentId} · Room {selectedStudent.room})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                className="p-1 rounded-lg text-secondary hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="px-6 py-2.5 bg-secondary-container text-on-secondary-fixed flex items-center gap-2 text-body-sm">
              <span className="material-symbols-outlined text-primary text-[18px]">gavel</span>
              <span>Every manual change creates an immutable audit trail logged with Warden ID <strong>W-402</strong>.</span>
            </div>

            <form onSubmit={handleSaveAudit} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm font-semibold text-on-surface-variant">Assign Verified Status</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAuditStatus('present')}
                    className={`py-2 px-3 rounded-lg font-label-sm font-semibold transition-all cursor-pointer ${
                      auditStatus === 'present'
                        ? 'bg-secondary-container text-primary ring-2 ring-primary'
                        : 'bg-surface-container-low text-secondary hover:bg-surface-container-high'
                    }`}
                  >
                    Mark Present
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditStatus('extended')}
                    className={`py-2 px-3 rounded-lg font-label-sm font-semibold transition-all cursor-pointer ${
                      auditStatus === 'extended'
                        ? 'bg-secondary-container text-primary ring-2 ring-primary'
                        : 'bg-surface-container-low text-secondary hover:bg-surface-container-high'
                    }`}
                  >
                    Curfew Extended
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditStatus('absent')}
                    className={`py-2 px-3 rounded-lg font-label-sm font-semibold transition-all cursor-pointer ${
                      auditStatus === 'absent'
                        ? 'bg-error-container text-error ring-2 ring-error'
                        : 'bg-surface-container-low text-secondary hover:bg-surface-container-high'
                    }`}
                  >
                    Mark Absent
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm font-semibold text-on-surface-variant">
                  Explanatory Verification Reason *
                </label>
                <select
                  value={auditReason}
                  onChange={(e) => setAuditReason(e.target.value)}
                  className="w-full bg-surface-container-low px-4 py-2.5 rounded-xl font-body-md text-on-surface focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="room-physical">Physical Room Check (Verified Present by Warden)</option>
                  <option value="late-warden">Late Entry with Prior Warden Verbal Permission</option>
                  <option value="medical">Medical Emergency / Campus Infirmary Visit</option>
                  <option value="battery">Phone Battery Dead / Hardware Malfunction Verified</option>
                  <option value="sports">University Official Contingent Duty</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm font-semibold text-on-surface-variant">
                  Mandatory Warden Audit Note *
                </label>
                <textarea
                  rows={3}
                  value={auditNote}
                  onChange={(e) => setAuditNote(e.target.value)}
                  required
                  placeholder="Document reason for manual override..."
                  className="w-full bg-surface-container-low p-3 rounded-xl text-on-surface font-body-md focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                />
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={requireCoSignature}
                  onChange={(e) => setRequireCoSignature(e.target.checked)}
                  className="mt-0.5 rounded text-primary focus:ring-primary cursor-pointer"
                />
                <div className="flex flex-col">
                  <span className="font-label-md font-semibold text-on-surface">
                    Require Resident Co-signature on Morning Roll Call
                  </span>
                  <span className="font-body-sm text-secondary text-xs">
                    Student will be notified to confirm override via biometric or physical ledger signature before 09:00 AM.
                  </span>
                </div>
              </label>

              <div className="p-6 bg-surface-container-low flex items-center justify-end gap-3 -mx-6 -mb-6 mt-2 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setIsAuditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-container text-on-surface font-label-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary text-on-primary font-label-md font-semibold hover:bg-primary-container shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  <span>Save Manual Audit Entry</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
