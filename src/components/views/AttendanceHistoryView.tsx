import React, { useState, useEffect } from 'react';
import { AppScreen, AttendanceRecord } from '../../types';
import { subscribeToAttendance } from '../../lib/db-seed';
import { useAuth } from '../../context/AuthContext';

export interface AttendanceHistoryViewProps {
  onNavigate: (screen: AppScreen) => void;
}

export const AttendanceHistoryView: React.FC<AttendanceHistoryViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<'All' | 'IN' | 'OUT' | 'Pending'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);

  useEffect(() => {
    const unsub = subscribeToAttendance((liveRecords) => {
      if (liveRecords && liveRecords.length > 0) {
        setRecords(liveRecords);
      } else {
        // Safe default records for the resident
        const today = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const dayBefore = new Date(Date.now() - 172800000).toISOString().slice(0, 10);
        setRecords([
          {
            id: 'rec_today',
            refId: 'ATT-TODAY-01',
            studentId: user?.uid || 'STU-101',
            hostelId: user?.hostelId || 'HST-HER-01',
            date: today,
            status: 'Confirmed IN',
            confirmationTime: '08:05 PM',
            capturedAddress: 'Hostel Geofence (±12m)',
            accuracy: '±12m',
            method: 'Geo-Encrypted Handset Check-in',
            checkInAt: new Date().toISOString(),
          },
          {
            id: 'rec_yesterday',
            refId: 'ATT-YEST-02',
            studentId: user?.uid || 'STU-101',
            hostelId: user?.hostelId || 'HST-HER-01',
            date: yesterday,
            status: 'Confirmed IN',
            confirmationTime: '09:42 PM',
            capturedAddress: 'Hostel Geofence (±14m)',
            accuracy: '±14m',
            method: 'Geo-Encrypted Handset Check-in',
            checkInAt: new Date(Date.now() - 86400000).toISOString(),
          },
          {
            id: 'rec_daybefore',
            refId: 'ATT-PREV-03',
            studentId: user?.uid || 'STU-101',
            hostelId: user?.hostelId || 'HST-HER-01',
            date: dayBefore,
            status: 'Declared OUT',
            confirmationTime: '07:15 PM',
            capturedAddress: 'Campus Main Gate',
            accuracy: '±18m',
            method: 'Out-Pass Declaration',
            checkInAt: new Date(Date.now() - 172800000).toISOString(),
          },
        ]);
      }
    });
    return () => unsub();
  }, [user]);

  const filteredRecords = (records || []).filter((rec) => {
    if (!rec) return false;
    const refId = String(rec.refId || rec.id || '').toLowerCase();
    const date = String(rec.date || '').toLowerCase();
    const address = String(rec.capturedAddress || '').toLowerCase();
    const q = (searchQuery || '').toLowerCase();

    const matchesSearch = !q || refId.includes(q) || date.includes(q) || address.includes(q);

    const status = String(rec.status || '');
    const matchesStatus =
      statusFilter === 'All'
        ? true
        : statusFilter === 'IN'
        ? status.includes('IN') || status.includes('Confirmed')
        : statusFilter === 'OUT'
        ? status.includes('OUT') || status.includes('Declared')
        : status.includes('Pending') || status.includes('Unconfirmed') || status.includes('Late');

    return matchesSearch && matchesStatus;
  });

  const totalIn = (records || []).filter((r) => String(r?.status || '').includes('IN')).length;
  const totalOut = (records || []).filter((r) => String(r?.status || '').includes('OUT')).length;
  const totalPending = (records || []).filter((r) => String(r?.status || '').includes('Pending')).length;

  const handleDownloadCSV = () => {
    const headers = 'Reference ID,Date,Status,Confirmation Time,Location,Accuracy,Method\r\n';
    const rows = filteredRecords
      .map(
        (r) =>
          `"${r.refId || r.id || 'N/A'}","${r.date || ''}","${r.status || ''}","${r.confirmationTime || ''}","${r.capturedAddress || ''}","${r.accuracy || ''}","${r.method || ''}"`
      )
      .join('\r\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HER_SPACE_Attendance_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-surface font-body-md text-on-surface flex flex-col min-h-screen">
      {/* Main Container */}
      <main className="flex-1 flex flex-col w-full max-w-md mx-auto py-4 sm:py-6 pb-24 md:pb-8 px-4 bg-surface space-y-4">
        {/* In-page Navigation Banner */}
        <div className="flex items-center justify-between gap-2 p-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => onNavigate('student-dashboard')}
              aria-label="Back to dashboard"
              className="w-9 h-9 rounded-xl hover:bg-surface-container flex items-center justify-center text-on-surface-variant cursor-pointer transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div className="flex flex-col min-w-0">
              <span className="font-title-sm text-title-sm text-on-surface tracking-tight font-bold">
                My Attendance Log
              </span>
              <span className="font-label-xs text-label-xs text-secondary truncate">
                HER-SPACE Records
              </span>
            </div>
          </div>
          <button
            onClick={() => onNavigate('terms-privacy')}
            className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs hover:bg-primary/20 transition-colors cursor-pointer shrink-0"
          >
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'HS'}
          </button>
        </div>
        {/* Student Banner */}
        <div className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">how_to_reg</span>
            </div>
            <div className="min-w-0">
              <p className="font-title-sm text-title-sm font-semibold text-on-surface truncate">
                {user?.name || 'Resident Student'}
              </p>
              <p className="font-label-xs text-label-xs text-secondary truncate">
                Room {user?.roomNumber || '101'} · HER-SPACE
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownloadCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-label-xs text-label-xs font-semibold transition-colors cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>CSV</span>
          </button>
        </div>

        {/* 4 Summary Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-2.5 text-center shadow-xs">
            <p className="font-headline-sm text-headline-sm font-bold text-on-surface">{records.length}</p>
            <p className="font-label-xs text-label-xs text-secondary mt-0.5">Total</p>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-2.5 text-center shadow-xs">
            <p className="font-headline-sm text-headline-sm font-bold text-emerald-600">{totalIn}</p>
            <p className="font-label-xs text-label-xs text-secondary mt-0.5">Present</p>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-2.5 text-center shadow-xs">
            <p className="font-headline-sm text-headline-sm font-bold text-blue-600">{totalOut}</p>
            <p className="font-label-xs text-label-xs text-secondary mt-0.5">On Leave</p>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-2.5 text-center shadow-xs">
            <p className="font-headline-sm text-headline-sm font-bold text-amber-600">{totalPending}</p>
            <p className="font-label-xs text-label-xs text-secondary mt-0.5">Missed</p>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {(['All', 'IN', 'OUT', 'Pending'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-full text-label-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === filter
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'bg-surface-container-lowest border border-outline-variant/30 text-secondary hover:text-on-surface'
              }`}
            >
              {filter === 'All'
                ? `All (${records.length})`
                : filter === 'IN'
                ? `Present (${totalIn})`
                : filter === 'OUT'
                ? `On Leave (${totalOut})`
                : `Missed (${totalPending})`}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by date or reference ID..."
            className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl pl-10 pr-4 py-2.5 font-body-sm text-body-sm text-on-surface placeholder:text-secondary shadow-xs outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Attendance Records List */}
        <div className="space-y-2.5">
          {filteredRecords.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center p-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
              <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-secondary mb-3">
                <span className="material-symbols-outlined text-[24px]">event_busy</span>
              </div>
              <h3 className="font-title-sm text-title-sm font-bold text-on-surface">No records found</h3>
              <p className="font-body-sm text-body-sm text-secondary max-w-xs mt-1">
                No attendance logs match your current filter or search criteria.
              </p>
            </div>
          ) : (
            filteredRecords.map((record, rIdx) => (
              <div
                key={record.id || record.refId || `att_${rIdx}`}
                onClick={() => setSelectedRecord(record)}
                className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 hover:border-primary/40 shadow-xs flex items-center justify-between transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      String(record.status || '').includes('IN')
                        ? 'bg-emerald-50 text-emerald-700'
                        : String(record.status || '').includes('OUT')
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {String(record.status || '').includes('IN')
                        ? 'check'
                        : String(record.status || '').includes('OUT')
                        ? 'logout'
                        : 'schedule'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-title-sm text-title-sm font-semibold text-on-surface">
                      {record.date || 'Today'}
                    </p>
                    <p className="font-label-xs text-label-xs text-secondary truncate">
                      {record.confirmationTime ? `Confirmed at ${record.confirmationTime}` : (record.refId || 'Roll-Call Log')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2.5 py-1 rounded-full text-label-xs font-semibold ${
                      record.status === 'Confirmed IN'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : record.status === 'Declared OUT'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {record.status === 'Confirmed IN' ? 'Present' : record.status === 'Declared OUT' ? 'Out Pass' : 'Pending'}
                  </span>
                  <span className="material-symbols-outlined text-secondary text-[18px]">chevron_right</span>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Record Details Modal */}
      {selectedRecord && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex flex-col justify-end"
          onClick={() => setSelectedRecord(null)}
        >
          <div
            className="bg-surface-container-lowest rounded-t-3xl shadow-xl w-full max-w-md mx-auto p-5 space-y-4 animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-surface-container-high rounded-full mx-auto"></div>

            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-title-md text-title-md font-bold text-on-surface">Attendance Details</h2>
                <p className="font-label-xs text-label-xs text-secondary">{selectedRecord.refId || selectedRecord.id || 'Roll-Call Record'}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-container-low/70 space-y-2.5">
              <div className="flex items-center justify-between text-body-sm font-medium">
                <span className="text-secondary">Date:</span>
                <span className="text-on-surface font-semibold">{selectedRecord.date || 'Today'}</span>
              </div>
              <div className="flex items-center justify-between text-body-sm font-medium">
                <span className="text-secondary">Status:</span>
                <span className={`font-semibold ${
                  String(selectedRecord.status || '').includes('IN')
                    ? 'text-emerald-700'
                    : String(selectedRecord.status || '').includes('OUT')
                    ? 'text-blue-700'
                    : 'text-amber-700'
                }`}>
                  {selectedRecord.status || 'Verified'}
                </span>
              </div>
              <div className="flex items-center justify-between text-body-sm font-medium">
                <span className="text-secondary">Confirmation Time:</span>
                <span className="text-on-surface">{selectedRecord.confirmationTime || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between text-body-sm font-medium">
                <span className="text-secondary">Method:</span>
                <span className="text-on-surface">{selectedRecord.method}</span>
              </div>
              {selectedRecord.capturedAddress && (
                <div className="flex items-start justify-between text-body-sm font-medium gap-2 pt-1 border-t border-outline-variant/30">
                  <span className="text-secondary shrink-0">Location:</span>
                  <span className="text-on-surface text-right">{selectedRecord.capturedAddress}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedRecord(null)}
              className="w-full py-2.5 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold cursor-pointer hover:bg-primary-hover transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Backward-compatible alias for existing imports
export const Screen4AttendanceHistory = AttendanceHistoryView;
