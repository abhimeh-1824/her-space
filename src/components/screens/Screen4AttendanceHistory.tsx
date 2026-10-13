import React, { useState, useEffect } from 'react';
import { AppScreen, AttendanceRecord } from '../../types';
import { subscribeToAttendance } from '../../lib/db-seed';

interface Screen4AttendanceHistoryProps {
  onNavigate: (screen: AppScreen) => void;
}

type ScreenState = 'default' | 'drawer' | 'empty' | 'loading' | 'error';

export const Screen4AttendanceHistory: React.FC<Screen4AttendanceHistoryProps> = ({ onNavigate }) => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [screenState, setScreenState] = useState<ScreenState>('default');
  const [statusFilter, setStatusFilter] = useState<'All' | 'IN' | 'OUT' | 'Pending'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const unsub = subscribeToAttendance((liveRecords) => {
      setRecords(liveRecords);
      if (liveRecords.length > 0 && !selectedRecord) {
        setSelectedRecord(liveRecords[0]);
      }
    });
    return () => unsub();
  }, []);

  const filteredRecords = records.filter((rec) => {
    const matchesSearch =
      rec.refId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.date.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rec.capturedAddress && rec.capturedAddress.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === 'All'
        ? true
        : statusFilter === 'IN'
        ? rec.status === 'Confirmed IN'
        : statusFilter === 'OUT'
        ? rec.status === 'Declared OUT'
        : rec.status === 'Pending / Unconfirmed';

    return matchesSearch && matchesStatus;
  });

  const handleOpenDrawer = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setIsDrawerOpen(true);
  };

  const handleApplyState = (state: ScreenState) => {
    setScreenState(state);
    if (state === 'drawer') {
      setIsDrawerOpen(true);
    } else {
      setIsDrawerOpen(false);
    }
  };

  const handleDownload = () => {
    const headers = 'Reference ID,Date,Status,Confirmation Time,Address,Accuracy,Method\r\n';
    const rows = filteredRecords
      .map(
        (r) =>
          `"${r.refId}","${r.date}","${r.status}","${r.confirmationTime || ''}","${r.capturedAddress || ''}","${r.accuracy || ''}","${r.method || ''}"`
      )
      .join('\r\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HostelGuard_Attendance_History_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-surface font-body-md text-on-surface flex flex-col min-h-screen">
      {/* Top Header */}
      <header className="fixed top-0 w-full z-40 bg-surface-container-lowest/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(15,23,42,0.04)] pt-safe">
        <div className="h-16 px-4 flex items-center justify-between gap-2 max-w-md mx-auto">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary-container/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary-container text-[22px]">shield</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-title-sm text-title-sm text-on-surface tracking-tight truncate font-bold">
                HostelGuard
              </span>
              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-xs text-label-xs truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-container shrink-0"></span>
                <span className="truncate">Sunrise Boys · B-204</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              aria-label="Notifications"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-secondary relative hover:bg-surface-container"
              onClick={() => onNavigate('location-setup')}
            >
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-primary-container ring-2 ring-surface-container-lowest"></span>
            </button>
            <div
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm text-on-primary font-bold text-xs cursor-pointer"
              onClick={() => onNavigate('terms-privacy')}
            >
              RS
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col w-full max-w-md mx-auto pt-20 pb-24 px-4 bg-surface">
        {/* Prototype State Bar */}
        <div className="mb-2">
          <div className="bg-surface-container-high rounded-xl p-1.5 shadow-xs">
            <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
              {(
                [
                  ['default', 'Default (Records)', 'verified'],
                  ['drawer', 'Drawer Open', 'dock_to_bottom'],
                  ['empty', 'Empty State', 'inbox'],
                  ['loading', 'Loading Skeleton', 'progress_activity'],
                  ['error', 'Network Error', 'wifi_off'],
                ] as [ScreenState, string, string][]
              ).map(([st, label, icon]) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => handleApplyState(st)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-label-xs transition-all whitespace-nowrap ${
                    screenState === st
                      ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-xs'
                      : 'text-secondary hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Back Link & Page Title */}
        <div className="pt-1 pb-3 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => onNavigate('student-dashboard')}
            className="inline-flex items-center gap-1 text-primary-container font-label-sm text-label-sm hover:underline w-fit cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Back to Dashboard</span>
          </button>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-tight font-bold">
            Attendance History
          </h1>
          <p className="font-body-sm text-body-sm text-secondary">
            Review your previous hostel attendance confirmations.
          </p>

          {/* Student Banner */}
          <div className="mt-2 bg-surface-container-low rounded-xl p-3 flex items-center gap-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center shrink-0 shadow-xs text-primary-container">
              <span className="material-symbols-outlined text-[22px]">badge</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-title-sm text-title-sm text-on-surface truncate font-semibold">Rahul Sharma</span>
                <span className="px-1.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-xs text-label-xs shrink-0">
                  #21CSE084
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-secondary font-label-xs text-label-xs mt-0.5">
                <span className="material-symbols-outlined text-[14px]">night_shelter</span>
                <span className="truncate">Sunrise Boys Hostel · Room B-204</span>
              </div>
            </div>
          </div>
        </div>

        {/* VIEW: Records View */}
        {(screenState === 'default' || screenState === 'drawer') && (
          <div className="flex flex-col w-full gap-4">
            {/* Top Summary KPI Cards (2x2 Grid) */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-surface-container-lowest rounded-xl p-3 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-label-xs text-label-xs text-secondary uppercase tracking-wider">
                    Total Roll Calls
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-secondary">
                    <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-headline-md text-headline-md text-on-surface font-bold">30</span>
                  <span className="font-label-xs text-label-xs text-secondary">Sessions</span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-secondary font-label-xs text-label-xs">
                  <span className="material-symbols-outlined text-[12px]">history</span>
                  <span>Past 30 Days</span>
                </div>
              </div>

              <div className="bg-surface-container-lowest rounded-xl p-3 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-label-xs text-label-xs text-secondary uppercase tracking-wider">Confirmed IN</span>
                  <div className="w-7 h-7 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary-container">
                    <span className="material-symbols-outlined text-[16px]">login</span>
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-headline-md text-headline-md text-on-surface font-bold">24</span>
                  <span className="font-label-xs text-label-xs text-primary-container font-semibold">80% Rate</span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-secondary font-label-xs text-label-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
                  <span>Hostel Verified</span>
                </div>
              </div>

              <div className="bg-surface-container-lowest rounded-xl p-3 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-label-xs text-label-xs text-secondary uppercase tracking-wider">Declared OUT</span>
                  <div className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-tertiary">
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-headline-md text-headline-md text-on-surface font-bold">04</span>
                  <span className="font-label-xs text-label-xs text-secondary">Authorized</span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-secondary font-label-xs text-label-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  <span>Off-Premises</span>
                </div>
              </div>

              <div className="bg-surface-container-lowest rounded-xl p-3 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-label-xs text-label-xs text-secondary uppercase tracking-wider">Unconfirmed</span>
                  <div className="w-7 h-7 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px]">schedule</span>
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-headline-md text-headline-md text-on-surface font-bold">02</span>
                  <span className="font-label-xs text-label-xs text-secondary font-medium">Missed</span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-secondary font-label-xs text-label-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>
                  <span>Warden Audit Req.</span>
                </div>
              </div>
            </div>

            {/* Filter Toolbar & Search */}
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                className="w-full bg-surface-container-lowest rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-xs text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary-container text-[18px]">calendar_today</span>
                  <div className="flex flex-col">
                    <span className="font-label-xs text-label-xs text-secondary">Session Range</span>
                    <span className="font-title-sm text-title-sm text-on-surface font-semibold">
                      Last 30 Days: Sep 14 – Oct 13, 2026
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-secondary text-[20px]">expand_more</span>
              </button>

              {/* Status Chips */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                {(['All', 'IN', 'OUT', 'Pending'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setStatusFilter(filter)}
                    className={`px-3 py-1.5 rounded-full font-label-sm text-label-sm shadow-xs whitespace-nowrap cursor-pointer transition-colors ${
                      statusFilter === filter
                        ? 'bg-primary-container text-on-primary font-semibold'
                        : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    {filter === 'All'
                      ? 'All (30)'
                      : filter === 'IN'
                      ? 'IN (24)'
                      : filter === 'OUT'
                      ? 'OUT (4)'
                      : 'Pending (2)'}
                  </button>
                ))}
              </div>

              {/* Search Field */}
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search date or ref ID (e.g., #ATT-2026)..."
                  className="w-full bg-surface-container-lowest rounded-xl pl-10 pr-4 py-2.5 font-body-md text-body-md text-on-surface placeholder:text-secondary shadow-xs outline-none focus:ring-2 focus:ring-primary-container/20"
                />
              </div>

              {/* Filter Controls Row */}
              <div className="flex items-center justify-between pt-0.5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {}}
                    className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface font-label-xs text-label-xs shadow-xs hover:bg-surface-container-high transition-colors"
                  >
                    Apply Filters
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('All');
                      setSearchQuery('');
                    }}
                    className="text-secondary hover:text-on-surface font-label-xs text-label-xs cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest text-primary-container font-label-xs text-label-xs shadow-xs hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">file_download</span>
                  <span>Download My History</span>
                </button>
              </div>
            </div>

            {/* Attendance Records List */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-title-sm text-title-sm text-on-surface font-bold">Night Roll-Call Logs</h2>
                <span className="font-label-xs text-label-xs text-secondary">
                  {filteredRecords.length} records found
                </span>
              </div>

              {filteredRecords.map((record) => (
                <div key={record.id} className="bg-surface-container-lowest rounded-xl p-3.5 shadow-sm flex flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary-container">
                        <span className="material-symbols-outlined text-[18px]">verified_user</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-title-sm text-title-sm text-on-surface font-semibold">{record.date}</span>
                          <span className="font-code-sm text-code-sm text-secondary">{record.refId}</span>
                        </div>
                        <span className="font-label-xs text-label-xs text-secondary">
                          {record.status === 'Declared OUT'
                            ? 'Off-Premise Leave Pass'
                            : record.status === 'Pending / Unconfirmed'
                            ? 'Curfew Check Window'
                            : 'Night Roll-Call Confirmation'}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label-xs text-label-xs font-semibold shrink-0 ${
                        record.status === 'Confirmed IN'
                          ? 'bg-surface-container-low text-primary-container'
                          : record.status === 'Declared OUT'
                          ? 'bg-surface-container text-secondary'
                          : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          record.status === 'Confirmed IN'
                            ? 'bg-primary-container'
                            : record.status === 'Declared OUT'
                            ? 'bg-secondary'
                            : 'bg-outline'
                        }`}
                      ></span>
                      <span>{record.status}</span>
                    </span>
                  </div>

                  <div className="bg-surface-container-low rounded-lg p-2.5 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-label-xs font-label-xs">
                      <span className="text-secondary flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">schedule</span> Confirmation Time:
                      </span>
                      <span className="text-on-surface font-semibold">
                        {record.confirmationTime || 'Not confirmed'}
                      </span>
                    </div>
                    <div className="flex items-start justify-between text-label-xs font-label-xs gap-2">
                      <span className="text-secondary flex items-center gap-1 shrink-0">
                        <span className="material-symbols-outlined text-[14px]">pin_drop</span> Captured Address:
                      </span>
                      <span className="text-on-surface text-right truncate">
                        {record.capturedAddress || 'Unavailable'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-label-xs font-label-xs">
                      <span className="text-secondary flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">radar</span> Accuracy:
                      </span>
                      <span className="text-primary-container font-medium flex items-center gap-1">
                        <span>{record.accuracy || 'Not available'}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="font-label-xs text-label-xs text-secondary">{record.method}</span>
                    <button
                      type="button"
                      onClick={() => handleOpenDrawer(record)}
                      className="inline-flex items-center gap-1 text-primary-container font-label-sm text-label-sm font-semibold hover:underline cursor-pointer"
                    >
                      <span>View Details</span>
                      <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="pt-2 pb-2">
              <div className="bg-surface-container-lowest rounded-xl p-3 shadow-xs flex items-center justify-between">
                <span className="font-label-xs text-label-xs text-secondary">
                  Showing 1–{filteredRecords.length} of 30 records
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    className="w-7 h-7 rounded-lg bg-surface-container text-secondary flex items-center justify-center opacity-50 cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                  </button>
                  {[1, 2, 3].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCurrentPage(p)}
                      className={`w-7 h-7 rounded-lg font-label-xs text-label-xs font-semibold flex items-center justify-center ${
                        currentPage === p
                          ? 'bg-primary-container text-on-primary shadow-xs'
                          : 'text-secondary hover:bg-surface-container'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCurrentPage(2)}
                    className="w-7 h-7 rounded-lg bg-surface-container text-on-surface flex items-center justify-center hover:bg-surface-container-high cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: Empty State */}
        {screenState === 'empty' && (
          <div className="py-8 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-2xl bg-surface-container-low flex items-center justify-center mb-4 shadow-xs text-secondary">
              <span className="material-symbols-outlined text-[40px]">calendar_today</span>
            </div>
            <h3 className="font-title-md text-title-md text-on-surface font-bold">No attendance records yet</h3>
            <p className="font-body-md text-body-md text-secondary max-w-xs mt-1">
              Your confirmed attendance history will appear here once roll-call sessions commence.
            </p>
            <button
              type="button"
              onClick={() => handleApplyState('default')}
              className="mt-5 px-4 py-2 rounded-xl bg-primary-container text-on-primary font-label-sm text-label-sm shadow-xs hover:bg-primary transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              <span>Refresh Roster</span>
            </button>
          </div>
        )}

        {/* VIEW: Loading Skeleton */}
        {screenState === 'loading' && (
          <div className="flex flex-col gap-3 py-2 animate-pulse">
            <div className="grid grid-cols-2 gap-2.5 mb-2">
              <div className="h-24 rounded-xl bg-surface-container"></div>
              <div className="h-24 rounded-xl bg-surface-container"></div>
              <div className="h-24 rounded-xl bg-surface-container"></div>
              <div className="h-24 rounded-xl bg-surface-container"></div>
            </div>
            {[1, 2].map((i) => (
              <div key={i} className="bg-surface-container-lowest rounded-xl p-4 shadow-xs flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-surface-container"></div>
                    <div className="w-32 h-4 rounded bg-surface-container"></div>
                  </div>
                  <div className="w-20 h-5 rounded-full bg-surface-container"></div>
                </div>
                <div className="h-16 rounded-lg bg-surface-container-low"></div>
                <div className="w-24 h-4 rounded bg-surface-container self-end"></div>
              </div>
            ))}
          </div>
        )}

        {/* VIEW: Network Error */}
        {screenState === 'error' && (
          <div className="py-8 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-2xl bg-surface-container-high flex items-center justify-center mb-4 shadow-xs text-secondary">
              <span className="material-symbols-outlined text-[40px]">wifi_off</span>
            </div>
            <h3 className="font-title-md text-title-md text-on-surface font-bold">Connection Interrupted</h3>
            <p className="font-body-md text-body-md text-secondary max-w-xs mt-1">
              Unable to load attendance records. Re-authenticating session or check connection.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleApplyState('default')}
                className="px-4 py-2 rounded-xl bg-primary-container text-on-primary font-label-sm text-label-sm shadow-xs hover:bg-primary transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">replay</span>
                <span>Retry</span>
              </button>
            </div>
          </div>
        )}

        {/* Privacy & Accessibility Notice */}
        <div className="pt-2">
          <div className="p-3 rounded-xl bg-surface-container-low flex items-start gap-2.5">
            <span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">lock</span>
            <p className="font-body-sm text-body-sm text-secondary">
              Records shown are strictly restricted to your authenticated student profile (
              <span className="text-on-surface font-medium">Rahul Sharma · #21CSE084</span>). All audit stamps are cryptographically sealed.
            </p>
          </div>
        </div>
      </main>

      {/* Record Details Bottom Sheet Modal (Drawer) */}
      {isDrawerOpen && selectedRecord && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex flex-col justify-end"
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            className="bg-surface-container-lowest rounded-t-2xl shadow-xl max-h-[750px] overflow-y-auto w-full max-w-md mx-auto flex flex-col animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle & Header */}
            <div className="sticky top-0 bg-surface-container-lowest/90 backdrop-blur-md pt-3 pb-2 px-4 z-10">
              <div className="w-12 h-1 bg-surface-container-high rounded-full mx-auto mb-3"></div>
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-label-xs text-label-xs text-secondary uppercase tracking-wider font-semibold">
                    Audit Inspection
                  </span>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    Record {selectedRecord.refId}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface transition-colors cursor-pointer"
                  onClick={() => setIsDrawerOpen(false)}
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-4 py-3 flex flex-col gap-3.5">
              {/* Status Banner */}
              <div className="bg-surface-container-low rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                  </div>
                  <div>
                    <span className="font-label-xs text-label-xs text-secondary">Final Declared Status</span>
                    <p className="font-title-sm text-title-sm text-on-surface font-semibold">
                      {selectedRecord.status === 'Confirmed IN'
                        ? 'Confirmed IN (Present)'
                        : selectedRecord.status}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-primary-container/10 text-primary-container font-label-xs text-label-xs font-semibold">
                  On-Time
                </span>
              </div>

              {/* Audit Summary List */}
              <div className="bg-surface-container-lowest rounded-xl p-3.5 shadow-sm border border-outline-variant/30 flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-label-sm font-label-sm">
                  <span className="text-secondary">Attendance Date:</span>
                  <span className="text-on-surface font-semibold">{selectedRecord.date}</span>
                </div>
                <div className="flex items-center justify-between text-label-sm font-label-sm">
                  <span className="text-secondary">Confirmation Method:</span>
                  <span className="text-on-surface font-medium">{selectedRecord.method}</span>
                </div>
                <div className="flex items-center justify-between text-label-sm font-label-sm">
                  <span className="text-secondary">Confirmation Timestamp:</span>
                  <span className="text-on-surface font-semibold font-code-sm text-code-sm">
                    {selectedRecord.confirmationTime}
                  </span>
                </div>
                <div className="flex items-center justify-between text-label-sm font-label-sm">
                  <span className="text-secondary">Session Deadline (Curfew):</span>
                  <span className="text-secondary font-medium font-code-sm text-code-sm">12:00:00 AM IST</span>
                </div>
              </div>

              {/* Location Verification Card */}
              <div className="bg-surface-container-lowest rounded-xl p-3.5 shadow-sm border border-outline-variant/30 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary-container text-[18px]">my_location</span>
                    <span className="font-title-sm text-title-sm text-on-surface font-bold">Last Captured Location</span>
                  </div>
                  <span className="font-label-xs text-label-xs text-secondary">(Manual Snapshot)</span>
                </div>

                {/* Map Preview */}
                <div className="relative w-full h-36 rounded-xl bg-surface-container overflow-hidden flex items-center justify-center shadow-inner">
                  <svg className="absolute inset-0 w-full h-full opacity-40 text-secondary" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <pattern id="grid-pattern-att" width="24" height="24" patternUnits="userSpaceOnUse">
                        <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="0.5" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid-pattern-att)" />
                  </svg>
                  <div className="absolute w-28 h-28 rounded-full bg-primary-container/10 flex items-center justify-center animate-pulse">
                    <div className="w-16 h-16 rounded-full bg-primary-container/20 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-md">
                        <span className="material-symbols-outlined text-[14px]">location_on</span>
                      </div>
                    </div>
                  </div>
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-surface-container-lowest/90 backdrop-blur-sm text-secondary font-code-sm text-code-sm shadow-xs">
                    Sunrise Hostel Zone B · 31.9579° N, 77.1095° E
                  </div>
                </div>

                {/* Specs */}
                <div className="bg-surface-container-low rounded-lg p-2.5 flex flex-col gap-1.5">
                  <div className="flex items-start justify-between text-label-xs font-label-xs gap-2">
                    <span className="text-secondary shrink-0">Resolved Address:</span>
                    <span className="text-on-surface font-medium text-right truncate">
                      {selectedRecord.capturedAddress}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-label-xs font-label-xs">
                    <span className="text-secondary">GPS Accuracy:</span>
                    <span className="text-primary-container font-semibold">
                      {selectedRecord.accuracy || '±20 metres'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-label-xs font-label-xs">
                    <span className="text-secondary">Capture Timestamp:</span>
                    <span className="text-on-surface font-code-sm text-code-sm">10:05:38 PM IST</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-surface-container-low flex items-start gap-2">
                  <span className="material-symbols-outlined text-secondary text-[16px] shrink-0 mt-0.5">
                    verified_user
                  </span>
                  <p className="font-label-xs text-label-xs text-secondary">
                    Location snapshot captured strictly upon submission. Background tracking is never performed.
                  </p>
                </div>
              </div>

              {/* Dismiss Button */}
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="w-full py-3 rounded-xl bg-surface-container text-on-surface font-title-sm text-title-sm font-semibold hover:bg-surface-container-high transition-colors shadow-xs cursor-pointer mb-2"
              >
                Dismiss Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 w-full z-40 pb-safe bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_-1px_12px_rgba(15,23,42,0.05)] border-t border-outline-variant/30">
        <div className="flex items-center justify-around h-16 max-w-md mx-auto px-1">
          <button
            type="button"
            onClick={() => onNavigate('student-dashboard')}
            className="flex flex-col items-center justify-center gap-1 w-16 h-12 text-secondary hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">dashboard</span>
            <span className="font-label-xs text-label-xs">Dashboard</span>
          </button>
          <button
            type="button"
            className="flex flex-col items-center justify-center gap-1 w-16 h-12 text-primary-container font-medium"
          >
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              how_to_reg
            </span>
            <span className="font-label-xs text-label-xs">Attendance</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('location-setup')}
            className="flex flex-col items-center justify-center gap-1 w-16 h-12 text-secondary hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            <span className="font-label-xs text-label-xs">Alerts</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('terms-privacy')}
            className="flex flex-col items-center justify-center gap-1 w-16 h-12 text-secondary hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">account_circle</span>
            <span className="font-label-xs text-label-xs">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
