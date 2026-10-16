import React, { useState, useEffect, useMemo } from 'react';
import { AppScreen, Hostel, Student, AttendanceRecord } from '../../types';
import {
  generateAttendanceReport,
  exportAttendanceToCsv,
} from '../../lib/hostel-service';
import { useAuth } from '../../context/AuthContext';
import {
  subscribeToHostels,
  subscribeToStudents,
  subscribeToAttendance,
  saveHostelToDb,
} from '../../lib/db-seed';

export interface HostelSettingsViewProps {
  onNavigate: (screen: AppScreen) => void;
  onLogout: () => void;
}

type TabType = 'timings' | 'reports';

export const HostelSettingsView: React.FC<HostelSettingsViewProps> = ({
  onNavigate,
  onLogout,
}) => {
  const { user, authorizedHostels } = useAuth();
  const isWarden = user?.role === 'warden';
  const isAdmin = user?.role === 'super_admin';
  const hasAssignedHostel = isAdmin || authorizedHostels.length > 0;

  const [activeTab, setActiveTab] = useState<TabType>('timings');
  const [activeHostelId, setActiveHostelId] = useState('');
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  // Timings Settings State
  const [windowOpen, setWindowOpen] = useState('22:00');
  const [rem1, setRem1] = useState('22:15');
  const [rem2, setRem2] = useState('23:00');
  const [rem3, setRem3] = useState('23:30');
  const [curfewCutoff, setCurfewCutoff] = useState('00:00');

  // Reports State
  const [datePreset, setDatePreset] = useState<'today' | '7d' | '30d'>('30d');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

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

  // Subscribe to live hostels, students, and attendance from central database
  useEffect(() => {
    const unsubHostels = subscribeToHostels((liveHostels) => {
      setHostels(liveHostels);
    });
    const unsubStudents = subscribeToStudents((liveStudents) => {
      setStudents(liveStudents);
    });
    const unsubAtt = subscribeToAttendance((liveRecords) => {
      setAttendanceRecords(liveRecords);
    });
    return () => {
      unsubHostels();
      unsubStudents();
      unsubAtt();
    };
  }, []);

  // Synchronize activeHostelId with authorized hostels
  useEffect(() => {
    if (authorizedHostels.length > 0) {
      if (!activeHostelId || !authorizedHostels.some((h) => h.id === activeHostelId)) {
        setActiveHostelId(authorizedHostels[0].id);
      }
    } else {
      setActiveHostelId('');
    }
  }, [authorizedHostels, activeHostelId]);

  // Current active hostel object - strictly from authorized hostels
  const currentHostel = useMemo(() => {
    return authorizedHostels.find((h) => h.id === activeHostelId) || (authorizedHostels.length > 0 ? authorizedHostels[0] : null);
  }, [authorizedHostels, activeHostelId]);

  // Synchronize form inputs whenever the selected hostel changes
  useEffect(() => {
    if (currentHostel) {
      setWindowOpen(currentHostel.curfewStart || '22:00');
      setCurfewCutoff(currentHostel.curfewEnd || (currentHostel as any).curfewTime || '00:00');
      const rems = currentHostel.reminderSchedule || ['22:15', '23:00', '23:30'];
      setRem1(rems[0] || currentHostel.reminder1 || '22:15');
      setRem2(rems[1] || currentHostel.reminder2 || '23:00');
      setRem3(rems[2] || currentHostel.reminder3 || '23:30');
    }
  }, [currentHostel]);

  // Filter students strictly by active hostel for reports
  const filteredStudents = useMemo(() => {
    if (!activeHostelId) return students;
    return students.filter((s) => s.hostelId === activeHostelId);
  }, [students, activeHostelId]);

  // Filter attendance records strictly by active hostel
  const filteredAttendance = useMemo(() => {
    if (!activeHostelId) return attendanceRecords;
    return attendanceRecords.filter((a) => a.hostelId === activeHostelId);
  }, [attendanceRecords, activeHostelId]);

  // Generate per-hostel report data
  const reportData = useMemo(() => {
    return generateAttendanceReport(
      {
        hostelId: activeHostelId,
        datePreset,
        searchQuery,
      },
      filteredStudents.length > 0 ? filteredStudents : undefined,
      filteredAttendance.length > 0 ? filteredAttendance : undefined
    );
  }, [activeHostelId, datePreset, searchQuery, filteredStudents, filteredAttendance]);

  // Save timing & curfew rules directly into the selected hostel object
  const handleSaveTimings = async () => {
    if (!currentHostel) {
      showToast('Please select a registered hostel first.');
      return;
    }
    try {
      const updatedReminders = Array.from(new Set([rem1, rem2, rem3].filter(Boolean))).sort();
      const updatedHostel: Hostel = {
        ...currentHostel,
        curfewStart: windowOpen,
        curfewEnd: curfewCutoff,
        curfewTime: curfewCutoff,
        reminderSchedule: updatedReminders.length > 0 ? updatedReminders : ['22:15', '23:00', '23:30'],
        reminder1: rem1,
        reminder2: rem2,
        reminder3: rem3,
      };

      await saveHostelToDb(updatedHostel);
      showToast(`Timings and curfew rules saved for "${updatedHostel.name}".`);
    } catch (err) {
      console.error('[HostelSettingsView] Error saving timings:', err);
      showToast('Failed to save timings. Please try again.');
    }
  };

  const handleExportCSV = () => {
    try {
      const csv = exportAttendanceToCsv(reportData.records, filteredStudents);
      const hostelName = currentHostel ? currentHostel.name.replace(/[^a-zA-Z0-9]/g, '_') : 'Hostel';
      const filename = `HER_SPACE_${hostelName}_Attendance_${datePreset}_${new Date().toISOString().slice(0, 10)}.csv`;
      downloadCsv(filename, csv);
      showToast(`Exported ${reportData.records.length} records for ${currentHostel?.name || 'hostel'} to CSV.`);
    } catch {
      showToast('Export failed.');
    }
  };

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 flex pointer-events-none">
          <div className="bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-fade-in">
            <span className="material-symbols-outlined text-primary-fixed text-lg">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-6xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 space-y-5 sm:space-y-6 pb-24 md:pb-8">
        {/* Page Title & Action Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[22px]">assessment</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-on-surface leading-tight">Hostel Reports &amp; Curfew Timings</h1>
                {currentHostel && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{currentHostel.name}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-secondary mt-0.5">
                Hostel-specific curfew schedules, 3-stage reminder alarms, and attendance report downloads
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-semibold text-secondary whitespace-nowrap">Selected Hostel:</label>
            <select
              disabled={authorizedHostels.length === 0}
              value={activeHostelId}
              onChange={(e) => setActiveHostelId(e.target.value)}
              className="w-full sm:w-auto bg-surface-container-low border border-outline-variant/30 text-on-surface rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer outline-none focus:border-primary shadow-xs disabled:opacity-50"
            >
              {authorizedHostels.length > 0 ? (
                authorizedHostels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.curfewStart || '22:00'} - {h.curfewEnd || (h as any).curfewTime || '00:00'})
                  </option>
                ))
              ) : (
                <option value="">No Assigned Hostel</option>
              )}
            </select>
          </div>
        </div>

        {/* Warning banner when warden has no assigned hostel */}
        {!hasAssignedHostel && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-xs flex items-start gap-3.5">
            <span className="material-symbols-outlined text-amber-500 text-2xl shrink-0">domain_disabled</span>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400">No Residential Hostel Assigned</h3>
              <p className="text-xs text-secondary leading-relaxed">
                Your warden account is currently not assigned to any residential hostel. Settings configuration and attendance reports are disabled until an administrator assigns you to a hostel boundary.
              </p>
            </div>
          </div>
        )}

        {/* Two Clean Tabs */}
        <div className="flex items-center gap-2 border-b border-outline-variant/30 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('timings')}
            className={`px-4 py-2 rounded-xl font-label-md font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'timings'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-secondary hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">schedule</span>
            <span>Attendance Timings</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-xl font-label-md font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'reports'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-secondary hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">analytics</span>
            <span>Reports &amp; CSV Export</span>
          </button>
        </div>

        {/* TAB 1: Attendance Timings */}
        {activeTab === 'timings' && (
          <div className="space-y-6">
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-xs space-y-5">
              {/* Active Hostel Context Header */}
              <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-xl">domain</span>
                  <div>
                    <p className="font-semibold text-sm text-on-surface">
                      Configuring Timings: <span className="text-primary font-bold">{currentHostel?.name || 'Selected Hostel'}</span>
                    </p>
                    <p className="text-[11px] text-secondary">
                      Hostel ID: {currentHostel?.id || '—'} &bull; Radius: {currentHostel?.geofenceRadiusMeters || 200}m
                      {(currentHostel?.wardenName || currentHostel?.wardenEmail) && (
                        <span> &bull; Assigned Warden: <strong className="text-on-surface font-semibold">{currentHostel.wardenName || currentHostel.wardenEmail}</strong></span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('hostel-registration')}
                  className="text-primary hover:underline text-xs font-semibold self-start sm:self-auto cursor-pointer flex items-center gap-1"
                >
                  <span>Edit Hostel Boundary</span>
                  <span className="material-symbols-outlined text-xs">open_in_new</span>
                </button>
              </div>

              <div>
                <h2 className="font-title-lg font-bold text-on-surface">Night Curfew Schedule</h2>
                <p className="font-body-sm text-secondary">
                  Configure the automated night roll-call window and notification alarms for residents of {currentHostel?.name || 'this hostel'}.
                </p>
              </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-label-sm font-semibold text-on-surface mb-1">
                      Check-In Window Opens
                    </label>
                    <input
                      type="time"
                      value={windowOpen}
                      onChange={(e) => setWindowOpen(e.target.value)}
                      className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <span className="font-label-xs text-secondary mt-1 block">Students can begin checking in</span>
                  </div>

                  <div>
                    <label className="block font-label-sm font-semibold text-on-surface mb-1">
                      Curfew Cutoff
                    </label>
                    <input
                      type="time"
                      value={curfewCutoff}
                      onChange={(e) => setCurfewCutoff(e.target.value)}
                      className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:ring-2 focus:ring-primary/20 font-bold text-red-600"
                    />
                    <span className="font-label-xs text-secondary mt-1 block">Curfew deadline (Midnight)</span>
                  </div>
                </div>

                {/* 3-Stage Automated Curfew Reminders */}
                <div className="pt-3 border-t border-outline-variant/20">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-primary text-base">notifications_active</span>
                    <h3 className="font-semibold text-xs text-on-surface uppercase tracking-wider">Automated 3-Stage Reminder Schedule</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-label-sm font-semibold text-on-surface mb-1">
                        1st Reminder Alert
                      </label>
                      <input
                        type="time"
                        value={rem1}
                        onChange={(e) => setRem1(e.target.value)}
                        className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                      />
                      <span className="font-label-xs text-secondary mt-1 block">1st push notification sent to all pending students</span>
                    </div>

                    <div>
                      <label className="block font-label-sm font-semibold text-on-surface mb-1">
                        2nd Urgent Warning
                      </label>
                      <input
                        type="time"
                        value={rem2}
                        onChange={(e) => setRem2(e.target.value)}
                        className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:ring-2 focus:ring-primary/20 font-medium text-amber-700"
                      />
                      <span className="font-label-xs text-secondary mt-1 block">2nd reminder for students still unverified</span>
                    </div>

                    <div>
                      <label className="block font-label-sm font-semibold text-on-surface mb-1">
                        3rd Final Countdown Alert
                      </label>
                      <input
                        type="time"
                        value={rem3}
                        onChange={(e) => setRem3(e.target.value)}
                        className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:ring-2 focus:ring-primary/20 font-medium text-rose-600"
                      />
                      <span className="font-label-xs text-secondary mt-1 block">Final urgent alarm before curfew cutoff closes</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveTimings}
                    className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-label-md font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    Save Timings &amp; Curfew Rules
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Reports & CSV Export */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              {/* Date Presets & Download */}
              <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-label-xs uppercase font-bold text-secondary tracking-wider mr-1">Period:</span>
                  {(['today', '7d', '30d'] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDatePreset(preset)}
                      className={`px-3 py-1.5 rounded-full text-label-xs font-semibold cursor-pointer transition-colors ${
                        datePreset === preset
                          ? 'bg-primary text-on-primary shadow-xs'
                          : 'bg-surface-container-low text-secondary hover:text-on-surface'
                      }`}
                    >
                      {preset === 'today' ? 'Today' : preset === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-label-md font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">file_download</span>
                  <span>Export CSV Report</span>
                </button>
              </div>

              {/* 4 Summary Counts */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/30 text-center shadow-xs">
                  <span className="font-headline-md font-bold text-on-surface">{reportData.metrics.totalExpected}</span>
                  <p className="font-label-xs text-secondary mt-0.5">Total Expected</p>
                </div>
                <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/30 text-center shadow-xs">
                  <span className="font-headline-md font-bold text-emerald-600">{reportData.metrics.confirmedCount}</span>
                  <p className="font-label-xs text-secondary mt-0.5">Confirmed IN</p>
                </div>
                <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/30 text-center shadow-xs">
                  <span className="font-headline-md font-bold text-blue-600">{reportData.metrics.declaredOutCount}</span>
                  <p className="font-label-xs text-secondary mt-0.5">Declared OUT</p>
                </div>
                <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/30 text-center shadow-xs">
                  <span className="font-headline-md font-bold text-amber-600">
                    {reportData.metrics.lateCount + reportData.metrics.exceptionCount}
                  </span>
                  <p className="font-label-xs text-secondary mt-0.5">Missed / Pending</p>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter report records by resident name, room, or ID..."
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl pl-10 pr-4 py-2.5 font-body-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20 shadow-xs"
                />
              </div>

              {/* Mobile Card List for Phone View (< md) */}
              <div className="md:hidden space-y-3">
                {reportData.records.length === 0 ? (
                  <div className="py-8 text-center text-xs text-secondary bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
                    No attendance records found for this period.
                  </div>
                ) : (
                  reportData.records.slice(0, 15).map((r) => (
                    <div
                      key={r.id}
                      className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-code-sm text-xs font-semibold text-secondary">{r.refId}</span>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-xs font-semibold text-xs ${
                            r.status === 'Confirmed IN'
                              ? 'bg-emerald-50 text-emerald-700'
                              : r.status === 'Declared OUT'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                      <div className="text-xs text-on-surface flex items-center justify-between">
                        <span className="font-medium">{r.date}</span>
                        <span className="text-secondary">{r.confirmationTime || '—'}</span>
                      </div>
                      <div className="text-[11px] text-secondary truncate flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">location_on</span>
                        <span>{r.capturedAddress || 'HER-SPACE Campus'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Report Table (>= md) */}
              <div className="hidden md:block bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500">Ref ID</th>
                        <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500">Date</th>
                        <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500">Status</th>
                        <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500">Time</th>
                        <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500">Verified Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {reportData.records.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-secondary">
                            No attendance records found for this period.
                          </td>
                        </tr>
                      ) : (
                        reportData.records.slice(0, 15).map((r) => (
                          <tr key={r.id} className="hover:bg-surface-container-low/50 transition-colors">
                            <td className="py-3 px-4 font-code-sm text-secondary font-medium">{r.refId}</td>
                            <td className="py-3 px-4 font-medium text-on-surface">{r.date}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-xs font-semibold ${
                                  r.status === 'Confirmed IN'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : r.status === 'Declared OUT'
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'bg-amber-50 text-amber-700'
                                }`}
                              >
                                {r.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-secondary">{r.confirmationTime || '—'}</td>
                            <td className="py-3 px-4 text-secondary truncate max-w-xs">{r.capturedAddress || 'HER-SPACE'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
    </div>
  );
};

// Backward-compatible alias for existing imports
export const Screen8HostelSettings = HostelSettingsView;
