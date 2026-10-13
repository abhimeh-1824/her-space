import React, { useState, useEffect, useMemo } from 'react';
import { AppScreen, AuditLogEntry, Hostel, HostelSettings, Student, AttendanceRecord } from '../../types';
import { INITIAL_AUDIT_LOGS, INITIAL_HOSTELS } from '../../data/mockData';
import {
  getHostelSettings,
  updateHostelSettings,
  getHostelsForUser,
  updateHostelDetails,
  generateAttendanceReport,
  exportAttendanceToCsv,
  exportAuditLogsToCsv,
  getAuditHistory,
} from '../../lib/hostel-service';
import { getMockUserForRole } from '../../lib/auth';
import { useAuth } from '../../context/AuthContext';
import { subscribeToStudents, subscribeToAttendance, subscribeToAuditLogs } from '../../lib/db-seed';

interface Screen8HostelSettingsProps {
  onNavigate: (screen: AppScreen) => void;
  onLogout: () => void;
}

type SettingsTab = 'reports' | 'schedule' | 'notifications' | 'general' | 'audit';
type ProtoState = 'normal' | 'toast' | 'modal' | 'empty' | 'alert';

export const Screen8HostelSettings: React.FC<Screen8HostelSettingsProps> = ({
  onNavigate,
  onLogout,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('reports');
  const [protoState, setProtoState] = useState<ProtoState>('normal');
  const [datePreset, setDatePreset] = useState<'today' | '7d' | '30d' | 'custom'>('30d');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active Hostel Tenancy
  const [activeHostelId, setActiveHostelId] = useState('HST-SUN-01');
  const [hostels, setHostels] = useState<Hostel[]>(INITIAL_HOSTELS);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  // Search and filter for report table
  const [searchQuery, setSearchQuery] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Editable Schedule settings
  const [windowOpen, setWindowOpen] = useState('22:00');
  const [rem1, setRem1] = useState('22:15');
  const [rem2, setRem2] = useState('23:00');
  const [curfewCutoff, setCurfewCutoff] = useState('00:00');
  const [lateProtocol, setLateProtocol] = useState<'warden-req' | 'auto-log' | 'strict-lock'>('warden-req');
  const [missingProtocol, setMissingProtocol] = useState<'physical' | 'call-parent' | 'security-dispatch'>('physical');
  const [allowExtensions, setAllowExtensions] = useState(true);
  const [maxExtensionMins, setMaxExtensionMins] = useState('60');

  // General Property Settings
  const [facilityName, setFacilityName] = useState('Sunrise Boys Hostel');
  const [campusZone, setCampusZone] = useState('North Campus, Complex Block B');
  const [capacity, setCapacity] = useState('120');
  const [primaryWarden, setPrimaryWarden] = useState('W-402');
  const [securityCheckpost, setSecurityCheckpost] = useState('Gate-1');
  const [geofenceRadius, setGeofenceRadius] = useState('150');

  // Audit Ledger State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [auditCategoryFilter, setAuditCategoryFilter] = useState('all');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');

  // Modal edit fields
  const [modalShiftName, setModalShiftName] = useState('Standard Winter Curfew Window');
  const [modalTimeStart, setModalTimeStart] = useState('22:00');
  const [modalTimeCutoff, setModalTimeCutoff] = useState('00:00');
  const [modalReason, setModalReason] = useState(
    'Extended library access authorized for mid-term evaluation week.'
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper to trigger standard RFC CSV download in browser
  const downloadCsv = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Subscribe to live Firestore students, attendance, and audit logs
  useEffect(() => {
    const unsubStudents = subscribeToStudents((liveStudents) => {
      setStudents(liveStudents);
    });
    const unsubAtt = subscribeToAttendance((liveRecords) => {
      setAttendanceRecords(liveRecords);
    });
    const unsubAudit = subscribeToAuditLogs((liveLogs) => {
      setAuditLogs(liveLogs);
    });
    return () => {
      unsubStudents();
      unsubAtt();
      unsubAudit();
    };
  }, []);

  // Load backend hostel settings and audit history on mount / hostel switch
  useEffect(() => {
    async function loadData() {
      try {
        const actor = user || getMockUserForRole('super_admin');
        const userHostels = await getHostelsForUser(actor);
        if (userHostels.length > 0) {
          setHostels(userHostels);
        }
        const settings = await getHostelSettings(activeHostelId);
        setWindowOpen(settings.windowOpen);
        setRem1(settings.reminder1);
        setRem2(settings.reminder2);
        setCurfewCutoff(settings.curfewCutoff);
        setLateProtocol(settings.lateProtocol);
        setMissingProtocol(settings.missingProtocol);
        setAllowExtensions(settings.allowExtensions);
        setMaxExtensionMins(String(settings.maxExtensionMins));
        setFacilityName(settings.hostelName);
        setCampusZone(settings.campusZone);
        setCapacity(String(settings.capacity));
        setPrimaryWarden(settings.primaryWarden.includes('W-402') ? 'W-402' : 'W-415');
        setGeofenceRadius(String(settings.geofenceRadiusMeters));

        const history = await getAuditHistory(activeHostelId);
        if (history.length > 0) {
          setAuditLogs(history);
        }
      } catch (err) {
        console.warn('Live hostel settings load note:', err);
      }
    }
    loadData();
  }, [activeHostelId, user]);

  // Dynamic reports generation using live Firestore students and attendance records
  const reportData = useMemo(() => {
    return generateAttendanceReport(
      {
        hostelId: activeHostelId,
        datePreset,
        searchQuery,
        room: roomFilter,
        status: statusFilter,
      },
      students.length > 0 ? students : undefined,
      attendanceRecords.length > 0 ? attendanceRecords : undefined
    );
  }, [activeHostelId, datePreset, searchQuery, roomFilter, statusFilter, students, attendanceRecords]);

  const handleProtoState = (state: ProtoState) => {
    setProtoState(state);
    if (state === 'toast') {
      showToast('Live Database Sync Verified: Changes to Sunrise Boys Hostel distributed instantly.');
    } else if (state === 'modal') {
      setIsModalOpen(true);
    } else {
      setIsModalOpen(false);
    }
  };

  // Real CSV Export for attendance report with live students
  const handleExportAttendanceCsv = () => {
    try {
      const csv = exportAttendanceToCsv(reportData.records, students);
      const filename = `HostelGuard_Attendance_${activeHostelId}_${datePreset}_${new Date().toISOString().slice(0, 10)}.csv`;
      downloadCsv(filename, csv);
      showToast(`Exported ${reportData.records.length} attendance records to CSV.`);
    } catch (err) {
      showToast('Export failed. Please check table filters.');
    }
  };

  // Real CSV Export for audit history
  const handleExportAuditCsv = () => {
    try {
      const csv = exportAuditLogsToCsv(filteredAuditLogs);
      const filename = `HostelGuard_Audit_Ledger_${activeHostelId}_${new Date().toISOString().slice(0, 10)}.csv`;
      downloadCsv(filename, csv);
      showToast(`Downloaded cryptographically sealed audit ledger (${filteredAuditLogs.length} entries).`);
    } catch (err) {
      showToast('Export failed.');
    }
  };

  const handleSavePolicies = async () => {
    try {
      const actor = getMockUserForRole('warden');
      await updateHostelSettings(
        {
          hostelId: activeHostelId,
          windowOpen,
          curfewCutoff,
          reminder1: rem1,
          reminder2: rem2,
          lateProtocol,
          missingProtocol,
          allowExtensions,
          maxExtensionMins: Number(maxExtensionMins),
        },
        actor,
        'Hostel curfew schedule & notification matrix updated via Admin Settings Center'
      );
      const updatedAudit = await getAuditHistory(activeHostelId);
      setAuditLogs(updatedAudit);
      showToast('Policy Rules Synchronized: Curfew rules & notification matrix saved to node HP-KL-02.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating policies';
      showToast(`Validation Alert: ${msg}`);
    }
  };

  const handleSaveGeneralProperty = async () => {
    try {
      const actor = getMockUserForRole('warden');
      await updateHostelDetails(
        activeHostelId,
        {
          name: facilityName,
          capacity: Number(capacity),
        },
        actor,
        'Property facility settings updated'
      );
      await updateHostelSettings(
        {
          hostelId: activeHostelId,
          hostelName: facilityName,
          campusZone,
          capacity: Number(capacity),
          primaryWarden: primaryWarden === 'W-402' ? 'Warden R. K. Sharma (#W-402)' : 'Warden M. K. Rawat (#W-415)',
          securityCheckpost: securityCheckpost === 'Gate-1' ? 'Security Gate Post 1 (Main Entrance)' : 'Security Gate Post 2 (Rear Turnstile)',
          geofenceRadiusMeters: Number(geofenceRadius),
        },
        actor,
        'Property boundary and zone parameters updated'
      );
      const updatedAudit = await getAuditHistory(activeHostelId);
      setAuditLogs(updatedAudit);
      showToast('Property Settings Saved: Tenancy node configurations updated successfully.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving property settings';
      showToast(`Validation Alert: ${msg}`);
    }
  };

  const handleApplyModalSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsModalOpen(false);
    setWindowOpen(modalTimeStart);
    setCurfewCutoff(modalTimeCutoff);
    try {
      const actor = getMockUserForRole('warden');
      await updateHostelSettings(
        {
          hostelId: activeHostelId,
          windowOpen: modalTimeStart,
          curfewCutoff: modalTimeCutoff,
        },
        actor,
        modalReason || 'Shift schedule modified via modal preset'
      );
      const updatedAudit = await getAuditHistory(activeHostelId);
      setAuditLogs(updatedAudit);
    } catch {}
    showToast('Schedule Update Queued: New timeline will propagate next active session.');
  };

  // Filtered audit logs
  const filteredAuditLogs = useMemo(() => {
    let result = auditLogs;
    if (auditCategoryFilter !== 'all') {
      result = result.filter((l) => l.category === auditCategoryFilter);
    }
    if (auditSearchQuery.trim().length > 0) {
      const q = auditSearchQuery.toLowerCase().trim();
      result = result.filter(
        (l) =>
          l.operator.toLowerCase().includes(q) ||
          l.target.toLowerCase().includes(q) ||
          l.reason.toLowerCase().includes(q) ||
          l.newValue.toLowerCase().includes(q)
      );
    }
    return result;
  }, [auditLogs, auditCategoryFilter, auditSearchQuery]);

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen flex">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-inverse-surface text-inverse-on-surface px-4 py-3 rounded-xl shadow-xl flex items-center gap-3">
          <span className="material-symbols-outlined text-primary-fixed text-[22px]">check_circle</span>
          <div className="flex flex-col">
            <span className="font-title-sm text-title-sm font-semibold">Settings Saved Successfully</span>
            <span className="font-body-sm text-body-sm text-surface-variant">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 p-1 text-surface-variant hover:text-inverse-on-surface cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Left Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-surface-container-lowest border-r border-surface-variant z-40 hidden lg:flex flex-col justify-between shadow-[0_1px_3px_0_rgba(15,23,42,0.05)]">
        <div className="flex flex-col">
          <div className="h-16 px-4 border-b border-surface-variant flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-xs">
                <span className="material-symbols-outlined text-[20px]">shield</span>
              </div>
              <div className="flex flex-col">
                <span className="font-title-sm text-title-sm text-on-surface tracking-tight leading-tight font-bold">
                  HostelGuard
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="font-code-sm text-xs text-primary font-medium">v2.4</span>
                  <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
                  <span className="font-label-xs text-on-surface-variant uppercase tracking-wider">NightAudit</span>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 pt-4 pb-2">
            <div className="bg-surface-container-low rounded-xl p-3 border border-surface-variant">
              <span className="font-label-xs text-on-surface-variant uppercase tracking-wider block">
                Tenancy Authority
              </span>
              <div className="flex items-center justify-between mt-0.5">
                <span className="font-title-sm text-on-surface font-semibold truncate">North Campus</span>
                <span className="material-symbols-outlined text-outline text-[16px]">corporate_fare</span>
              </div>
            </div>
          </div>

          <nav className="flex flex-col gap-1 px-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('warden-dashboard')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors font-label-md text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
              <span>Overview</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('student-management')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors font-label-md text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">groups</span>
              <span>Student Management</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('attendance-monitoring')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors font-label-md text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">fact_check</span>
              <span>Attendance Monitoring</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary-container text-on-primary font-semibold text-sm shadow-xs text-left"
            >
              <span className="material-symbols-outlined text-[20px]">query_stats</span>
              <span>Reports &amp; Analytics</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors font-label-md text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">tune</span>
              <span>Hostel Settings</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('terms-privacy')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors font-label-md text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">policy</span>
              <span>Legal Center</span>
            </button>
          </nav>
        </div>

        <div className="p-3 border-t border-surface-variant">
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-error hover:bg-error-container hover:text-on-error-container transition-colors font-label-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-surface-container-lowest border-b border-surface-variant z-30 px-6 flex items-center justify-between shadow-[0_1px_3px_0_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 bg-surface-container-low border border-surface-variant px-3 py-1.5 rounded-xl">
              <span className="material-symbols-outlined text-primary text-[18px]">apartment</span>
              <div className="flex flex-col text-left">
                <span className="font-title-sm text-title-sm text-on-surface leading-tight font-semibold">
                  Sunrise Boys Hostel
                </span>
                <span className="font-label-xs text-label-xs text-on-surface-variant leading-none">
                  Active · 120 Students
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs">
                WS
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="font-title-sm font-semibold text-on-surface leading-tight">Warden R. K. Sharma</span>
                <span className="font-code-sm text-xs text-on-surface-variant leading-none">W-402 · North Campus</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="relative pt-20 pb-16 px-4 md:px-8 bg-surface flex flex-col gap-6">
          {/* Prototype Simulator Rail */}
          <aside
            aria-label="Interactive Prototype Simulation Controls"
            className="bg-surface-container-low p-2 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-xs"
          >
            <div className="flex items-center gap-2 pl-2">
              <span className="material-symbols-outlined text-primary text-[18px]">tune</span>
              <span className="font-label-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                Interactive Prototype State:
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  ['normal', 'Normal View'],
                  ['toast', 'Settings Saved Toast'],
                  ['modal', 'Schedule Edit Modal'],
                  ['empty', 'Empty Range View'],
                  ['alert', 'Service Disruption'],
                ] as [ProtoState, string][]
              ).map(([st, label]) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => handleProtoState(st)}
                  className={`px-3 py-1 rounded-lg text-label-xs font-semibold shadow-xs transition-colors cursor-pointer ${
                    protoState === st
                      ? 'bg-primary-container text-on-primary'
                      : st === 'alert'
                      ? 'bg-surface-container-lowest text-error hover:bg-error-container'
                      : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </aside>

          {/* Service Disruption Banner */}
          {protoState === 'alert' && (
            <div className="bg-error-container text-on-error-container p-4 rounded-xl flex items-center justify-between gap-4 shadow-xs animate-pulse">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-error text-[24px]">crisis_alert</span>
                <div>
                  <p className="font-title-sm font-semibold">FCM Notification Gateway Disruption Alert</p>
                  <p className="font-body-sm text-on-error-container">
                    Outbound Google Firebase Cloud Messaging queue delayed by ~4m 12s. SMS fallback gateway automatically primed for 120 residents.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProtoState('normal')}
                className="px-3 py-1.5 bg-on-error-container text-error-container rounded-lg font-label-sm font-semibold cursor-pointer"
              >
                Acknowledge
              </button>
            </div>
          )}

          {/* Scoped Hostel Header & Control Bar */}
          <header className="bg-surface-container-lowest p-6 rounded-xl shadow-sm flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-xs font-semibold tracking-wide">
                  ACTIVE TENANCY NODE
                </span>
                <span className="font-code-sm text-xs text-on-surface-variant">HP-KL-02 · Campus Zone B</span>
              </div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
                Sunrise Boys Hostel
              </h1>
              <p className="font-body-sm text-on-surface-variant flex flex-wrap items-center gap-2">
                <span>Capacity: 120 Beds (100% Assigned)</span>
                <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
                <span>Night Warden: R. K. Sharma (W-402)</span>
                <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
                <span className="text-primary font-medium">Session Closes in 01h 48m</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Date presets */}
              <div className="flex items-center bg-surface-container-low rounded-xl p-1 shadow-inner">
                {(['today', '7d', '30d', 'custom'] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setDatePreset(preset);
                      showToast(`Date Range: ${preset.toUpperCase()}`);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-label-sm transition-all cursor-pointer ${
                      datePreset === preset
                        ? 'font-semibold bg-surface-container-lowest text-on-surface shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {preset === 'today'
                      ? 'Today'
                      : preset === '7d'
                      ? '7D'
                      : preset === '30d'
                      ? '30D'
                      : 'Sep 14 – Oct 13, 2026'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportAttendanceCsv}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl font-label-sm font-semibold transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl font-label-sm font-semibold transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  <span>Print / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleSavePolicies}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary-container text-on-primary rounded-xl font-label-sm font-semibold hover:bg-primary transition-all shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>Save Policy Changes</span>
                </button>
              </div>
            </div>
          </header>

          {/* Segmented Tab Rail (5 Tabs) */}
          <nav
            aria-label="Settings and Reports Tabs"
            className="bg-surface-container-low p-1.5 rounded-xl shadow-inner flex overflow-x-auto no-scrollbar gap-1"
          >
            {[
              ['reports', 'Attendance Reports & Analytics', 'analytics'],
              ['schedule', 'Attendance Rules & Schedule', 'schedule'],
              ['notifications', 'Push Notifications & Escalation', 'notifications_active'],
              ['general', 'General Hostel Settings', 'settings'],
              ['audit', 'Compliance Audit Trail', 'history_edu'],
            ].map(([tabKey, label, icon]) => (
              <button
                key={tabKey}
                type="button"
                onClick={() => setActiveTab(tabKey as SettingsTab)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-title-sm text-title-sm whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === tabKey
                    ? 'font-bold bg-surface-container-lowest text-on-surface shadow-xs'
                    : 'font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                <span className={`material-symbols-outlined text-[18px] ${activeTab === tabKey ? 'text-primary' : ''}`}>
                  {icon}
                </span>
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {/* TAB 1: REPORTS & ANALYTICS */}
          {activeTab === 'reports' && (
            <section className="flex flex-col gap-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="font-label-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                      Active Roster Size
                    </span>
                    <span className="p-1.5 rounded-lg bg-surface-container-low text-primary">
                      <span className="material-symbols-outlined text-[20px]">groups</span>
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="font-display-hero text-display-hero font-bold text-on-surface leading-none">
                      {reportData.metrics.totalExpected}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-xs font-semibold">
                        {reportData.metrics.totalRecords} Records Evaluated
                      </span>
                      <span className="font-body-sm text-on-surface-variant">Active Tenancy Roster</span>
                    </div>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="font-label-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                      Avg Attendance Rate
                    </span>
                    <span className="p-1.5 rounded-lg bg-surface-container-low text-primary">
                      <span className="material-symbols-outlined text-[20px]">verified</span>
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="font-display-hero text-display-hero font-bold text-on-surface leading-none">
                      {reportData.metrics.attendanceRate}%
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-xs font-semibold">
                        {reportData.metrics.onTimeRate}% On-Time
                      </span>
                      <span className="font-body-sm text-on-surface-variant">IST Session Verified</span>
                    </div>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="font-label-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                      Late Check-ins
                    </span>
                    <span className="p-1.5 rounded-lg bg-surface-container-low text-secondary">
                      <span className="material-symbols-outlined text-[20px]">schedule</span>
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="font-display-hero text-display-hero font-bold text-on-surface leading-none">
                      {reportData.metrics.lateCount}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-xs font-semibold">
                        {reportData.metrics.declaredOutCount} Approved Leave OUT
                      </span>
                      <span className="font-body-sm text-on-surface-variant">Curfew Roll-Call</span>
                    </div>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="font-label-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                      Missing / Unconfirmed
                    </span>
                    <span className="p-1.5 rounded-lg bg-surface-container-low text-tertiary">
                      <span className="material-symbols-outlined text-[20px]">person_alert</span>
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="font-display-hero text-display-hero font-bold text-on-surface leading-none">
                      {reportData.metrics.exceptionCount}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-xs font-semibold">
                        Door Audit Priority
                      </span>
                      <span className="font-body-sm text-on-surface-variant">Requires Floor Verification</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts Bento */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* 30-Day Attendance Trend Line/Bar Visual (7 cols) */}
                <div className="lg:col-span-7 bg-surface-container-lowest p-6 rounded-xl shadow-sm flex flex-col justify-between">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4">
                    <div>
                      <h2 className="font-title-md text-title-md font-bold text-on-surface">
                        30-Day Attendance Compliance Trend
                      </h2>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        Nightly check-in status trajectory across the active billing cycle
                      </p>
                    </div>
                    <div className="flex items-center gap-3 font-label-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-xs bg-primary-container"></span> IN %
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-xs bg-secondary"></span> Leave OUT %
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-xs bg-error"></span> Missing %
                      </span>
                    </div>
                  </div>

                  {/* SVG Chart */}
                  <div className="w-full h-56 pt-2">
                    <svg className="w-full h-full" viewBox="0 0 680 190" fill="none" preserveAspectRatio="none">
                      <line x1="0" y1="20" x2="680" y2="20" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />
                      <line x1="0" y1="65" x2="680" y2="65" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />
                      <line x1="0" y1="110" x2="680" y2="110" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />
                      <line x1="0" y1="155" x2="680" y2="155" stroke="#E2E8F0" strokeWidth="1" />
                      {/* Area Fill */}
                      <path
                        d="M 10 70 L 60 55 L 110 58 L 160 45 L 210 50 L 260 40 L 310 42 L 360 38 L 410 46 L 460 35 L 510 32 L 560 36 L 610 30 L 670 28 L 670 155 L 10 155 Z"
                        fill="rgba(37, 99, 235, 0.08)"
                      />
                      {/* Line */}
                      <path
                        d="M 10 70 L 60 55 L 110 58 L 160 45 L 210 50 L 260 40 L 310 42 L 360 38 L 410 46 L 460 35 L 510 32 L 560 36 L 610 30 L 670 28"
                        stroke="#2563EB"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Out Line */}
                      <path
                        d="M 10 135 L 60 138 L 110 136 L 160 140 L 210 137 L 260 142 L 310 140 L 360 143 L 410 139 L 460 144 L 510 146 L 560 145 L 610 148 L 670 147"
                        stroke="#565E74"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      {/* Key Dots */}
                      <circle cx="160" cy="45" r="4" fill="#2563EB" />
                      <circle cx="410" cy="46" r="4" fill="#2563EB" />
                      <circle cx="670" cy="28" r="5" fill="#2563EB" />
                      {/* Spike */}
                      <circle cx="410" cy="148" r="4" fill="#BA1A1A" />
                      <text x="410" y="170" fill="#93000A" fontSize="10" fontWeight="600" textAnchor="middle">
                        Oct 02 Spike
                      </text>
                    </svg>
                  </div>
                  <div className="flex justify-between items-center pt-2 text-on-surface-variant font-code-sm text-xs">
                    <span>Sep 14</span>
                    <span>Sep 21</span>
                    <span>Sep 28</span>
                    <span>Oct 05</span>
                    <span>Oct 13 (Latest)</span>
                  </div>
                </div>

                {/* Confirmation Composition (5 cols) */}
                <div className="lg:col-span-5 bg-surface-container-lowest p-6 rounded-xl shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3">
                      <div>
                        <h2 className="font-title-md text-title-md font-bold text-on-surface">Confirmation Composition</h2>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">Breakdown of total 3,600 responses</p>
                      </div>
                      <span className="p-1 rounded-md bg-surface-container text-on-surface-variant font-label-xs">Monthly</span>
                    </div>

                    <div className="w-full h-5 rounded-lg overflow-hidden flex my-4 bg-surface-container">
                      <div className="h-full bg-primary-container" style={{ width: '82%' }}></div>
                      <div className="h-full bg-secondary" style={{ width: '9.4%' }}></div>
                      <div className="h-full bg-secondary-fixed-dim" style={{ width: '5.1%' }}></div>
                      <div className="h-full bg-tertiary-container" style={{ width: '3.5%' }}></div>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low">
                        <span className="flex items-center gap-2 font-body-sm font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-primary-container"></span> Verified IN (Geofence + Biometric)
                        </span>
                        <span className="font-code-sm text-xs font-bold">82.0% (2,952)</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low">
                        <span className="flex items-center gap-2 font-body-sm font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span> Authorized Leave Pass (OUT)
                        </span>
                        <span className="font-code-sm text-xs font-bold">9.4% (338)</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low">
                        <span className="flex items-center gap-2 font-body-sm font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-secondary-fixed-dim"></span> Approved Time Extension
                        </span>
                        <span className="font-code-sm text-xs font-bold">5.1% (184)</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low">
                        <span className="flex items-center gap-2 font-body-sm font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-tertiary-container"></span> Manual Warden Audit Override
                        </span>
                        <span className="font-code-sm text-xs font-bold">3.5% (126)</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-surface-variant flex items-center justify-between">
                    <span className="font-label-xs text-on-surface-variant">Verified by Biometric Sync</span>
                    <span className="font-label-xs text-primary font-semibold">100% Audit Reconciled</span>
                  </div>
                </div>
              </div>

              {/* Multi-Hostel Benchmark */}
              <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4">
                  <div>
                    <h2 className="font-title-md text-title-md font-bold text-on-surface">
                      Campus Cluster Multi-Hostel Benchmark
                    </h2>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Nightly curfew compliance performance compared with neighboring residences
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant font-label-xs font-semibold">
                    North Campus Zone
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
                  <div className="p-4 rounded-xl bg-primary/5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="font-label-sm font-bold text-primary">Sunrise Boys (Active)</span>
                      <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="font-headline-md font-bold text-on-surface">91.4%</span>
                      <span className="font-label-xs text-on-surface-variant">120 Beds</span>
                    </div>
                    <div className="w-full bg-surface-container h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-primary h-full rounded-full" style={{ width: '91.4%' }}></div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-surface-container-low flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="font-label-sm font-semibold text-on-surface">Pine Valley Girls</span>
                      <span className="font-label-xs text-on-surface-variant">HP-KL-01</span>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="font-headline-md font-bold text-on-surface">94.2%</span>
                      <span className="font-label-xs text-on-surface-variant">140 Beds</span>
                    </div>
                    <div className="w-full bg-surface-container h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-secondary h-full rounded-full" style={{ width: '94.2%' }}></div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-surface-container-low flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="font-label-sm font-semibold text-on-surface">Cedar Annex</span>
                      <span className="font-label-xs text-on-surface-variant">HP-KL-04</span>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="font-headline-md font-bold text-on-surface">88.7%</span>
                      <span className="font-label-xs text-on-surface-variant">80 Beds</span>
                    </div>
                    <div className="w-full bg-surface-container h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-outline h-full rounded-full" style={{ width: '88.7%' }}></div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-surface-container-low flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="font-label-sm font-semibold text-on-surface">Western Block</span>
                      <span className="font-label-xs text-on-surface-variant">HP-KL-03</span>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="font-headline-md font-bold text-on-surface">93.0%</span>
                      <span className="font-label-xs text-on-surface-variant">150 Beds</span>
                    </div>
                    <div className="w-full bg-surface-container h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-secondary h-full rounded-full" style={{ width: '93%' }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed Reports Table */}
              {protoState === 'empty' ? (
                <div className="py-16 bg-surface-container-lowest rounded-xl flex flex-col items-center justify-center text-center px-4 shadow-sm">
                  <span className="material-symbols-outlined text-[36px] text-secondary mb-2">event_busy</span>
                  <h3 className="font-title-md font-bold text-on-surface">No Attendance Records Located</h3>
                  <p className="font-body-sm text-secondary max-w-sm mt-1">
                    There are no check-in submissions or door exceptions logged for the selected calendar range.
                  </p>
                  <button
                    type="button"
                    onClick={() => setProtoState('normal')}
                    className="mt-4 px-4 py-2 bg-primary-container text-on-primary rounded-xl font-label-sm font-semibold cursor-pointer"
                  >
                    Reset to Past 30 Days
                  </button>
                </div>
              ) : (
                <div className="bg-surface-container-lowest rounded-xl shadow-sm flex flex-col overflow-hidden">
                  <div className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-surface-container">
                    <div className="flex flex-1 items-center gap-3">
                      <div className="relative flex-1 max-w-md">
                        <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">
                          search
                        </span>
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search resident by name, roll number, or student ID..."
                          className="w-full bg-surface-container-low text-on-surface placeholder:text-on-surface-variant font-body-sm pl-9 pr-4 py-2 rounded-xl focus:outline-none"
                        />
                      </div>
                      <select
                        value={roomFilter}
                        onChange={(e) => setRoomFilter(e.target.value)}
                        className="bg-surface-container-low text-on-surface font-label-sm px-3 py-2 rounded-xl focus:outline-none cursor-pointer"
                      >
                        <option value="">All Rooms</option>
                        <option value="A-103">A-103</option>
                        <option value="A-210">A-210</option>
                        <option value="B-204">B-204</option>
                        <option value="C-302">C-302</option>
                      </select>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-surface-container-low text-on-surface font-label-sm px-3 py-2 rounded-xl focus:outline-none cursor-pointer"
                      >
                        <option value="">All Statuses</option>
                        <option value="Confirmed IN">Confirmed IN</option>
                        <option value="Declared OUT">Declared OUT</option>
                        <option value="Late Check-in">Late Check-in</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-body-sm text-secondary font-medium">Auto-refresh:</span>
                      <span className="px-2 py-0.5 rounded-full bg-surface-container text-primary font-code-sm text-xs font-semibold">
                        Live (10s)
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-surface-container-low font-label-xs text-on-surface-variant uppercase tracking-wider">
                          <th className="py-3.5 px-5">Student Identity &amp; ID</th>
                          <th className="py-3.5 px-4">Room</th>
                          <th className="py-3.5 px-4">Date</th>
                          <th className="py-3.5 px-4">Check-in</th>
                          <th className="py-3.5 px-4">Check-out</th>
                          <th className="py-3.5 px-4">Status</th>
                          <th className="py-3.5 px-5">Audit Justification &amp; Notes</th>
                          <th className="py-3.5 px-5 text-right">Quick Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container text-body-sm text-on-surface">
                        {reportData.records.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-secondary">
                              No attendance records matched the search or filter criteria.
                            </td>
                          </tr>
                        ) : (
                          reportData.records.map((rec) => (
                            <tr key={rec.id} className="hover:bg-surface-container-low/60 transition-colors">
                              <td className="py-4 px-5">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                                    {rec.studentAvatar || 'ST'}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-title-sm font-semibold">{rec.studentName}</span>
                                    <span className="font-code-sm text-xs text-secondary">
                                      {rec.studentId || 'STU-102'} · {rec.rollNo}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-4 font-semibold">{rec.room}</td>
                              <td className="py-4 px-4 text-secondary">{rec.date}</td>
                              <td className={`py-4 px-4 font-code-sm font-semibold ${rec.status === 'Late Check-in' ? 'text-error' : ''}`}>
                                {rec.confirmationTime || 'N/A'}
                              </td>
                              <td className="py-4 px-4 font-code-sm text-secondary">06:45 AM IST</td>
                              <td className="py-4 px-4">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-label-xs font-semibold ${
                                    rec.status === 'Confirmed IN'
                                      ? 'bg-secondary-container text-on-secondary-container'
                                      : rec.status === 'Declared OUT'
                                      ? 'bg-surface-container-high text-on-surface-variant'
                                      : rec.status === 'Late Check-in'
                                      ? 'bg-secondary-fixed text-on-secondary-fixed'
                                      : 'bg-error-container text-on-error-container'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      rec.status === 'Confirmed IN'
                                        ? 'bg-primary'
                                        : rec.status === 'Declared OUT'
                                        ? 'bg-secondary'
                                        : 'bg-error'
                                    }`}
                                  ></span>
                                  {rec.status}
                                </span>
                              </td>
                              <td className="py-4 px-5">
                                <div className="flex flex-col">
                                  <span className="font-medium">{rec.notes || 'Routine check-in'}</span>
                                  <span className="font-code-sm text-xs text-secondary">{rec.accuracy || '±20m Verified'}</span>
                                </div>
                              </td>
                              <td className="py-4 px-5 text-right">
                                <button
                                  type="button"
                                  onClick={() => showToast(`Audit dossier opened for ${rec.studentName}`)}
                                  className="p-1.5 rounded-lg hover:bg-surface-container text-secondary hover:text-primary transition-colors cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[18px]">verified_user</span>
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-4 border-t border-surface-container flex flex-col sm:flex-row items-center justify-between gap-3 text-body-sm text-secondary">
                    <span>Showing {reportData.records.length} records of {reportData.metrics.totalExpected} residents</span>
                    <div className="flex items-center gap-2">
                      <button className="px-3 py-1.5 bg-surface-container rounded-lg font-label-sm">Previous</button>
                      <span className="px-3 py-1.5 bg-primary-container text-on-primary rounded-lg font-label-sm font-semibold">
                        1
                      </span>
                      <button className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container rounded-lg font-label-sm">
                        2
                      </button>
                      <button className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container rounded-lg font-label-sm">
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* TAB 2: ATTENDANCE RULES & SCHEDULE */}
          {activeTab === 'schedule' && (
            <section className="flex flex-col gap-6">
              {/* Chronometer */}
              <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-6 border-b border-surface-container">
                  <div>
                    <h2 className="font-title-md text-title-md font-bold text-on-surface">
                      Night Roll-Call Chronometer Lifecycle
                    </h2>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Automated stage transitions executed nightly across North Campus server clock
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                    <span className="font-code-sm text-xs font-semibold text-primary">Timezone: Asia/Kolkata (IST)</span>
                  </div>
                </div>

                <div className="relative py-8 px-4">
                  <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1.5 bg-surface-container rounded-full"></div>
                  <div className="absolute left-6 w-3/5 top-1/2 -translate-y-1/2 h-1.5 bg-primary-container rounded-full"></div>

                  <div className="relative grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm shadow-md ring-4 ring-surface-container-lowest z-10">
                        1
                      </div>
                      <span className="mt-2 font-code-sm text-xs font-bold text-on-surface">10:00 PM</span>
                      <span className="font-label-xs text-primary font-semibold">Window Opens</span>
                      <span className="font-body-sm text-secondary text-[11px]">Biometric sync armed</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm shadow-md ring-4 ring-surface-container-lowest z-10">
                        2
                      </div>
                      <span className="mt-2 font-code-sm text-xs font-bold text-on-surface">10:15 PM</span>
                      <span className="font-label-xs font-semibold text-on-surface">1st Reminder</span>
                      <span className="font-body-sm text-secondary text-[11px]">Gentle FCM push</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm shadow-md ring-4 ring-surface-container-lowest z-10">
                        3
                      </div>
                      <span className="mt-2 font-code-sm text-xs font-bold text-on-surface">11:00 PM</span>
                      <span className="font-label-xs font-semibold text-on-surface">2nd Reminder</span>
                      <span className="font-body-sm text-secondary text-[11px]">T-60m warning</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm shadow-md ring-4 ring-surface-container-lowest z-10">
                        4
                      </div>
                      <span className="mt-2 font-code-sm text-xs font-bold text-on-surface">11:45 PM</span>
                      <span className="font-label-xs font-semibold text-secondary">Final Warning</span>
                      <span className="font-body-sm text-secondary text-[11px]">T-15m critical alert</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="w-9 h-9 rounded-full bg-error text-on-error flex items-center justify-center font-bold text-sm shadow-md ring-4 ring-surface-container-lowest z-10">
                        5
                      </div>
                      <span className="mt-2 font-code-sm text-xs font-bold text-error">12:00 AM (+1d)</span>
                      <span className="font-label-xs font-bold text-error">Curfew Cutoff</span>
                      <span className="font-body-sm text-secondary text-[11px]">Roll-call locked</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="w-9 h-9 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center font-bold text-sm shadow-sm ring-4 ring-surface-container-lowest z-10">
                        6
                      </div>
                      <span className="mt-2 font-code-sm text-xs font-bold text-on-surface">02:00 AM (+1d)</span>
                      <span className="font-label-xs font-semibold text-secondary">Escalation Closes</span>
                      <span className="font-body-sm text-secondary text-[11px]">Chief Warden report</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Policy Parameters Form */}
              <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-6 border-b border-surface-container">
                  <div>
                    <h2 className="font-title-md text-title-md font-bold text-on-surface">
                      Attendance Policy Parameters
                    </h2>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Configure automated curfew thresholds, grace limits, and disciplinary triggers
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="px-3.5 py-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl font-label-sm font-semibold transition-colors cursor-pointer"
                  >
                    Open Visual Editor Modal
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-on-surface-variant font-semibold">
                      Attendance Window Opening
                    </label>
                    <input
                      type="time"
                      value={windowOpen}
                      onChange={(e) => setWindowOpen(e.target.value)}
                      className="bg-surface-container-low text-on-surface font-title-sm p-3 rounded-xl focus:outline-none"
                    />
                    <span className="font-body-sm text-xs text-secondary">Earliest student check-in time</span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-on-surface-variant font-semibold">
                      First Push Notification Reminder
                    </label>
                    <input
                      type="time"
                      value={rem1}
                      onChange={(e) => setRem1(e.target.value)}
                      className="bg-surface-container-low text-on-surface font-title-sm p-3 rounded-xl focus:outline-none"
                    />
                    <span className="font-body-sm text-xs text-secondary">FCM push sent to pending devices</span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-on-surface-variant font-semibold">
                      Second Push Notification Reminder
                    </label>
                    <input
                      type="time"
                      value={rem2}
                      onChange={(e) => setRem2(e.target.value)}
                      className="bg-surface-container-low text-on-surface font-title-sm p-3 rounded-xl focus:outline-none"
                    />
                    <span className="font-body-sm text-xs text-secondary">T-60m warning alert</span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-label-sm text-on-surface-variant font-semibold">Strict Curfew Cutoff</label>
                      <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-xs font-bold">
                        +1 Day Rollover
                      </span>
                    </div>
                    <input
                      type="time"
                      value={curfewCutoff}
                      onChange={(e) => setCurfewCutoff(e.target.value)}
                      className="bg-surface-container-low text-on-surface font-title-sm p-3 rounded-xl focus:outline-none"
                    />
                    <span className="font-body-sm text-xs text-secondary">App check-in locked automatically at cutoff</span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-on-surface-variant font-semibold">
                      Late Check-in Handling Protocol
                    </label>
                    <select
                      value={lateProtocol}
                      onChange={(e) => setLateProtocol(e.target.value as 'warden-req' | 'auto-log' | 'strict-lock')}
                      className="bg-surface-container-low text-on-surface font-title-sm p-3 rounded-xl focus:outline-none cursor-pointer"
                    >
                      <option value="warden-req">Flag as Late &amp; Require Warden Clearance</option>
                      <option value="auto-log">Auto-Log Exception to Disciplinary Record</option>
                      <option value="strict-lock">Lock Submissions &amp; Require Gate Escort</option>
                    </select>
                    <span className="font-body-sm text-xs text-secondary">Rules enforced post-cutoff</span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-on-surface-variant font-semibold">
                      Missing Attendance Review Protocol
                    </label>
                    <select
                      value={missingProtocol}
                      onChange={(e) => setMissingProtocol(e.target.value as 'physical' | 'call-parent' | 'security-dispatch')}
                      className="bg-surface-container-low text-on-surface font-title-sm p-3 rounded-xl focus:outline-none cursor-pointer"
                    >
                      <option value="physical">Physical Door Audit Required within 2h Grace</option>
                      <option value="call-parent">Automated Parent IVR Call at 00:30 AM</option>
                      <option value="security-dispatch">Campus Security Patrol Dispatch</option>
                    </select>
                    <span className="font-body-sm text-xs text-secondary">Enforced if resident remains unverified</span>
                  </div>
                </div>

                {/* Extension Switcher Card */}
                <div className="mt-6 p-4 rounded-xl bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-[24px]">more_time</span>
                    <div>
                      <h3 className="font-title-sm font-bold text-on-surface">Curfew Extension Request Protocol</h3>
                      <p className="font-body-sm text-secondary">
                        Permit students to request verified academic extensions via student portal
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="font-label-sm text-secondary">Max Duration:</span>
                      <select
                        value={maxExtensionMins}
                        onChange={(e) => setMaxExtensionMins(e.target.value)}
                        className="bg-surface-container text-on-surface font-title-sm px-3 py-1.5 rounded-lg focus:outline-none cursor-pointer"
                      >
                        <option value="30">30 minutes</option>
                        <option value="60">60 minutes</option>
                        <option value="90">90 minutes</option>
                      </select>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowExtensions}
                        onChange={(e) => setAllowExtensions(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-surface-variant rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface-container-lowest after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
                    </label>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* TAB 3: PUSH NOTIFICATIONS & ESCALATION */}
          {activeTab === 'notifications' && (
            <section className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3">
                      <span className="p-2 rounded-xl bg-surface-container-low text-primary">
                        <span className="material-symbols-outlined text-[24px]">notifications</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-secondary-container text-primary font-code-sm text-xs font-bold">
                        ACTIVE
                      </span>
                    </div>
                    <h3 className="font-title-md font-bold text-on-surface">Browser Web Push (VAPID)</h3>
                    <p className="font-body-sm text-secondary mt-1">
                      Direct web notifications to registered Android, iOS (PWA), and desktop browser clients.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-surface-container flex items-center justify-between font-label-xs">
                    <span className="text-secondary">Protocol: WebPush API / FCM</span>
                    <span className="text-primary font-bold">118/120 Subscribed</span>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3">
                      <span className="p-2 rounded-xl bg-surface-container-low text-secondary">
                        <span className="material-symbols-outlined text-[24px]">sms</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-surface-container text-secondary font-code-sm text-xs font-bold">
                        STANDBY
                      </span>
                    </div>
                    <h3 className="font-title-md font-bold text-on-surface">Student SMS Fallback</h3>
                    <p className="font-body-sm text-secondary mt-1">
                      Twilio GSM gateway fallback if web push token fails or student is offline.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-surface-container flex items-center justify-between font-label-xs">
                    <span className="text-secondary">Gateway: Twilio Gov / DLT</span>
                    <span className="text-secondary font-bold">Standby (Inactive)</span>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3">
                      <span className="p-2 rounded-xl bg-surface-container-low text-primary">
                        <span className="material-symbols-outlined text-[24px]">crisis_alert</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-secondary-container text-primary font-code-sm text-xs font-bold">
                        ARMED
                      </span>
                    </div>
                    <h3 className="font-title-md font-bold text-on-surface">Warden Emergency Hotline</h3>
                    <p className="font-body-sm text-secondary mt-1">
                      High-priority loud audio alert dispatched to Warden Sharma &amp; Relief Warden at cutoff.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-surface-container flex items-center justify-between font-label-xs">
                    <span className="text-secondary">Target: 2 Designated Officers</span>
                    <span className="text-primary font-bold">2/2 Synced</span>
                  </div>
                </div>
              </div>

              {/* FCM Diagnostic Box */}
              <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
                    <span className="font-title-sm font-bold text-on-surface">FCM Gateway Diagnostics: Operational</span>
                  </div>
                  <p className="font-body-sm text-secondary max-w-xl">
                    FCM HTTP v1 connection alive · Last ping executed today at <strong>10:00:02 PM IST</strong> (latency: 142ms) · VAPID Key Rotation active.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => showToast('Ping sent to Warden R. K. Sharma (FCM Status: Delivered in 118ms)')}
                    className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl font-label-sm font-semibold transition-colors cursor-pointer"
                  >
                    Send Test Push to Warden
                  </button>
                  <button
                    type="button"
                    onClick={() => alert('Fetching latest 50 FCM events from North Campus node... All workers 200 OK.')}
                    className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl font-label-sm font-semibold transition-colors cursor-pointer"
                  >
                    View Gateway Logs
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* TAB 4: GENERAL HOSTEL SETTINGS */}
          {activeTab === 'general' && (
            <section className="bg-surface-container-lowest p-6 rounded-xl shadow-sm flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-surface-container">
                <div>
                  <h2 className="font-title-md font-bold text-on-surface">Hostel Tenancy Configuration</h2>
                  <p className="font-body-sm text-secondary">
                    Institutional details, bed allocations, and supervisory chain of command
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-secondary-container text-on-secondary-fixed font-label-xs font-semibold">
                  Active Operational Node
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm font-semibold text-secondary">Hostel Facility Name</label>
                  <input
                    type="text"
                    value={facilityName}
                    onChange={(e) => setFacilityName(e.target.value)}
                    className="bg-surface-container-low text-on-surface font-title-sm p-3 rounded-xl focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm font-semibold text-secondary">Unique Property Identifier</label>
                  <input
                    type="text"
                    readOnly
                    value="HP-KL-02"
                    className="bg-surface-container text-on-surface font-code-sm p-3 rounded-xl cursor-not-allowed"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm font-semibold text-secondary">Campus Zone / Sector</label>
                  <input
                    type="text"
                    value={campusZone}
                    onChange={(e) => setCampusZone(e.target.value)}
                    className="bg-surface-container-low text-on-surface font-title-sm p-3 rounded-xl focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm font-semibold text-secondary">Total Residential Capacity</label>
                  <input
                    type="number"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="bg-surface-container-low text-on-surface font-title-sm p-3 rounded-xl focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm font-semibold text-secondary">Primary Warden In-Charge</label>
                  <select
                    value={primaryWarden}
                    onChange={(e) => setPrimaryWarden(e.target.value)}
                    className="bg-surface-container-low text-on-surface font-title-sm p-3 rounded-xl focus:outline-none cursor-pointer"
                  >
                    <option value="W-402">Warden R. K. Sharma (#W-402)</option>
                    <option value="W-415">Warden M. K. Rawat (#W-415)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm font-semibold text-secondary">Assigned Security Checkpost</label>
                  <select
                    value={securityCheckpost}
                    onChange={(e) => setSecurityCheckpost(e.target.value)}
                    className="bg-surface-container-low text-on-surface font-title-sm p-3 rounded-xl focus:outline-none cursor-pointer"
                  >
                    <option value="Gate-1">Security Gate Post 1 (Main Entrance)</option>
                    <option value="Gate-2">Security Gate Post 2 (Rear Turnstile)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm font-semibold text-secondary">Geofence Radius (Meters)</label>
                  <input
                    type="number"
                    value={geofenceRadius}
                    onChange={(e) => setGeofenceRadius(e.target.value)}
                    min={10}
                    max={1000}
                    className="bg-surface-container-low text-on-surface font-title-sm p-3 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-surface-container flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleSaveGeneralProperty}
                  className="px-5 py-2 bg-primary-container text-on-primary rounded-xl font-label-md font-semibold hover:bg-primary shadow-xs cursor-pointer"
                >
                  Save Property Settings
                </button>
              </div>
            </section>
          )}

          {/* TAB 5: COMPLIANCE AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <section className="flex flex-col gap-6">
              <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px]">verified</span>
                    <h2 className="font-title-md font-bold text-on-surface">Tamper-Evident Institutional Audit Ledger</h2>
                  </div>
                  <p className="font-body-sm text-secondary mt-1">
                    Immutable administrative record of curfew modifications, student manual overrides, and schedule updates
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-container-low font-code-sm text-xs">
                  <span className="material-symbols-outlined text-primary text-[16px]">lock</span>
                  <span className="text-on-surface font-medium">SHA-256 Ledger Verified</span>
                </div>
              </div>

              {/* Audit Category Filters & Search */}
              <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(['all', 'schedule', 'attendance', 'security', 'resident', 'system'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setAuditCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-lg font-label-xs uppercase font-semibold transition-colors cursor-pointer ${
                        auditCategoryFilter === cat
                          ? 'bg-primary-container text-on-primary'
                          : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="relative w-full md:w-72">
                  <span className="material-symbols-outlined absolute left-3 top-2 text-outline text-[18px]">
                    search
                  </span>
                  <input
                    type="text"
                    value={auditSearchQuery}
                    onChange={(e) => setAuditSearchQuery(e.target.value)}
                    placeholder="Search operator, action or reason..."
                    className="w-full bg-surface-container-low text-on-surface text-xs pl-9 pr-3 py-1.5 rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-surface-container-low font-label-xs text-secondary uppercase tracking-wider">
                        <th className="py-3.5 px-5">Timestamp</th>
                        <th className="py-3.5 px-4">Operator &amp; Role</th>
                        <th className="py-3.5 px-4">Policy Target</th>
                        <th className="py-3.5 px-4">Previous Value</th>
                        <th className="py-3.5 px-4">New Value</th>
                        <th className="py-3.5 px-5">Administrative Justification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container font-body-sm text-on-surface">
                      {filteredAuditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-secondary">
                            No audit log entries found matching selected category or filter.
                          </td>
                        </tr>
                      ) : (
                        filteredAuditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-surface-container-low/60 transition-colors">
                            <td className="py-4 px-5 font-code-sm text-xs text-on-surface font-medium whitespace-nowrap">
                              {log.timestamp}
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex flex-col">
                                <span className="font-semibold text-on-surface">{log.operator}</span>
                                <span className="font-label-xs text-secondary">{log.role}</span>
                              </div>
                            </td>
                            <td className="py-4 px-4 font-semibold text-on-surface">{log.target}</td>
                            <td className="py-4 px-4 text-secondary font-code-sm text-xs">{log.previousValue}</td>
                            <td className="py-4 px-4 text-primary font-semibold font-code-sm text-xs">{log.newValue}</td>
                            <td className="py-4 px-5 text-on-surface">{log.reason}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 border-t border-surface-container flex items-center justify-between">
                  <span className="font-body-sm text-secondary">
                    Showing {filteredAuditLogs.length} immutable ledger entries
                  </span>
                  <button
                    type="button"
                    onClick={handleExportAuditCsv}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-low hover:bg-surface-container text-on-surface rounded-lg font-label-sm font-semibold transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    <span>Download Cryptographic Ledger (CSV)</span>
                  </button>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* Modal: Schedule Edit */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-surface-container-lowest rounded-xl max-w-lg w-full p-6 shadow-xl flex flex-col gap-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-surface-container pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">edit_calendar</span>
                <h3 className="font-title-md font-bold text-on-surface">Edit Night Roll-Call Schedule</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-secondary hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleApplyModalSchedule} className="space-y-4">
              <div>
                <label className="font-label-sm text-secondary block mb-1">Session Policy Label</label>
                <input
                  type="text"
                  value={modalShiftName}
                  onChange={(e) => setModalShiftName(e.target.value)}
                  className="w-full bg-surface-container-low p-2.5 rounded-lg text-on-surface font-body-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-label-sm text-secondary block mb-1">Opening Time</label>
                  <input
                    type="time"
                    value={modalTimeStart}
                    onChange={(e) => setModalTimeStart(e.target.value)}
                    className="w-full bg-surface-container-low p-2.5 rounded-lg text-on-surface font-title-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-label-sm text-secondary block mb-1">Curfew Cutoff</label>
                  <input
                    type="time"
                    value={modalTimeCutoff}
                    onChange={(e) => setModalTimeCutoff(e.target.value)}
                    className="w-full bg-surface-container-low p-2.5 rounded-lg text-on-surface font-title-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-label-sm text-secondary block mb-1">
                  Reason for Policy Modification (Required for Audit)
                </label>
                <textarea
                  rows={2}
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  className="w-full bg-surface-container-low p-2.5 rounded-lg text-on-surface font-body-sm focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-surface-container hover:bg-surface-container-high rounded-xl text-on-surface font-label-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-container text-on-primary rounded-xl font-label-sm font-semibold hover:bg-primary shadow-xs cursor-pointer"
                >
                  Save &amp; Propagate Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
