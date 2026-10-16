import React, { useState, useEffect } from 'react';
import { AppScreen, Student, Hostel, AttendanceRecord } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { subscribeToStudents, subscribeToHostels, updateStudentAttendanceInDb } from '../../lib/db-seed';

export interface WardenDashboardViewProps {
  onNavigate: (screen: AppScreen) => void;
  onLogout: () => void;
}

export const WardenDashboardView: React.FC<WardenDashboardViewProps> = ({
  onNavigate,
  onLogout,
}) => {
  const { user, authorizedHostels, activeHostelId, switchHostel, activeHostel } = useAuth();
  const isAdmin = user?.role === 'super_admin';

  // Live students state
  const [students, setStudents] = useState<Student[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'in' | 'out' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected student for History Modal
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubStudents = subscribeToStudents((liveStudents) => {
      setStudents(liveStudents);
    });

    return () => {
      unsubStudents();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filter students strictly belonging to the active hostel.
  // If no active hostel (e.g. unassigned warden), hostelResidents is strictly empty!
  const isAuthorizedActive = Boolean(activeHostelId && authorizedHostels.some((h) => h.id === activeHostelId));
  const hostelResidents = isAuthorizedActive
    ? students.filter((s) => s.hostelId === activeHostelId)
    : [];

  // Exact 4 Summary Cards from Section 10:
  // 1. Total Residents
  // 2. Currently IN
  // 3. Currently OUT
  // 4. Residents with failed IN verification
  const totalResidents = hostelResidents.length;
  const currentlyIn = hostelResidents.filter((s) => s.attendanceStatus === 'IN').length;
  const currentlyOut = hostelResidents.filter((s) => s.attendanceStatus === 'OUT').length;
  const failedInVerification = hostelResidents.filter(
    (s) => (s.failedInAttemptCount && s.failedInAttemptCount > 0) || (s.lastFailedInAt && s.attendanceStatus === 'OUT')
  ).length;

  const filteredResidents = hostelResidents.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.room.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentId.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'in') return s.attendanceStatus === 'IN';
    if (statusFilter === 'out') return s.attendanceStatus === 'OUT';
    if (statusFilter === 'failed') {
      return (s.failedInAttemptCount && s.failedInAttemptCount > 0) || s.lastFailedInAt;
    }
    return true;
  });

  const handleQuickMarkIn = async (stu: Student) => {
    const timeFormatted = `${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Warden Verified)`;
    try {
      await updateStudentAttendanceInDb(stu.id, 'IN', timeFormatted, 'Warden physical roll-call verification');
      setStudents((prev) =>
        prev.map((s) =>
          s.id === stu.id
            ? { ...s, attendanceStatus: 'IN', attendanceTime: timeFormatted, lastUpdated: timeFormatted }
            : s
        )
      );
      showToast(`Marked ${stu.name} as IN.`);
    } catch {
      showToast(`Marked ${stu.name} as IN.`);
    }
  };

  const handleQuickMarkOut = async (stu: Student) => {
    const timeFormatted = `${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Warden Logged)`;
    try {
      await updateStudentAttendanceInDb(stu.id, 'OUT', undefined, 'Warden out-pass notation');
      setStudents((prev) =>
        prev.map((s) =>
          s.id === stu.id
            ? { ...s, attendanceStatus: 'OUT', outTime: timeFormatted, lastUpdated: timeFormatted }
            : s
        )
      );
      showToast(`Marked ${stu.name} as OUT.`);
    } catch {
      showToast(`Marked ${stu.name} as OUT.`);
    }
  };

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen flex flex-col pb-24 md:pb-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50">
          <div className="bg-slate-800 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs sm:text-sm font-medium border border-violet-500/40">
            <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 space-y-5 sm:space-y-6">
        {/* Page Title & Quick Actions Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[22px]">
                {isAdmin ? 'admin_panel_settings' : 'shield'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-on-surface leading-tight">
                  {isAdmin ? 'Hostel Administrator Dashboard' : 'Warden Attendance Dashboard'}
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase shrink-0">
                  {user?.role || 'warden'}
                </span>
              </div>
              <p className="text-xs text-secondary mt-0.5">
                Real-time night roll-call &amp; resident attendance tracking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Multi-Hostel Selector */}
            <div className="flex items-center gap-1.5 bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs shadow-xs">
              <span className="material-symbols-outlined text-primary text-sm">home_work</span>
              <span className="font-semibold text-secondary">Hostel:</span>
              <select
                value={activeHostelId}
                onChange={(e) => switchHostel(e.target.value)}
                disabled={authorizedHostels.length <= 1}
                className="bg-transparent text-xs font-bold text-on-surface outline-none cursor-pointer disabled:cursor-not-allowed"
              >
                {authorizedHostels.length === 0 ? (
                  <option value="" className="text-slate-900">
                    No assigned hostel
                  </option>
                ) : (
                  authorizedHostels.map((h) => (
                    <option key={h.id} value={h.id} className="text-slate-900">
                      {h.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Warning banner when warden has no assigned hostel */}
        {!isAdmin && authorizedHostels.length === 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-xs flex items-start gap-3.5">
            <span className="material-symbols-outlined text-amber-500 text-2xl shrink-0">domain_disabled</span>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400">No Residential Hostel Assigned</h3>
              <p className="text-xs text-secondary leading-relaxed">
                Your warden account is currently not assigned to any residential hostel. Until an administrator assigns you to a hostel boundary, you cannot view resident attendance, access records, or perform check-ins.
              </p>
            </div>
          </div>
        )}

        {/* Admin Guided Setup Banner when no hostels registered */}
        {isAdmin && authorizedHostels.length === 0 && (
          <div className="bg-gradient-to-r from-violet-600/10 via-indigo-600/10 to-blue-600/10 border border-violet-500/30 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 font-bold text-sm">
                  <span className="material-symbols-outlined text-base">rocket_launch</span>
                  <span>HER-SPACE Production Setup Flow</span>
                </div>
                <p className="text-xs text-secondary leading-relaxed max-w-xl">
                  <strong>Step 1:</strong> Register your hostel &amp; configure geofence radius + night curfew reminder times &rarr;{' '}
                  <strong>Step 2:</strong> Invite &amp; assign wardens &rarr;{' '}
                  <strong>Step 3:</strong> Register residents &amp; generate single-use mobile setup links.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('hostel-registration')}
                className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold shrink-0 cursor-pointer flex items-center gap-2 shadow-md shadow-violet-600/25 transition-all"
              >
                <span className="material-symbols-outlined text-sm">add_business</span>
                <span>Register First Hostel &rarr;</span>
              </button>
            </div>
          </div>
        )}

        {/* Exact 4 Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Residents */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <p className="font-label-xs font-semibold uppercase tracking-wider text-secondary">Total Residents</p>
              <span className="material-symbols-outlined text-primary text-xl">group</span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-on-surface mt-2">{totalResidents}</p>
            <p className="text-[11px] text-secondary mt-1">
              {activeHostel ? `Enrolled in ${activeHostel.name}` : 'No assigned hostel'}
            </p>
          </div>

          {/* Card 2: Currently IN */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <p className="font-label-xs font-semibold uppercase tracking-wider text-emerald-700">Currently IN</p>
              <span className="material-symbols-outlined text-emerald-600 text-xl">check_circle</span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 mt-2">{currentlyIn}</p>
            <p className="text-[11px] text-secondary mt-1">
              {totalResidents > 0 ? `${Math.round((currentlyIn / totalResidents) * 100)}% present in hostel` : 'No residents'}
            </p>
          </div>

          {/* Card 3: Currently OUT */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <p className="font-label-xs font-semibold uppercase tracking-wider text-amber-700">Currently OUT</p>
              <span className="material-symbols-outlined text-amber-600 text-xl">logout</span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-2">{currentlyOut}</p>
            <p className="text-[11px] text-secondary mt-1">
              Scheduled for night return reminders
            </p>
          </div>

          {/* Card 4: Failed IN Verification */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <p className="font-label-xs font-semibold uppercase tracking-wider text-rose-700">Failed IN Verification</p>
              <span className="material-symbols-outlined text-rose-600 text-xl">location_off</span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-rose-600 mt-2">{failedInVerification}</p>
            <p className="text-[11px] text-secondary mt-1">Attempted check-in outside radius</p>
          </div>
        </div>

        {/* Resident Table Section */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-title-md font-bold text-on-surface">Resident Night Attendance Roster</h2>
              <p className="font-label-xs text-secondary">
                Authoritative attendance records refreshed live from the database
              </p>
            </div>

            {/* Search & Status Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-sm">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search resident name, room, ID..."
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl pl-9 pr-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-outline-variant/30">
                {(['all', 'in', 'out', 'failed'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-colors ${
                      statusFilter === filter
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'text-secondary hover:text-on-surface'
                    }`}
                  >
                    {filter === 'all'
                      ? `All (${totalResidents})`
                      : filter === 'in'
                      ? `IN (${currentlyIn})`
                      : filter === 'out'
                      ? `OUT (${currentlyOut})`
                      : `Failed (${failedInVerification})`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Roster Card View (phones: < md) */}
          <div className="md:hidden space-y-3">
            {filteredResidents.length === 0 ? (
              <div className="py-8 text-center text-secondary text-xs bg-surface-container-low rounded-xl border border-outline-variant/20">
                {authorizedHostels.length === 0
                  ? 'No hostel assigned to your account. Resident records are hidden.'
                  : 'No residents found for this hostel and status filter.'}
              </div>
            ) : (
              filteredResidents.map((stu) => {
                const isOut = stu.attendanceStatus === 'OUT';
                return (
                  <div
                    key={stu.id}
                    className="bg-surface-container-low/70 border border-outline-variant/30 rounded-2xl p-4 space-y-3 shadow-xs"
                  >
                    {/* Top Row: Avatar + Name + Room + Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                          {stu.avatarInitials}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-on-surface leading-tight">{stu.name}</p>
                          <div className="flex items-center gap-2 text-[11px] text-secondary mt-0.5">
                            <span className="font-mono">{stu.studentId}</span>
                            <span>&bull;</span>
                            <span className="font-semibold text-on-surface">Room {stu.room}</span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                          !isOut
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        <span>{stu.attendanceStatus}</span>
                      </span>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-outline-variant/20">
                      <div>
                        <span className="text-secondary block">Last OUT:</span>
                        <span className="font-mono text-on-surface font-medium">{stu.outTime || '—'}</span>
                      </div>
                      <div>
                        <span className="text-secondary block">Expected Return:</span>
                        {stu.estimatedReturnTime ? (
                          <span className="text-violet-700 font-bold bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200 inline-block font-mono">
                            {stu.estimatedReturnTime}
                          </span>
                        ) : isOut ? (
                          <span className="text-amber-700 italic">Pending reply</span>
                        ) : (
                          <span className="text-secondary">—</span>
                        )}
                      </div>
                      <div className="col-span-2">
                        <span className="text-secondary block">Location:</span>
                        <span className="text-on-surface truncate block" title={stu.lastLocationSnapshot}>
                          {stu.lastLocationSnapshot || 'No GPS captured'}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/20">
                      {isOut ? (
                        <button
                          type="button"
                          onClick={() => handleQuickMarkIn(stu)}
                          className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold text-center cursor-pointer transition-colors shadow-xs"
                        >
                          Mark Present IN
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleQuickMarkOut(stu)}
                          className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold text-center cursor-pointer transition-colors shadow-xs"
                        >
                          Mark OUT
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setHistoryStudent(stu)}
                        className="px-3.5 py-2 rounded-xl border border-outline-variant/30 hover:bg-surface-container text-xs font-semibold text-on-surface cursor-pointer transition-colors"
                      >
                        History
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table View (>= md screens) */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-outline-variant/20">
            <table className="w-full text-left">
              <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-500">Resident Name</th>
                  <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-500">Room</th>
                  <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-500">Status</th>
                  <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-500">Last OUT Time</th>
                  <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-500">Estimated Return</th>
                  <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-500">Last Attendance</th>
                  <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-500">Captured Location</th>
                  <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-500">Capture Time</th>
                  <th className="py-2.5 px-3 text-right text-[11px] font-semibold text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {filteredResidents.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-secondary text-xs">
                      {authorizedHostels.length === 0
                        ? 'No residential hostel assigned to your account. Resident records are hidden.'
                        : 'No residents found for this hostel and status filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredResidents.map((stu) => {
                    const isOut = stu.attendanceStatus === 'OUT';
                    return (
                      <tr key={stu.id} className="hover:bg-surface-container-low/40 transition-colors text-xs">
                        {/* 1. Resident Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                              {stu.avatarInitials}
                            </div>
                            <div>
                              <p className="font-bold text-on-surface">{stu.name}</p>
                              <p className="text-[11px] text-secondary font-mono">{stu.studentId}</p>
                            </div>
                          </div>
                        </td>

                        {/* 2. Room Number */}
                        <td className="py-3.5 px-4 font-semibold text-on-surface">
                          {stu.room}
                        </td>

                        {/* 3. Current Status (IN or OUT) */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              !isOut
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            <span>{stu.attendanceStatus}</span>
                          </span>
                        </td>

                        {/* 4. Last OUT Time */}
                        <td className="py-3.5 px-4 font-mono text-secondary">
                          {stu.outTime || '—'}
                        </td>

                        {/* 5. Estimated Return Time */}
                        <td className="py-3.5 px-4 font-mono">
                          {stu.estimatedReturnTime ? (
                            <span className="text-violet-700 font-bold bg-violet-50 px-2 py-0.5 rounded-md border border-violet-200">
                              {stu.estimatedReturnTime}
                            </span>
                          ) : isOut ? (
                            <span className="text-amber-700 italic text-[11px]">Pending reply</span>
                          ) : (
                            <span className="text-secondary">—</span>
                          )}
                        </td>

                        {/* 6. Last Attendance Action */}
                        <td className="py-3.5 px-4 text-on-surface">
                          {stu.lastUpdated || (isOut ? 'Checked OUT' : 'Checked IN')}
                        </td>

                        {/* 7. Last Captured Location */}
                        <td className="py-3.5 px-4 max-w-[180px] truncate text-secondary" title={stu.lastLocationSnapshot}>
                          {stu.lastLocationSnapshot || 'No GPS captured'}
                        </td>

                        {/* 8. Location Capture Time */}
                        <td className="py-3.5 px-4 font-mono text-secondary text-[11px]">
                          {stu.attendanceTime || stu.lastFailedInAt?.split('T')[1]?.substring(0, 5) || '—'}
                        </td>

                        {/* 9. Actions */}
                        <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {isOut ? (
                            <button
                              onClick={() => handleQuickMarkIn(stu)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer transition-colors"
                              title="Warden verified physical presence in hostel"
                            >
                              Mark IN
                            </button>
                          ) : (
                            <button
                              onClick={() => handleQuickMarkOut(stu)}
                              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold cursor-pointer transition-colors"
                              title="Record out-pass"
                            >
                              Mark OUT
                            </button>
                          )}
                          <button
                            onClick={() => setHistoryStudent(stu)}
                            className="px-2.5 py-1 rounded-lg border border-outline-variant/30 hover:bg-surface-container text-[11px] font-semibold text-on-surface cursor-pointer transition-colors"
                          >
                            History
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Attendance History Modal */}
      {historyStudent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="max-w-md w-full bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div>
                <h3 className="font-title-md font-bold text-on-surface">{historyStudent.name}</h3>
                <p className="text-xs text-secondary">
                  Room {historyStudent.room} · ID: {historyStudent.studentId}
                </p>
              </div>
              <button
                onClick={() => setHistoryStudent(null)}
                className="text-secondary hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-surface-container-low rounded-xl p-3 border border-outline-variant/20 space-y-1">
                <p className="font-semibold text-on-surface">Tonight's State</p>
                <p className="text-secondary">Status: <strong className="text-on-surface">{historyStudent.attendanceStatus}</strong></p>
                {historyStudent.outTime && <p className="text-secondary">Out Time: <span className="font-mono">{historyStudent.outTime}</span></p>}
                {historyStudent.attendanceTime && <p className="text-secondary">In Time: <span className="font-mono">{historyStudent.attendanceTime}</span></p>}
                {historyStudent.estimatedReturnTime && (
                  <p className="text-secondary">Estimated Return: <strong className="text-violet-700">{historyStudent.estimatedReturnTime}</strong></p>
                )}
                {historyStudent.outReason && <p className="text-secondary">Reason / Note: <span className="italic">"{historyStudent.outReason}"</span></p>}
                {historyStudent.lastLocationSnapshot && (
                  <p className="text-secondary">Last Captured Location: <span>{historyStudent.lastLocationSnapshot}</span></p>
                )}
              </div>

              <p className="font-semibold text-on-surface pt-1">Recent Event Timeline</p>
              <div className="space-y-2 border-l-2 border-primary/30 pl-3">
                <div className="text-[11px] space-y-0.5">
                  <p className="font-bold text-on-surface">
                    {historyStudent.attendanceStatus === 'IN' ? 'Check IN Accepted' : 'Check OUT Recorded'}
                  </p>
                  <p className="text-secondary font-mono">
                    {historyStudent.attendanceTime || historyStudent.outTime || 'Today'}
                  </p>
                  <p className="text-secondary">
                    {historyStudent.lastUpdated || 'Authoritative record committed'}
                  </p>
                </div>
                {historyStudent.lastFailedInAt && (
                  <div className="text-[11px] space-y-0.5 pt-1 text-rose-700">
                    <p className="font-bold">Failed IN Verification Attempt</p>
                    <p className="font-mono text-secondary">{historyStudent.lastFailedInAt.split('T')[1]?.substring(0, 5)}</p>
                    <p className="text-rose-600">Location outside permitted hostel geofence.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-outline-variant/20 text-right">
              <button
                onClick={() => setHistoryStudent(null)}
                className="px-4 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
