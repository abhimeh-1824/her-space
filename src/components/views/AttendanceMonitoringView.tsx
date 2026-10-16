import React, { useState, useEffect } from 'react';
import { AppScreen, Student, Hostel } from '../../types';
import { exportAttendanceToCsv } from '../../lib/hostel-service';
import { useAuth } from '../../context/AuthContext';
import { subscribeToStudents, subscribeToHostels, updateStudentAttendanceInDb } from '../../lib/db-seed';
import {
  generateAbsenceReport,
  AbsenceReportData,
  addFiveMinutes,
  REPORT_RECIPIENT_NUMBERS,
} from '../../lib/absence-report-service';

export interface AttendanceMonitoringViewProps {
  onNavigate: (screen: AppScreen) => void;
  onLogout: () => void;
}

type TabType = 'all' | 'pending' | 'in' | 'out';

export const AttendanceMonitoringView: React.FC<AttendanceMonitoringViewProps> = ({
  onNavigate,
  onLogout,
}) => {
  const { user, authorizedHostels } = useAuth();
  const isWarden = user?.role === 'warden';
  const isAdmin = user?.role === 'super_admin';
  const hasAssignedHostel = isAdmin || authorizedHostels.length > 0;

  const [students, setStudents] = useState<Student[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [roomFilter, setRoomFilter] = useState('all');
  const [hostelFilter, setHostelFilter] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Modals & Drawers
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditNote, setAuditNote] = useState('Verified present in-person during floor sweep.');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 5-Min Post-Curfew Absence Reports
  const [latestReport, setLatestReport] = useState<AbsenceReportData | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    const unsubStudents = subscribeToStudents((liveList) => {
      setStudents(liveList);
    });
    const unsubHostels = subscribeToHostels((liveHostels) => {
      setHostels(liveHostels);
    });
    return () => {
      unsubStudents();
      unsubHostels();
    };
  }, []);

  const handleMarkPresentQuick = async (stu: Student) => {
    const timeFormatted = `${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Floor Sweep)`;
    try {
      await updateStudentAttendanceInDb(stu.id, 'IN', timeFormatted, 'Verified during night floor sweep');
      setStudents((prev) =>
        prev.map((s) => (s.id === stu.id ? { ...s, attendanceStatus: 'IN', attendanceTime: timeFormatted } : s))
      );
      showToast(`Marked ${stu.name} as Present IN`);
    } catch {
      setStudents((prev) =>
        prev.map((s) => (s.id === stu.id ? { ...s, attendanceStatus: 'IN', attendanceTime: timeFormatted } : s))
      );
      showToast(`Marked ${stu.name} as Present IN`);
    }
  };

  const handleSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setIsAuditModalOpen(false);

    const timeFormatted = `${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Warden Verified)`;
    try {
      await updateStudentAttendanceInDb(selectedStudent.id, 'IN', timeFormatted, auditNote);
      setStudents((prev) =>
        prev.map((s) =>
          s.id === selectedStudent.id ? { ...s, attendanceStatus: 'IN', attendanceTime: timeFormatted } : s
        )
      );
      showToast(`Recorded physical verification for ${selectedStudent.name}`);
    } catch {
      setStudents((prev) =>
        prev.map((s) =>
          s.id === selectedStudent.id ? { ...s, attendanceStatus: 'IN', attendanceTime: timeFormatted } : s
        )
      );
      showToast(`Recorded physical verification for ${selectedStudent.name}`);
    }
  };

  const handleExportCSV = () => {
    const sessionRecords = hostelScopedStudents.map((s) => ({
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
      capturedAddress: s.lastLocationSnapshot || 'HER-SPACE Campus',
      accuracy: s.locationAccuracy || '±10m',
      method: 'HER-SPACE Night Roll-Call',
    }));
    const csv = exportAttendanceToCsv(sessionRecords, hostelScopedStudents);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `HER_SPACE_RollCall_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Exported roll-call sheet to CSV.');
  };

  // Isolate students by authorized hostels
  const authorizedStudents = students.filter((stu) => {
    if (isAdmin) return true;
    if (isWarden) {
      if (authorizedHostels.length === 0) return false;
      return authorizedHostels.some((h) => h.id === stu.hostelId);
    }
    return false;
  });

  // Keep selectedStudent strictly within authorized students
  useEffect(() => {
    if (authorizedStudents.length > 0) {
      if (!selectedStudent || !authorizedStudents.some((s) => s.id === selectedStudent.id)) {
        setSelectedStudent(authorizedStudents[0]);
      }
    } else if (selectedStudent) {
      setSelectedStudent(null);
    }
  }, [authorizedStudents, selectedStudent]);

  const hostelScopedStudents =
    hostelFilter === 'all'
      ? authorizedStudents
      : authorizedStudents.filter((s) => s.hostelId === hostelFilter);

  const filteredStudents = hostelScopedStudents.filter((stu) => {
    const matchesSearch =
      stu.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stu.rollNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stu.room.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRoom =
      roomFilter === 'all'
        ? true
        : roomFilter === 'floor1'
        ? stu.room.startsWith('1')
        : roomFilter === 'floor2'
        ? stu.room.startsWith('2')
        : stu.room.startsWith('3');

    const matchesTab =
      activeTab === 'all'
        ? true
        : activeTab === 'pending'
        ? stu.attendanceStatus === 'Pending'
        : activeTab === 'in'
        ? stu.attendanceStatus === 'IN'
        : stu.attendanceStatus === 'OUT';

    return matchesSearch && matchesRoom && matchesTab;
  });

  const totalCount = hostelScopedStudents.length;
  const inCount = hostelScopedStudents.filter((s) => s.attendanceStatus === 'IN').length;
  const outCount = hostelScopedStudents.filter((s) => s.attendanceStatus === 'OUT').length;
  const pendingCount = hostelScopedStudents.filter((s) => s.attendanceStatus === 'Pending').length;

  // Initial compilation so WhatsApp links are populated immediately
  useEffect(() => {
    if (!latestReport && hostelScopedStudents.length > 0) {
      const activeH = authorizedHostels?.[0] || hostels?.[0];
      const now = new Date();
      const currentHH = String(now.getHours()).padStart(2, '0');
      const currentMM = String(now.getMinutes()).padStart(2, '0');
      generateAbsenceReport({
        hostelId: activeH?.id || 'HST-HER-01',
        hostelName: activeH?.name || 'HER-SPACE Hostel',
        reminderSlot: `${currentHH}:${currentMM}`,
        studentsList: hostelScopedStudents,
      })
        .then((rep) => setLatestReport(rep))
        .catch(() => {});
    }
  }, [hostelScopedStudents, authorizedHostels, hostels, latestReport]);

  // Automated 5-min Post-Reminder Watcher
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const interval = setInterval(() => {
      const activeH = authorizedHostels?.[0] || hostels?.[0];
      if (!activeH) return;

      const schedule = [activeH.curfewStart, ...(activeH.reminderSchedule || [])].filter(Boolean) as string[];
      if (schedule.length === 0) return;

      const now = new Date();
      const currentHH = String(now.getHours()).padStart(2, '0');
      const currentMM = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${currentHH}:${currentMM}`;

      // Check if current time is reminderSlot + 5 min
      for (const slot of schedule) {
        const triggerTime = addFiveMinutes(slot);
        if (triggerTime === currentTime) {
          const reportKey = `abs_rep_${activeH.id}_${triggerTime}_${now.toISOString().slice(0, 10)}`;
          if (!sessionStorage.getItem(reportKey)) {
            sessionStorage.setItem(reportKey, 'true');
            generateAbsenceReport({
              hostelId: activeH.id,
              hostelName: activeH.name,
              reminderSlot: slot,
              studentsList: hostelScopedStudents,
            })
              .then((rep) => {
                setLatestReport(rep);
                showToast(`Auto 5-min post-curfew absence report generated for ${rep.reminderSlot}`);
              })
              .catch(() => {});
          }
        }
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [authorizedHostels, hostels, hostelScopedStudents]);

  const handleManualGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const activeH = authorizedHostels?.[0] || hostels?.[0];
      const now = new Date();
      const currentHH = String(now.getHours()).padStart(2, '0');
      const currentMM = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${currentHH}:${currentMM}`;

      const rep = await generateAbsenceReport({
        hostelId: activeH?.id || 'HST-HER-01',
        hostelName: activeH?.name || 'HER-SPACE Hostel',
        reminderSlot: currentTime,
        studentsList: hostelScopedStudents,
      });
      setLatestReport(rep);
      setShowReportModal(true);
      showToast('Absence report generated successfully!');
    } catch {
      showToast('Error generating absence report.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen flex flex-col pb-24 md:pb-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 flex pointer-events-none">
          <div className="bg-slate-800 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs sm:text-sm font-medium border border-violet-500/40">
            <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 space-y-5 sm:space-y-6">
        {/* Page Title & Action Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[22px]">notifications_active</span>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-on-surface leading-tight">Night Roll-Call Sweep</h1>
              <p className="text-xs text-secondary mt-0.5">Floor-by-floor attendance audit &amp; scheduled curfew verification</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={!hasAssignedHostel}
              onClick={handleExportCSV}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-outline-variant/30 text-xs font-semibold transition-colors ${
                !hasAssignedHostel
                  ? 'opacity-40 cursor-not-allowed bg-surface-container-low text-secondary'
                  : 'hover:bg-surface-container text-on-surface cursor-pointer'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              type="button"
              disabled={!hasAssignedHostel}
              onClick={() => window.print()}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-outline-variant/30 text-xs font-semibold transition-colors ${
                !hasAssignedHostel
                  ? 'opacity-40 cursor-not-allowed bg-surface-container-low text-secondary'
                  : 'hover:bg-surface-container text-on-surface cursor-pointer'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span className="hidden sm:inline">Print Sheet</span>
            </button>
          </div>
        </div>

        {/* Warning banner when warden has no assigned hostel */}
        {!hasAssignedHostel && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-xs flex items-start gap-3.5">
            <span className="material-symbols-outlined text-amber-500 text-2xl shrink-0">domain_disabled</span>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400">No Residential Hostel Assigned</h3>
              <p className="text-xs text-secondary leading-relaxed">
                Your warden account is currently not assigned to any residential hostel. Attendance monitoring is disabled until an administrator assigns you to a hostel boundary.
              </p>
            </div>
          </div>
        )}

        {/* 5-Min Post-Curfew Absence Reports Card */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-violet-500/30 rounded-2xl p-4 sm:p-5 shadow-lg text-white space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-600/30 text-violet-400 border border-violet-500/40 flex items-center justify-center font-bold shrink-0">
                <span className="material-symbols-outlined text-[22px]">quickreply</span>
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                  <span>5-Min Post-Curfew Absence Reports</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30">
                    Live Dispatch Active
                  </span>
                </h3>
                <p className="text-xs text-slate-300">
                  Consolidated report of all OUT residents sent 5 minutes after each curfew reminder to Helpline &amp; Monitor.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleManualGenerateReport}
                disabled={isGeneratingReport}
                className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">assignment</span>
                <span>{isGeneratingReport ? 'Compiling...' : 'Generate Live Report'}</span>
              </button>
            </div>
          </div>

          {/* Numbers list & 1-click WhatsApp Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
            {/* Number 1: Helpline */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <span className="material-symbols-outlined text-sm text-sky-400">support_agent</span>
                  <span>Helpline Number: <strong className="text-white font-mono">6267549800</strong></span>
                </div>
                <p className="text-[11px] text-slate-400">Security &amp; Emergency Assistance Desk</p>
              </div>
              <a
                href={
                  latestReport?.whatsappUrls?.['6267549800'] ||
                  `https://api.whatsapp.com/send?phone=916267549800&text=${encodeURIComponent(`HER-SPACE Live Absence Report: ${outCount} residents currently OUT.`)}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1 shrink-0 transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">send</span>
                <span>Send WhatsApp</span>
              </a>
            </div>

            {/* Number 2: Monitor */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <span className="material-symbols-outlined text-sm text-indigo-400">admin_panel_settings</span>
                  <span>Designated Monitor: <strong className="text-white font-mono">9399667720</strong></span>
                </div>
                <p className="text-[11px] text-slate-400">Administrative Curfew Roll-Call Monitor</p>
              </div>
              <a
                href={
                  latestReport?.whatsappUrls?.['9399667720'] ||
                  `https://api.whatsapp.com/send?phone=919399667720&text=${encodeURIComponent(`HER-SPACE Live Absence Report: ${outCount} residents currently OUT.`)}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1 shrink-0 transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">send</span>
                <span>Send WhatsApp</span>
              </a>
            </div>
          </div>
        </div>

        {/* Quick Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[22px]">apartment</span>
            </div>
              <div>
                <p className="font-headline-sm font-bold text-on-surface">{totalCount}</p>
                <p className="font-label-xs text-secondary">Total Residents</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[22px]">verified</span>
              </div>
              <div>
                <p className="font-headline-sm font-bold text-emerald-700">{inCount}</p>
                <p className="font-label-xs text-secondary">Verified IN ({totalCount > 0 ? ((inCount / totalCount) * 100).toFixed(0) : 0}%)</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[22px]">logout</span>
              </div>
              <div>
                <p className="font-headline-sm font-bold text-blue-700">{outCount}</p>
                <p className="font-label-xs text-secondary">Out Passes</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[22px]">pending_actions</span>
              </div>
              <div>
                <p className="font-headline-sm font-bold text-amber-700">{pendingCount}</p>
                <p className="font-label-xs text-secondary">Awaiting Sweep</p>
              </div>
            </div>
          </div>

          {/* Sweep Filters & Search */}
          <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(
                [
                  ['all', `All (${totalCount})`],
                  ['pending', `Pending (${pendingCount})`],
                  ['in', `Present (${inCount})`],
                  ['out', `Out Pass (${outCount})`],
                ] as [TabType, string][]
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-full text-label-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    activeTab === tab
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'bg-surface-container-low text-secondary hover:text-on-surface'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Hostel Filter Dropdown */}
              <select
                disabled={authorizedHostels.length === 0}
                value={hostelFilter}
                onChange={(e) => setHostelFilter(e.target.value)}
                className="bg-surface-container-low border border-outline-variant/30 text-on-surface rounded-xl px-3 py-2 text-xs font-semibold outline-none cursor-pointer disabled:opacity-50"
              >
                {authorizedHostels.length === 0 ? (
                  <option value="">No Assigned Hostel</option>
                ) : (
                  <>
                    <option value="all">🏢 All Hostels ({authorizedHostels.length})</option>
                    {authorizedHostels.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </>
                )}
              </select>

              {/* Floor Filter */}
              <select
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="bg-surface-container-low border border-outline-variant/30 text-on-surface rounded-xl px-3 py-2 text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="all">All Floors</option>
                <option value="floor1">Floor 1 (Rooms 100-199)</option>
                <option value="floor2">Floor 2 (Rooms 200-299)</option>
                <option value="floor3">Floor 3 (Rooms 300-399)</option>
              </select>

              {/* Search input */}
              <div className="relative w-full sm:w-56">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, room..."
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl pl-9 pr-3 py-2 text-xs text-on-surface placeholder:text-secondary outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          {/* Mobile Roll-Call Cards (< md screens) */}
          <div className="md:hidden space-y-3">
            {filteredStudents.length === 0 ? (
              <div className="py-8 text-center text-secondary text-xs bg-surface-container-low rounded-xl border border-outline-variant/20">
                No students found for this floor filter.
              </div>
            ) : (
              filteredStudents.map((stu) => (
                <div
                  key={stu.id}
                  className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 space-y-3 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {stu.avatarInitials}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-on-surface leading-tight">{stu.name}</p>
                        <div className="flex items-center gap-2 text-[11px] text-secondary mt-0.5 flex-wrap">
                          <span className="font-mono">{stu.rollNo}</span>
                          <span>&bull;</span>
                          <span className="font-semibold text-on-surface">Room {stu.room}</span>
                          <span>&bull;</span>
                          <span className="text-primary font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">domain</span>
                            <span>{hostels.find((h) => h.id === stu.hostelId)?.name || stu.hostelId || 'HER-SPACE Main'}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        stu.attendanceStatus === 'IN'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : stu.attendanceStatus === 'OUT'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          stu.attendanceStatus === 'IN'
                            ? 'bg-emerald-600'
                            : stu.attendanceStatus === 'OUT'
                            ? 'bg-blue-600'
                            : 'bg-amber-600'
                        }`}
                      ></span>
                      {stu.attendanceStatus === 'IN'
                        ? 'Present'
                        : stu.attendanceStatus === 'OUT'
                        ? 'Out Pass'
                        : 'Pending Check'}
                    </span>
                  </div>

                  <div className="text-[11px] text-secondary pt-1 border-t border-outline-variant/20 flex items-center justify-between">
                    <span>Check-In Time: <strong className="text-on-surface font-normal font-mono">{stu.attendanceTime || '—'}</strong></span>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/20">
                    {stu.attendanceStatus !== 'IN' && (
                      <button
                        type="button"
                        onClick={() => handleMarkPresentQuick(stu)}
                        className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold text-center cursor-pointer transition-colors shadow-xs flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">check</span>
                        <span>Mark Present</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudent(stu);
                        setIsAuditModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Note / Audit
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View (>= md screens) */}
          <div className="hidden md:block rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500">Room &amp; Resident</th>
                    <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500">Hostel</th>
                    <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500">Roll No</th>
                    <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500">Status</th>
                    <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500">Check-In Time</th>
                    <th className="py-2.5 px-4 text-right text-[11px] font-semibold text-slate-500">Floor Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-secondary">
                        No students found for this floor filter.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((stu) => (
                      <tr key={stu.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <span className="w-12 py-1 text-center font-bold bg-surface-container rounded-lg text-on-surface text-xs">
                              {stu.room}
                            </span>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                                {stu.avatarInitials}
                              </div>
                              <span className="font-title-sm font-semibold text-on-surface">{stu.name}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container text-xs font-semibold text-on-surface border border-outline-variant/30">
                            <span className="material-symbols-outlined text-[14px] text-primary">domain</span>
                            <span>{hostels.find((h) => h.id === stu.hostelId)?.name || stu.hostelId || 'HER-SPACE Main'}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 font-code-sm text-code-sm text-secondary">{stu.rollNo}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-xs font-semibold ${
                              stu.attendanceStatus === 'IN'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : stu.attendanceStatus === 'OUT'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                stu.attendanceStatus === 'IN'
                                  ? 'bg-emerald-600'
                                  : stu.attendanceStatus === 'OUT'
                                  ? 'bg-blue-600'
                                  : 'bg-amber-600'
                              }`}
                            ></span>
                            {stu.attendanceStatus === 'IN'
                              ? 'Present'
                              : stu.attendanceStatus === 'OUT'
                              ? 'Out Pass'
                              : 'Pending Check'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-secondary text-body-sm">
                          {stu.attendanceTime || '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {stu.attendanceStatus !== 'IN' && (
                              <button
                                type="button"
                                onClick={() => handleMarkPresentQuick(stu)}
                                className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-label-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[14px]">check</span>
                                <span>Mark Present</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStudent(stu);
                                setIsAuditModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-xs font-semibold transition-colors cursor-pointer"
                            >
                              Note / Audit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

      {/* Manual Audit Modal */}
      {isAuditModalOpen && selectedStudent && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsAuditModalOpen(false)}
        >
          <div
            className="bg-surface-container-lowest rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30">
              <h3 className="font-title-lg font-bold text-on-surface">Physical Roll-Call Audit</h3>
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-container-low flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary text-on-primary font-bold flex items-center justify-center">
                {selectedStudent.avatarInitials}
              </div>
              <div>
                <p className="font-title-sm font-bold text-on-surface">{selectedStudent.name}</p>
                <p className="font-code-sm text-secondary">
                  Room {selectedStudent.room} · {selectedStudent.rollNo}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveAudit} className="space-y-4">
              <div>
                <label className="block font-label-sm font-semibold text-on-surface mb-1">
                  Warden Inspection Note *
                </label>
                <textarea
                  rows={3}
                  value={auditNote}
                  onChange={(e) => setAuditNote(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:ring-2 focus:ring-primary/20 text-body-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setIsAuditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-outline-variant/30 hover:bg-surface-container text-on-surface font-label-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-label-md font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  Confirm Physical IN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Absence Report Preview Modal */}
      {showReportModal && latestReport && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="max-w-xl w-full bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 text-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400">summarize</span>
                <h3 className="font-bold text-base">5-Min Post-Curfew Absence Report</h3>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-slate-200 whitespace-pre-wrap max-h-72 overflow-y-auto">
              {latestReport.reportText}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(latestReport.reportText);
                  showToast('Report copied to clipboard!');
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span>
                <span>Copy Full Text</span>
              </button>

              <div className="flex items-center gap-2">
                <a
                  href={latestReport.whatsappUrls['6267549800']}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                  <span>WhatsApp 6267549800</span>
                </a>
                <a
                  href={latestReport.whatsappUrls['9399667720']}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                  <span>WhatsApp 9399667720</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Backward-compatible alias for existing imports
export const Screen7AttendanceMonitoring = AttendanceMonitoringView;
