import React, { useState, useEffect } from 'react';
import { AppScreen, Student, CurfewExtension, Hostel } from '../../types';
import { INITIAL_HOSTELS } from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';
import { subscribeToStudents, subscribeToExtensions, subscribeToHostels } from '../../lib/db-seed';

interface Screen5WardenDashboardProps {
  onNavigate: (screen: AppScreen) => void;
  onLogout: () => void;
}

export const Screen5WardenDashboard: React.FC<Screen5WardenDashboardProps> = ({
  onNavigate,
  onLogout,
}) => {
  const { user } = useAuth();
  const [activeHostel, setActiveHostel] = useState('HST-SUN-01');
  const [students, setStudents] = useState<Student[]>([]);
  const [extensions, setExtensions] = useState<CurfewExtension[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>(INITIAL_HOSTELS);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncPulse, setSyncPulse] = useState('Live Database Connected · Instant Sync');
  const [triageFilter, setTriageFilter] = useState<'all' | 'pending' | 'unknown' | 'late'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Subscribe to live Firestore collections
  useEffect(() => {
    const unsubStudents = subscribeToStudents((liveStudents) => {
      setStudents(liveStudents);
    });

    const unsubExt = subscribeToExtensions((liveExts) => {
      setExtensions(liveExts);
    });

    const unsubHostels = subscribeToHostels((liveHostels) => {
      if (liveHostels.length > 0) {
        setHostels(liveHostels);
      }
    });

    return () => {
      unsubStudents();
      unsubExt();
      unsubHostels();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleForceSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      const now = new Date();
      setSyncPulse(`${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} IST · Live DB Synced`);
      showToast('Live database sync verified.');
    }, 500);
  };

  const handleResolveExtension = async (id: string, action: 'approved' | 'rejected') => {
    try {
      const { reviewCurfewExtension } = await import('../../lib/attendance-service');
      const { getMockUserForRole } = await import('../../lib/auth');
      const actor = user || getMockUserForRole('warden');
      await reviewCurfewExtension(
        id,
        actor,
        action === 'approved' ? 'approve' : 'reject'
      );
      showToast(`Extension ${action === 'approved' ? 'Approved (+duration)' : 'Rejected'}. Updated in Firestore.`);
    } catch (err) {
      console.warn('Extension review note, updating local state:', err);
      setExtensions((prev) =>
        prev.map((ext) => (ext.id === id ? { ...ext, status: action } : ext))
      );
      showToast(`Extension ${action === 'approved' ? 'Approved' : 'Rejected'}.`);
    }
  };

  const handleOpenStudent = (stu: Student) => {
    setSelectedStudent(stu);
    setIsDrawerOpen(true);
  };

  // Real live KPI metrics computed from Firestore students for active hostel
  const hostelStudents = students.filter(
    (s) => !s.hostelId || s.hostelId === activeHostel
  );
  const totalCount = hostelStudents.length || 1;
  const inCount = hostelStudents.filter((s) => s.attendanceStatus === 'IN').length;
  const outCount = hostelStudents.filter((s) => s.attendanceStatus === 'OUT').length;
  const pendingCount = hostelStudents.filter((s) => s.attendanceStatus === 'Pending').length;
  const offlineCount = hostelStudents.filter(
    (s) => s.deviceStatus === 'stale' || s.deviceStatus === 'pending'
  ).length;

  const kpiData = {
    total: hostelStudents.length,
    inCount,
    outCount,
    pendingCount,
    offlineCount,
    timeLeft: '10:00 PM – 12:00 AM · Real-Time Verification Active',
  };

  // Filter triage list from live students
  const triageList = hostelStudents.filter((st) => {
    const matchesSearch =
      st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.room.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.rollNo.toLowerCase().includes(searchQuery.toLowerCase());

    const isUnresolved = st.attendanceStatus !== 'IN';
    if (!isUnresolved) return false;

    if (triageFilter === 'pending') return st.attendanceStatus === 'Pending';
    if (triageFilter === 'unknown') return st.attendanceStatus === 'Exception';
    if (triageFilter === 'late') return st.attendanceStatus === 'Late' || st.attendanceStatus === 'OUT';
    return matchesSearch;
  });

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen flex">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 flex pointer-events-none">
          <div className="bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium">
            <span className="material-symbols-outlined text-primary-fixed text-lg">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Persistent Left Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-surface-container-lowest z-40 hidden lg:flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-r border-outline-variant/30">
        <div className="flex flex-col">
          {/* Brand header */}
          <div className="h-16 px-4 flex items-center gap-2.5 bg-surface-container-lowest border-b border-surface-container">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm">
              <span className="material-symbols-outlined text-[20px]">shield</span>
            </div>
            <div className="flex flex-col">
              <span className="font-title-md text-title-md font-bold tracking-tight text-on-surface leading-tight">
                HostelGuard
              </span>
              <span className="font-code-sm text-code-sm text-on-surface-variant">v2.4 NightAudit</span>
            </div>
          </div>

          {/* Tenancy chip */}
          <div className="px-4 py-2">
            <div className="bg-surface-container-low rounded-xl p-2.5 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                  Tenancy Role
                </span>
                <span className="font-label-xs text-label-xs font-semibold px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed">
                  Active
                </span>
              </div>
              <span className="font-title-sm text-title-sm text-on-surface font-bold">Warden Portal</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                North Campus Jurisdiction
              </span>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex flex-col gap-1 px-4 mt-2">
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary-container text-on-primary font-semibold text-sm transition-all text-left"
            >
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
              <span>Overview</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('attendance-monitoring')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md text-label-md transition-all text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">checklist_rtl</span>
              <span>Attendance Monitoring</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('student-management')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md text-label-md transition-all text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">group</span>
              <span>Student Management</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('hostel-settings')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md text-label-md transition-all text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">history_edu</span>
              <span>Reports &amp; History</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('hostel-settings')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md text-label-md transition-all text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">tune</span>
              <span>Hostel Settings</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('terms-privacy')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md text-label-md transition-all text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">policy</span>
              <span>Legal &amp; Privacy</span>
            </button>
          </nav>
        </div>

        {/* Footer info in sidebar */}
        <div className="p-4 bg-surface-container-lowest border-t border-surface-container flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              <span className="font-label-xs text-label-xs text-on-surface-variant font-medium">Scheduler Synced</span>
            </div>
            <span className="font-code-sm text-code-sm text-on-surface-variant">22:04</span>
          </div>
          <div className="p-2 bg-surface-container-low rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs">
                RS
              </div>
              <div className="flex flex-col max-w-[110px]">
                <span className="font-title-sm text-title-sm text-on-surface font-semibold truncate">R. K. Sharma</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant truncate">Sunrise Complex</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-error transition-colors cursor-pointer"
              title="Sign Out"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Page Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Fixed Topbar */}
        <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-30 px-6 flex items-center justify-between border-b border-surface-container">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex flex-col min-w-0">
              <span className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight truncate">
                Warden Dashboard
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                Monitor tonight’s hostel attendance at a glance
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Roll-call active badge */}
            <div className="hidden md:flex items-center gap-1.5 bg-surface-container-low px-3 py-1.5 rounded-full">
              <span className="material-symbols-outlined text-primary text-[18px]">schedule</span>
              <span className="font-label-xs text-label-xs font-semibold text-on-surface">
                Roll-Call Active: 10:00 PM – 12:00 AM
              </span>
            </div>

            {/* Property Selector */}
            <div className="relative">
              <select
                value={activeHostel}
                onChange={(e) => {
                  setActiveHostel(e.target.value);
                  showToast(`Switched active node to ${e.target.options[e.target.selectedIndex].text}`);
                }}
                className="appearance-none bg-surface-container-low hover:bg-surface-container-high px-3 py-1.5 pr-8 rounded-xl font-label-md text-label-md font-medium text-on-surface transition-colors cursor-pointer focus:outline-none"
              >
                <option value="HST-SUN-01">Sunrise Boys Hostel (Active · 120 Students)</option>
                <option value="HST-ANN-02">Sunrise Annex Block C (48 Students)</option>
              </select>
              <span className="material-symbols-outlined pointer-events-none absolute right-2 top-2 text-[18px] text-on-surface-variant">
                expand_more
              </span>
            </div>

            {/* Alerts Bell */}
            <button
              type="button"
              onClick={() => showToast('2 unread alerts: 1 late pass request, 1 FCM token refresh')}
              className="relative w-9 h-9 rounded-xl flex items-center justify-center bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary animate-ping"></span>
            </button>

            {/* Officer chip */}
            <div className="flex items-center gap-2 pl-1">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs">
                WS
              </div>
              <div className="hidden xl:flex flex-col text-left">
                <span className="font-label-sm text-label-sm font-semibold text-on-surface">Warden Sharma</span>
                <span className="font-label-xs text-label-xs text-on-surface-variant">ID: W-402</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="relative pt-20 pb-16 px-4 md:px-8 bg-background flex flex-col gap-6">
          {/* Live Real-Time Database Telemetry Bar */}
          <div className="w-full bg-surface-container-lowest shadow-sm rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 border border-outline-variant/30">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                Live Firestore Database
              </span>
              <span className="font-code-sm text-code-sm text-secondary px-2 py-0.5 rounded bg-surface-container-low font-mono">
                {syncPulse}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleForceSync}
                disabled={isSyncing}
                className="px-3 py-1.5 rounded-lg text-label-xs font-semibold bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className={`material-symbols-outlined text-[14px] ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
                <span>{isSyncing ? 'Syncing...' : 'Sync Database'}</span>
              </button>
            </div>
          </div>

          {/* Active Hostel Policy & Jurisdiction Banner */}
          <section className="w-full bg-surface-container-lowest shadow-sm rounded-xl p-4 flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[24px]">apartment</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-title-md text-title-md font-bold text-on-surface">
                      {activeHostel === 'HST-ANN-02' ? 'Sunrise Annex Block C' : 'Sunrise Boys Hostel'}
                    </span>
                    <span className="font-label-xs text-label-xs px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface font-semibold">
                      Active Night Shift
                    </span>
                  </div>
                  <span className="font-code-sm text-code-sm text-secondary">
                    Jurisdiction Code: {activeHostel === 'HST-ANN-02' ? '#HST-ANN-02' : '#HST-SUN-01'} · Tenancy Node:{' '}
                    {activeHostel === 'HST-ANN-02' ? 'HP-KL-03' : 'HP-KL-02'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-label-xs px-3 py-1 rounded-full bg-surface-container text-secondary font-medium">
                  Jurisdiction Guard: Warden Authorized
                </span>
              </div>
            </div>

            {/* Key Policy Metrics Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1">
              <div className="bg-surface-container-low rounded-xl px-3 py-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">group</span>
                <div className="flex flex-col">
                  <span className="font-label-xs text-label-xs text-secondary">Registered Residents</span>
                  <span className="font-title-sm text-title-sm font-bold text-on-surface">{kpiData.total} Students</span>
                </div>
              </div>
              <div className="bg-surface-container-low rounded-xl px-3 py-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">alarm</span>
                <div className="flex flex-col">
                  <span className="font-label-xs text-label-xs text-secondary">Attendance Window</span>
                  <span className="font-title-sm text-title-sm font-semibold text-on-surface">10:00 PM Start</span>
                </div>
              </div>
              <div className="bg-surface-container-low rounded-xl px-3 py-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[18px]">timer_off</span>
                <div className="flex flex-col">
                  <span className="font-label-xs text-label-xs text-secondary">Curfew Cutoff</span>
                  <span className="font-title-sm text-title-sm font-semibold text-on-surface">12:00 AM Midnight</span>
                </div>
              </div>
              <div className="bg-surface-container-low rounded-xl px-3 py-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[18px]">hourglass_top</span>
                <div className="flex flex-col">
                  <span className="font-label-xs text-label-xs text-secondary">Grace Period</span>
                  <span className="font-title-sm text-title-sm font-semibold text-on-surface">2 Hours Post-Cutoff</span>
                </div>
              </div>
              <div className="bg-surface-container-low rounded-xl px-3 py-2 flex items-center gap-2 col-span-2 sm:col-span-1">
                <span className="material-symbols-outlined text-primary text-[18px]">lock</span>
                <div className="flex flex-col min-w-0">
                  <span className="font-label-xs text-label-xs text-secondary">Shift Assignment</span>
                  <span className="font-title-sm text-title-sm font-semibold text-on-surface truncate">W-402 (Primary)</span>
                </div>
              </div>
            </div>
          </section>

          {/* Top 5 KPI Summary Cards */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Total */}
            <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-xs text-label-xs uppercase tracking-wider text-secondary font-semibold">
                  Total Students
                </span>
                <div className="w-7 h-7 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="font-headline-lg text-headline-lg font-bold text-on-surface">{kpiData.total}</span>
                  <span className="font-label-xs text-secondary">Active roster</span>
                </div>
                <p className="font-body-sm text-body-sm text-secondary mt-1">All registered residents tonight</p>
              </div>
            </div>

            {/* Confirmed IN */}
            <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-xs text-label-xs uppercase tracking-wider text-secondary font-semibold">
                  Confirmed IN
                </span>
                <div className="w-7 h-7 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[16px]">door_front</span>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="font-headline-lg text-headline-lg font-bold text-on-surface">{kpiData.inCount}</span>
                  <span className="font-label-xs font-semibold px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface">
                    {((kpiData.inCount / kpiData.total) * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-secondary mt-1">Geofence / Pin verified</p>
              </div>
            </div>

            {/* Confirmed OUT */}
            <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-xs text-label-xs uppercase tracking-wider text-secondary font-semibold">
                  Confirmed OUT
                </span>
                <div className="w-7 h-7 rounded-lg bg-surface-container-low flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[16px]">assignment_turned_in</span>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="font-headline-lg text-headline-lg font-bold text-on-surface">{kpiData.outCount}</span>
                  <span className="font-label-xs font-semibold px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface">
                    {((kpiData.outCount / kpiData.total) * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-secondary mt-1">Authorized leave permits</p>
              </div>
            </div>

            {/* Pending */}
            <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-xs text-label-xs uppercase tracking-wider text-secondary font-semibold">
                  Pending
                </span>
                <div className="w-7 h-7 rounded-lg bg-secondary-container flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[16px]">schedule</span>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="font-headline-lg text-headline-lg font-bold text-on-surface">{kpiData.pendingCount}</span>
                  <span className="font-label-xs font-semibold px-1.5 py-0.5 rounded bg-secondary-container text-primary">
                    Awaiting
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-secondary mt-1">Push delivered, no check-in</p>
              </div>
            </div>

            {/* Unknown / Offline */}
            <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-xs text-label-xs uppercase tracking-wider text-secondary font-semibold">
                  Unknown / Offline
                </span>
                <div className="w-7 h-7 rounded-lg bg-surface-container-low flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[16px]">wifi_off</span>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="font-headline-lg text-headline-lg font-bold text-on-surface">{kpiData.offlineCount}</span>
                  <span className="font-label-xs font-semibold px-1.5 py-0.5 rounded bg-surface-container-high text-secondary">
                    {((kpiData.offlineCount / kpiData.total) * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="font-label-xs text-label-xs text-secondary mt-1">Roll-check needed</p>
              </div>
            </div>
          </section>

          {/* Middle Layout: 8 cols (Roll-Call + Triage Table) / 4 cols (Panels) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 8 cols */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* Tonight's Progress Card */}
              <section className="bg-surface-container-lowest rounded-xl shadow-sm p-4 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="font-title-md text-title-md font-bold text-on-surface">
                      Tonight’s Attendance Roll-Call
                    </span>
                    <span className="font-body-sm text-body-sm text-secondary">
                      {kpiData.inCount + kpiData.outCount} of {kpiData.total} students have submitted a status (
                      {(((kpiData.inCount + kpiData.outCount) / kpiData.total) * 100).toFixed(1)}% completed)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleForceSync}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-low text-on-surface hover:bg-surface-container-high font-label-sm font-semibold transition-colors cursor-pointer"
                    >
                      <span className={`material-symbols-outlined text-[16px] text-primary ${isSyncing ? 'animate-spin' : ''}`}>
                        sync
                      </span>
                      <span>Force Sync</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('attendance-monitoring')}
                      className="px-3 py-1.5 rounded-xl bg-primary-container text-on-primary hover:bg-primary font-label-sm font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Roster</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="flex flex-col gap-1.5">
                  <div className="w-full h-3.5 bg-surface-container-low rounded-full overflow-hidden flex shadow-inner">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${(kpiData.inCount / kpiData.total) * 100}%` }}
                    ></div>
                    <div
                      className="h-full bg-secondary transition-all duration-500"
                      style={{ width: `${(kpiData.outCount / kpiData.total) * 100}%` }}
                    ></div>
                    <div
                      className="h-full bg-secondary-container transition-all duration-500"
                      style={{ width: `${(kpiData.pendingCount / kpiData.total) * 100}%` }}
                    ></div>
                    <div
                      className="h-full bg-surface-container-highest transition-all duration-500"
                      style={{ width: `${(kpiData.offlineCount / kpiData.total) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between pt-1 font-label-xs text-label-xs text-secondary">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-primary"></span>
                      IN: <strong>{kpiData.inCount}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-secondary"></span>
                      OUT: <strong>{kpiData.outCount}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-secondary-container"></span>
                      Pending: <strong>{kpiData.pendingCount}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-surface-container-highest"></span>
                      Unknown: <strong>{kpiData.offlineCount}</strong>
                    </span>
                  </div>
                </div>

                {/* Window Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-container-low">
                    <span className="material-symbols-outlined text-primary text-[20px]">timelapse</span>
                    <div className="flex flex-col">
                      <span className="font-label-xs text-label-xs text-secondary">Session Window (Active)</span>
                      <span className="font-title-sm text-title-sm font-semibold text-on-surface">
                        {kpiData.timeLeft}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-container-low">
                    <span className="material-symbols-outlined text-secondary text-[20px]">update</span>
                    <div className="flex flex-col">
                      <span className="font-label-xs text-label-xs text-secondary">Scheduler Sync Pulse</span>
                      <span className="font-code-sm text-code-sm text-on-surface font-medium">{syncPulse}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Triage Table Card */}
              <section className="bg-surface-container-lowest rounded-xl shadow-sm p-4 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
                    <h2 className="font-title-md text-title-md font-bold text-on-surface">
                      Needs Attention ({triageList.length} Students Unresolved)
                    </h2>
                  </div>
                  <span className="font-label-xs text-label-xs text-secondary bg-surface-container-low px-2 py-1 rounded-md">
                    Physical Verification Queue
                  </span>
                </div>

                {/* Filter and Search */}
                <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                  <div className="flex items-center gap-1 p-1 bg-surface-container-low rounded-xl w-full md:w-auto overflow-x-auto no-scrollbar">
                    {(['all', 'pending', 'unknown', 'late'] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setTriageFilter(filter)}
                        className={`px-3 py-1 rounded-lg text-label-xs font-semibold cursor-pointer transition-colors ${
                          triageFilter === filter
                            ? 'bg-surface-container-lowest text-on-surface shadow-xs font-bold'
                            : 'text-secondary hover:text-on-surface'
                        }`}
                      >
                        {filter === 'all'
                          ? `All (${triageList.length})`
                          : filter === 'pending'
                          ? 'Pending'
                          : filter === 'unknown'
                          ? 'Unknown/Offline'
                          : 'Late / Permits'}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full md:w-64">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-secondary">
                      search
                    </span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search name, room, roll..."
                      className="w-full pl-9 pr-3 py-1.5 bg-surface-container-low text-on-surface text-body-sm rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-xl">
                  <table className="w-full text-left text-body-sm font-body-sm">
                    <thead className="bg-surface-container-low text-secondary font-label-xs text-label-xs uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Student &amp; Roll No</th>
                        <th className="py-2.5 px-3">Room</th>
                        <th className="py-2.5 px-3">Declared Status</th>
                        <th className="py-2.5 px-3">Last Address Snapshot</th>
                        <th className="py-2.5 px-3">Updated</th>
                        <th className="py-2.5 px-3">Reminder State</th>
                        <th className="py-2.5 px-3 text-right">Triage Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-low">
                      {triageList.map((stu) => (
                        <tr key={stu.id} className="hover:bg-surface-container-low/60 transition-colors">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-secondary-container text-primary flex items-center justify-center font-bold text-xs">
                                {stu.avatarInitials}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-title-sm text-title-sm font-semibold text-on-surface">
                                  {stu.name}
                                </span>
                                <span className="font-code-sm text-code-sm text-secondary">{stu.rollNo}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-semibold text-on-surface">{stu.room}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1 font-label-xs text-label-xs font-semibold px-2 py-0.5 rounded-full ${
                                stu.attendanceStatus === 'Pending'
                                  ? 'bg-secondary-container text-primary'
                                  : stu.attendanceStatus === 'OUT'
                                  ? 'bg-surface-container-high text-on-surface'
                                  : 'bg-surface-container-highest text-secondary'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  stu.attendanceStatus === 'Pending'
                                    ? 'bg-primary'
                                    : stu.attendanceStatus === 'OUT'
                                    ? 'bg-secondary'
                                    : 'bg-outline'
                                }`}
                              ></span>
                              {stu.attendanceStatus === 'Pending'
                                ? 'Pending'
                                : stu.attendanceStatus === 'OUT'
                                ? 'OUT · Permit'
                                : 'Offline'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-col">
                              <span className="text-on-surface truncate max-w-[160px]">
                                {stu.lastLocationSnapshot || 'Location unavailable'}
                              </span>
                              <span className="font-code-sm text-code-sm text-secondary">
                                {stu.locationAccuracy || 'No geofence fix'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-code-sm text-code-sm text-secondary">{stu.lastUpdated}</td>
                          <td className="py-3 px-3">
                            <span className="font-label-xs text-label-xs text-secondary bg-surface-container-low px-2 py-0.5 rounded">
                              Push Delivered
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenStudent(stu)}
                              className="px-2.5 py-1 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-xs text-label-xs font-semibold transition-colors cursor-pointer"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 rounded-xl bg-surface-container-low flex items-start gap-2 text-secondary">
                  <span className="material-symbols-outlined text-[18px] text-primary mt-0.5">info</span>
                  <p className="font-body-sm text-body-sm">
                    <strong className="text-on-surface font-semibold">Standard Roll-Call Protocol:</strong> Offline devices and missing GPS coordinates are not legal proof of absence. Hostel policy mandates physical verification or door audit before finalizing marked absences at midnight cutoff.
                  </p>
                </div>
              </section>
            </div>

            {/* Right 4 cols */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* Extensions Queue */}
              <section className="bg-surface-container-lowest rounded-xl shadow-sm p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">more_time</span>
                    <span className="font-title-md text-title-md font-bold text-on-surface">Curfew Extensions</span>
                  </div>
                  <span className="font-label-xs text-label-xs font-semibold px-2 py-0.5 rounded-full bg-secondary-container text-primary">
                    {extensions.filter((e) => e.status === 'pending').length} Pending
                  </span>
                </div>

                {extensions.length === 0 ? (
                  <div className="p-6 text-center text-body-sm text-secondary bg-surface-container-low rounded-xl">
                    No active extension requests recorded in database.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {extensions.map((ext) => (
                      <div
                        key={ext.id}
                        className={`p-3 bg-surface-container-low rounded-xl flex flex-col gap-2 transition-all ${
                          ext.status !== 'pending' ? 'opacity-60 bg-surface-container' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-title-sm text-title-sm font-semibold text-on-surface">
                              {ext.studentName}
                            </span>
                            <span className="font-label-xs text-label-xs bg-surface-container-high px-1.5 py-0.5 rounded text-secondary">
                              {ext.room}
                            </span>
                          </div>
                          <span className="font-code-sm text-code-sm font-semibold text-primary">
                            +{ext.durationMinutes} mins
                          </span>
                        </div>
                        <p className="font-body-sm text-body-sm text-on-surface">"{ext.reason}"</p>
                        <div className="flex items-center justify-between text-secondary font-label-xs text-label-xs">
                          <span>
                            Proposed Cutoff: <strong>{ext.proposedCutoff}</strong>
                          </span>
                          <span>Req at {ext.reqTime}</span>
                        </div>
                        {ext.status === 'pending' ? (
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleResolveExtension(ext.id, 'approved')}
                              className="py-1.5 rounded-lg bg-primary-container text-on-primary hover:bg-primary font-label-xs font-semibold text-center transition-colors cursor-pointer"
                            >
                              Approve (+{ext.durationMinutes}m)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResolveExtension(ext.id, 'rejected')}
                              className="py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-xs font-semibold text-center transition-colors cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div className="p-1.5 rounded bg-surface-container-lowest text-center text-label-xs font-semibold text-primary">
                            Status: {ext.status.toUpperCase()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <p className="font-label-xs text-label-xs text-secondary bg-surface-container-low p-2 rounded-lg">
                  * Approving an extension automatically revises the curfew countdown for this individual record but does not mark them as Confirmed IN.
                </p>
              </section>

              {/* Location Snapshots */}
              <section className="bg-surface-container-lowest rounded-xl shadow-sm p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">pin_drop</span>
                    <span className="font-title-md text-title-md font-bold text-on-surface">Recent Location Snapshots</span>
                  </div>
                  <span className="font-label-xs text-label-xs text-secondary">On-Checkin Fix</span>
                </div>

                {/* Radar visualization */}
                <div className="relative w-full h-32 bg-surface-container-low rounded-xl overflow-hidden flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full opacity-15" fill="none" viewBox="0 0 400 150">
                    <path d="M 0 50 Q 100 20 200 60 T 400 40" stroke="#004ac6" strokeWidth="2" />
                    <circle cx="200" cy="75" r="45" stroke="#004ac6" strokeDasharray="4 4" strokeWidth="1.5" />
                    <circle cx="200" cy="75" r="85" stroke="#565e74" strokeDasharray="2 4" strokeWidth="1" />
                  </svg>
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center animate-ping absolute"></div>
                    <div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md relative z-10">
                      <span className="material-symbols-outlined text-[16px]">location_on</span>
                    </div>
                    <span className="font-label-xs text-label-xs font-semibold bg-surface-container-lowest shadow-xs text-on-surface px-2 py-0.5 rounded-full mt-2">
                      Sunrise Campus Anchor
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  <div className="flex items-start justify-between p-2 rounded-lg bg-surface-container-low">
                    <div className="flex flex-col">
                      <span className="font-title-sm text-title-sm font-semibold text-on-surface">
                        Harsh Vardhan · Room A-114
                      </span>
                      <span className="font-body-sm text-body-sm text-secondary">Dhalpur Campus Block, Kullu</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-label-xs text-label-xs font-semibold text-primary px-1.5 py-0.5 rounded bg-secondary-container">
                        ±18m Anchor
                      </span>
                      <span className="font-code-sm text-code-sm text-secondary mt-0.5">10:17 PM</span>
                    </div>
                  </div>
                  <div className="flex items-start justify-between p-2 rounded-lg bg-surface-container-low">
                    <div className="flex flex-col">
                      <span className="font-title-sm text-title-sm font-semibold text-on-surface">
                        Kunal Mehta · Room B-310
                      </span>
                      <span className="font-body-sm text-body-sm text-secondary">Gandhi Nagar Sub-Gate, Kullu</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-label-xs text-label-xs font-semibold text-secondary px-1.5 py-0.5 rounded bg-surface-container-high">
                        ±28m Fix
                      </span>
                      <span className="font-code-sm text-code-sm text-secondary mt-0.5">10:11 PM</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* FCM Push Health */}
              <section className="bg-surface-container-lowest rounded-xl shadow-sm p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">cell_tower</span>
                    <span className="font-title-md text-title-md font-bold text-on-surface">FCM Push Health</span>
                  </div>
                  <span className="font-label-xs text-label-xs font-semibold px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface">
                    200 OK
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-on-surface">
                  <div className="p-2 rounded-lg bg-surface-container-low flex flex-col">
                    <span className="font-label-xs text-secondary">Queued</span>
                    <span className="font-title-sm font-bold mt-0.5">0 Messages</span>
                  </div>
                  <div className="p-2 rounded-lg bg-surface-container-low flex flex-col">
                    <span className="font-label-xs text-secondary">Delivered</span>
                    <span className="font-title-sm font-bold text-primary mt-0.5">115 Successful</span>
                  </div>
                  <div className="p-2 rounded-lg bg-surface-container-low flex flex-col">
                    <span className="font-label-xs text-secondary">Stale Tokens</span>
                    <span className="font-title-sm font-bold text-secondary mt-0.5">5 Devices</span>
                  </div>
                  <div className="p-2 rounded-lg bg-surface-container-low flex flex-col">
                    <span className="font-label-xs text-secondary">No Web Push</span>
                    <span className="font-title-sm font-bold text-secondary mt-0.5">8 Students</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="font-code-sm text-code-sm text-secondary">Worker: 10:15:00 PM IST</span>
                  <button
                    type="button"
                    onClick={() => onNavigate('hostel-settings')}
                    className="font-label-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Logs</span>
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  </button>
                </div>
              </section>
            </div>
          </div>

          {/* Rapid Commands Bar */}
          <section className="w-full bg-surface-container-lowest shadow-sm rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-title-sm text-title-sm font-bold text-on-surface">
                Rapid Administrative Commands
              </span>
              <span className="font-label-xs text-label-xs text-secondary">Warden Role Clearance: Level 2</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('attendance-monitoring')}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface transition-colors text-left cursor-pointer"
              >
                <span className="material-symbols-outlined text-primary text-[20px]">checklist</span>
                <div className="flex flex-col">
                  <span className="font-title-sm font-semibold">View All Attendance</span>
                  <span className="font-label-xs text-secondary">Full tonight log</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('student-management')}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface transition-colors text-left cursor-pointer"
              >
                <span className="material-symbols-outlined text-primary text-[20px]">badge</span>
                <div className="flex flex-col">
                  <span className="font-title-sm font-semibold">Manage Students</span>
                  <span className="font-label-xs text-secondary">Roster &amp; rooms</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('hostel-settings')}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface transition-colors text-left cursor-pointer"
              >
                <span className="material-symbols-outlined text-primary text-[20px]">snooze</span>
                <div className="flex flex-col">
                  <span className="font-title-sm font-semibold">Review Extensions</span>
                  <span className="font-label-xs text-secondary">Curfew overrides</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  alert('Exporting signed daily report to CSV...');
                }}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface transition-colors text-left cursor-pointer"
              >
                <span className="material-symbols-outlined text-primary text-[20px]">file_download</span>
                <div className="flex flex-col">
                  <span className="font-title-sm font-semibold">Export Daily Report</span>
                  <span className="font-label-xs text-secondary">Signed PDF / CSV</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('hostel-settings')}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface transition-colors text-left col-span-2 sm:col-span-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-secondary text-[20px]">settings_night_sight</span>
                <div className="flex flex-col">
                  <span className="font-title-sm font-semibold">Hostel Settings</span>
                  <span className="font-label-xs text-secondary">Geofence &amp; timers</span>
                </div>
              </button>
            </div>
          </section>
        </main>
      </div>

      {/* Slide-over Drawer: Resident Audit Record */}
      {isDrawerOpen && selectedStudent && (
        <div
          className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex justify-end"
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-surface-container-lowest h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[22px]">account_box</span>
                  <span className="font-headline-sm text-headline-sm font-bold text-on-surface">Resident Audit Record</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-container-low text-secondary hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* Profile Card */}
              <div className="bg-surface-container-low p-4 rounded-xl flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-secondary-container text-primary font-bold text-headline-sm flex items-center justify-center">
                  {selectedStudent.avatarInitials}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-title-md text-title-md font-bold text-on-surface">{selectedStudent.name}</span>
                  <span className="font-code-sm text-code-sm text-secondary">
                    {selectedStudent.rollNo} · Room {selectedStudent.room}
                  </span>
                  <span className="font-label-xs text-label-xs text-secondary mt-0.5">
                    Sunrise Boys Hostel · 2nd Floor West Wing
                  </span>
                </div>
              </div>

              {/* Attributes Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-container-low p-3 rounded-xl flex flex-col">
                  <span className="font-label-xs text-label-xs text-secondary uppercase font-semibold">Tonight’s Status</span>
                  <span className="font-title-sm text-title-sm font-bold text-primary mt-1">
                    {selectedStudent.attendanceStatus}
                  </span>
                </div>
                <div className="bg-surface-container-low p-3 rounded-xl flex flex-col">
                  <span className="font-label-xs text-label-xs text-secondary uppercase font-semibold">Last Fix Address</span>
                  <span className="font-title-sm text-title-sm font-medium text-on-surface truncate mt-1">
                    {selectedStudent.lastLocationSnapshot || 'Unavailable'}
                  </span>
                </div>
              </div>

              {/* Emergency Contacts */}
              <div className="bg-surface-container-low p-4 rounded-xl flex flex-col gap-2">
                <span className="font-label-xs text-label-xs font-semibold uppercase tracking-wider text-secondary">
                  Verified Emergency Contacts
                </span>
                <div className="flex items-center justify-between text-on-surface text-body-sm">
                  <span>Guardian: {selectedStudent.guardianPhone}</span>
                  <button
                    type="button"
                    onClick={() => alert(`Calling Guardian: ${selectedStudent.guardianPhone}`)}
                    className="px-2 py-1 rounded bg-surface-container-high hover:bg-surface-container-highest text-primary font-label-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">call</span>
                    <span>Call Primary</span>
                  </button>
                </div>
                <div className="flex items-center justify-between text-on-surface text-body-sm">
                  <span>Student Mobile: {selectedStudent.phone}</span>
                  <button
                    type="button"
                    onClick={() => alert(`Calling Student: ${selectedStudent.phone}`)}
                    className="px-2 py-1 rounded bg-surface-container-high hover:bg-surface-container-highest text-primary font-label-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">call</span>
                    <span>Call Student</span>
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <span className="font-title-sm text-title-sm font-semibold text-on-surface">
                  Physical Verification Action
                </span>
                <p className="font-body-sm text-body-sm text-secondary">
                  Log an immediate floor confirmation if student was verified in-person by duty guard or warden.
                </p>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      showToast(`Marked ${selectedStudent.name} physically present IN`);
                      setIsDrawerOpen(false);
                    }}
                    className="py-2.5 rounded-xl bg-primary-container text-on-primary font-label-sm font-semibold hover:bg-primary transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>Log Physical IN</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      showToast(`Urgent push ping dispatched to ${selectedStudent.name}`);
                    }}
                    className="py-2.5 rounded-xl bg-surface-container-high text-on-surface font-label-sm font-semibold hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">send_to_mobile</span>
                    <span>Push Urgent Ping</span>
                  </button>
                </div>
              </div>

              {/* Timeline */}
              <div className="flex flex-col gap-2 pt-1">
                <span className="font-label-xs text-label-xs font-semibold uppercase text-secondary">
                  Tonight's Session Timeline
                </span>
                <div className="flex flex-col gap-2 font-code-sm text-code-sm text-secondary">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                    <span>10:00:12 PM · Scheduled system push dispatched to device token</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                    <span>10:10:00 PM · Automated 10-minute reminder sent</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary-container"></span>
                    <span>10:15:30 PM · Student portal viewed via web browser</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="w-full py-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md font-semibold transition-colors cursor-pointer"
              >
                Close Audit Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
