import React, { useState, useEffect } from 'react';
import { AppScreen, Hostel } from '../../types';
import {
  subscribeToHostels,
  subscribeToWardens,
  saveHostelToDb,
  saveWardenToDb,
  refetchHostelsFromDb,
  refetchWardensFromDb,
} from '../../lib/db-seed';
import { useAuth } from '../../context/AuthContext';

export interface HostelRegistrationViewProps {
  onNavigate: (screen: AppScreen) => void;
  onLogout: () => void;
}

const DEFAULT_REMINDER_TIMES = ['22:15', '23:00', '23:30'];

interface RegisteredWarden {
  id: string;
  name: string;
  email: string;
  hostelMemberships?: string[];
  hostelId?: string;
  phone?: string;
}

export const HostelRegistrationView: React.FC<HostelRegistrationViewProps> = ({
  onNavigate,
  onLogout,
}) => {
  const { user } = useAuth();
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [wardens, setWardens] = useState<RegisteredWarden[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingHostel, setEditingHostel] = useState<Hostel | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('31.9578');
  const [longitude, setLongitude] = useState('77.1095');
  const [radiusMeters, setRadiusMeters] = useState('200');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [curfewStart, setCurfewStart] = useState('22:00');
  const [curfewEnd, setCurfewEnd] = useState('00:00');
  const [wardenEmail, setWardenEmail] = useState('');
  const [reminders, setReminders] = useState<string[]>(DEFAULT_REMINDER_TIMES);
  const [newReminderTime, setNewReminderTime] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubHostels = subscribeToHostels((liveHostels) => {
      const seen = new Set<string>();
      const unique = liveHostels.filter((h) => {
        if (!h.id || seen.has(h.id)) return false;
        seen.add(h.id);
        return true;
      });
      setHostels(unique);
    });
    const unsubWardens = subscribeToWardens((liveWardens) => {
      setWardens(liveWardens);
    });

    // Always fetch fresh truth from Firestore on mount
    refetchHostelsFromDb();
    refetchWardensFromDb();

    return () => {
      unsubHostels();
      unsubWardens();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenCreate = () => {
    setEditingHostel(null);
    setName('');
    setAddress('');
    setLatitude('31.9578');
    setLongitude('77.1095');
    setRadiusMeters('200');
    setTimezone('Asia/Kolkata');
    setCurfewStart('22:00');
    setCurfewEnd('00:00');
    setWardenEmail('');
    setReminders(DEFAULT_REMINDER_TIMES);
    setStatus('active');
    setShowModal(true);
  };

  const handleOpenEdit = (h: Hostel) => {
    setEditingHostel(h);
    setName(h.name);
    setAddress(h.address || 'HER-SPACE Campus Residency Complex');
    setLatitude(String(h.geofenceLatitude || 31.9578));
    setLongitude(String(h.geofenceLongitude || 77.1095));
    setRadiusMeters(String(h.geofenceRadiusMeters || 200));
    setTimezone(h.timezone || 'Asia/Kolkata');
    setCurfewStart(h.curfewStart || '22:00');
    setCurfewEnd(h.curfewEnd || (h as any).curfewTime || '00:00');
    setWardenEmail(h.wardenEmail || '');
    setReminders(h.reminderSchedule || DEFAULT_REMINDER_TIMES);
    setStatus(h.status || 'active');
    setShowModal(true);
  };

  const handleAddReminderTime = () => {
    const trimmed = newReminderTime.trim();
    if (!trimmed) return;
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmed)) {
      showToast('Please enter a valid 24-hr time in HH:MM format (e.g. 22:45)');
      return;
    }
    if (!reminders.includes(trimmed)) {
      setReminders([...reminders, trimmed].sort());
    }
    setNewReminderTime('');
  };

  const handleRemoveReminderTime = (time: string) => {
    setReminders(reminders.filter((t) => t !== time));
  };

  const handleSaveHostel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Hostel name is required.');
      return;
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const rad = parseInt(radiusMeters, 10);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      showToast('Invalid latitude coordinate (-90 to 90).');
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      showToast('Invalid longitude coordinate (-180 to 180).');
      return;
    }
    if (isNaN(rad) || rad < 20 || rad > 2000) {
      showToast('Permitted IN radius must be between 20 and 2000 meters.');
      return;
    }

    const targetHostelId = editingHostel ? editingHostel.id : `HST-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const hostelData: Hostel = {
      id: targetHostelId,
      name: name.trim(),
      address: address.trim(),
      geofenceLatitude: lat,
      geofenceLongitude: lng,
      geofenceRadiusMeters: rad,
      timezone,
      curfewStart,
      curfewEnd,
      curfewTime: curfewEnd,
      wardenEmail: wardenEmail.trim(),
      reminderSchedule: reminders,
      status,
      capacity: editingHostel?.capacity || 100,
      totalStudents: editingHostel?.totalStudents || 0,
      activeShift: editingHostel?.activeShift || 'Night Curfew Shift',
    };

    // Save directly to Firestore hostels collection
    try {
      await saveHostelToDb(hostelData);
    } catch (err) {
      console.warn('[HostelRegistrationView] Save hostel Firestore note:', err);
    }

    // If warden is selected, update that warden's memberships in Firestore
    if (wardenEmail.trim()) {
      const matchedWarden = wardens.find((w) => w.email.toLowerCase() === wardenEmail.trim().toLowerCase());
      if (matchedWarden) {
        const existingMemberships = matchedWarden.hostelMemberships || [];
        if (!existingMemberships.includes(targetHostelId)) {
          const updatedMemberships = [...existingMemberships, targetHostelId];
          const mw = matchedWarden as any;
          saveWardenToDb({
            id: mw.id,
            name: mw.name,
            email: mw.email,
            phone: mw.phone || '',
            hostelId: targetHostelId,
            hostelMemberships: updatedMemberships,
            status: mw.status || 'active',
            inviteToken: mw.inviteToken || '',
            inviteStatus: mw.inviteStatus || 'pending',
            passwordSet: mw.passwordSet ?? false,
          }).catch((err) => {
            console.warn('[HostelRegistrationView] Update warden memberships note:', err);
          });
        }
      }
    }

    if (editingHostel) {
      setHostels((prev) => prev.map((h) => (h.id === editingHostel.id ? hostelData : h)));
      showToast(`Updated hostel "${name}" in database.`);
    } else {
      setHostels((prev) => {
        const filtered = prev.filter((h) => h.id !== targetHostelId);
        return [hostelData, ...filtered];
      });
      showToast(`Registered hostel "${name}" in database.`);
    }

    setShowModal(false);
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchHostelsFromDb(), refetchWardensFromDb()]);
      showToast('Hostels synced with database');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (user && user.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-rose-500/40 rounded-3xl p-6 text-center shadow-2xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
            <span className="material-symbols-outlined text-3xl">gpp_bad</span>
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">403 — Administrator Required</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Hostel registration and boundary setup require institutional administrator privileges. Wardens can only monitor attendance for their assigned hostels.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => onNavigate('warden-dashboard')}
              className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-lg shadow-violet-600/30 cursor-pointer transition-colors"
            >
              Return to Warden Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen flex flex-col">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-slate-800 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium border border-violet-500/40">
            <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* In-page responsive content */}
      <main className="max-w-6xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 space-y-5 sm:space-y-6 pb-24 md:pb-8">
        {/* Page Title & Action Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[22px]">domain</span>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-on-surface leading-tight">Hostel Registration &amp; Settings</h1>
              <p className="text-xs text-secondary mt-0.5">Manage independent hostels, location geofences, and reminder schedules</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="px-3 py-2 rounded-xl border border-outline-variant/40 hover:bg-surface-container-low text-on-surface text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
              title="Sync fresh data from Firestore database"
            >
              <span className={`material-symbols-outlined text-[16px] ${isRefreshing ? 'animate-spin' : ''}`}>sync</span>
              <span>{isRefreshing ? 'Syncing...' : 'Sync Database'}</span>
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-on-primary text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">add_business</span>
              <span>Register New Hostel</span>
            </button>
          </div>
        </div>

        {/* Info card */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-emerald-700 text-xl mt-0.5">location_on</span>
          <div className="text-xs text-emerald-900 space-y-0.5">
            <p className="font-bold">Independent Hostel Isolation</p>
            <p className="text-emerald-800">
              Each hostel operates independently with its own coordinates, allowed check-in radius, time zone, reminder schedule, and assigned wardens. Residents only check in against their assigned hostel boundary.
            </p>
          </div>
        </div>

        {/* Hostel Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {hostels.length === 0 ? (
            <div className="col-span-full py-16 px-6 text-center bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant/40 flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl">domain_add</span>
              </div>
              <h3 className="font-bold text-base text-on-surface">No Hostels Registered Yet</h3>
              <p className="text-xs text-secondary max-w-md">
                Register your first hostel branch or residency building to configure boundaries, curfew times, and resident check-ins.
              </p>
              <button
                onClick={handleOpenCreate}
                className="mt-2 px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
              >
                <span className="material-symbols-outlined text-base">add</span>
                <span>Register First Hostel</span>
              </button>
            </div>
          ) : (
            Array.from(new Map(hostels.map((h) => [h.id, h])).values()).map((h) => (
            <div
              key={h.id}
              className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-xs p-5 flex flex-col justify-between hover:border-primary/40 transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary font-mono text-[11px] font-bold">
                    {h.id}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      h.status === 'inactive'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {h.status === 'inactive' ? 'Inactive' : 'Active'}
                  </span>
                </div>

                <div>
                  <h3 className="font-title-md font-bold text-on-surface">{h.name}</h3>
                  <p className="text-xs text-secondary line-clamp-1">{h.address || 'Campus Residency Complex'}</p>
                </div>

                <div className="bg-surface-container-low rounded-xl p-3 text-xs space-y-1.5 border border-outline-variant/20">
                  <div className="flex justify-between">
                    <span className="text-secondary">Coordinates:</span>
                    <span className="font-mono text-on-surface font-medium">
                      {(h.geofenceLatitude || 31.9578).toFixed(4)}°, {(h.geofenceLongitude || 77.1095).toFixed(4)}°
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Permitted Radius:</span>
                    <span className="font-bold text-primary">
                      {h.geofenceRadiusMeters || 200} meters
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Time Zone:</span>
                    <span className="text-on-surface">{h.timezone || 'Asia/Kolkata'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-secondary">Night Curfew:</span>
                    <span className="font-semibold text-rose-600">
                      {h.curfewStart || '22:00'} — {h.curfewEnd || (h as any).curfewTime || '00:00'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-secondary">Assigned Warden:</span>
                    <span className="text-on-surface font-medium truncate max-w-[150px] text-right" title={h.wardenEmail || 'Unassigned'}>
                      {wardens.find((w) => w.email.toLowerCase() === (h.wardenEmail || '').toLowerCase())
                        ? `${wardens.find((w) => w.email.toLowerCase() === (h.wardenEmail || '').toLowerCase())?.name}`
                        : h.wardenEmail || 'Unassigned'}
                    </span>
                  </div>
                </div>

                {/* Reminder times summary */}
                <div>
                  <p className="text-[11px] font-semibold text-secondary mb-1">Reminder Schedule:</p>
                  <div className="flex flex-wrap gap-1">
                    {(h.reminderSchedule || DEFAULT_REMINDER_TIMES).map((time) => (
                      <span
                        key={time}
                        className="px-2 py-0.5 rounded bg-surface-container text-on-surface text-[10px] font-mono font-medium border border-outline-variant/30"
                      >
                        {time}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-outline-variant/20 flex items-center justify-between">
                <button
                  onClick={() => handleOpenEdit(h)}
                  className="px-3 py-1.5 rounded-xl border border-outline-variant/30 hover:bg-surface-container text-xs font-semibold cursor-pointer transition-colors"
                >
                  Edit Settings & Boundary
                </button>
                <button
                  onClick={() => onNavigate('warden-dashboard')}
                  className="text-primary hover:text-primary-hover text-xs font-semibold cursor-pointer"
                >
                  View Attendance →
                </button>
              </div>
            </div>
          ))
        )}
        </div>
      </main>

      {/* Register / Edit Hostel Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="max-w-lg w-full bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <h3 className="font-title-md font-bold text-on-surface">
                {editingHostel ? `Edit ${editingHostel.name}` : 'Register New Hostel'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-secondary hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveHostel} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-on-surface mb-1">Hostel Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. HER-SPACE Residency (North Wing)"
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2 text-sm text-on-surface outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-on-surface mb-1">Physical Address *</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Central Residency Complex, North Wing"
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2 text-sm text-on-surface outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-on-surface mb-1">Latitude Coordinate *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="31.9578"
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2 text-sm text-on-surface font-mono outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-on-surface mb-1">Longitude Coordinate *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="77.1095"
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2 text-sm text-on-surface font-mono outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-on-surface mb-1">
                    Permitted IN Radius (Meters) *
                  </label>
                  <input
                    type="number"
                    min={20}
                    max={2000}
                    required
                    value={radiusMeters}
                    onChange={(e) => setRadiusMeters(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2 text-sm text-on-surface font-mono outline-none focus:border-primary"
                  />
                  <p className="text-[10px] text-secondary mt-0.5">Students outside this radius cannot check IN.</p>
                </div>
                <div>
                  <label className="block font-semibold text-on-surface mb-1">Hostel Time Zone *</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2 text-sm text-on-surface outline-none focus:border-primary"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                    <option value="UTC">UTC (Coordinated Universal Time)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-on-surface mb-1">Check-In Opens *</label>
                  <input
                    type="time"
                    required
                    value={curfewStart}
                    onChange={(e) => setCurfewStart(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2 text-sm text-on-surface outline-none focus:border-primary"
                  />
                  <p className="text-[10px] text-secondary mt-0.5">Start of roll-call window</p>
                </div>
                <div>
                  <label className="block font-semibold text-on-surface mb-1">Curfew Cutoff *</label>
                  <input
                    type="time"
                    required
                    value={curfewEnd}
                    onChange={(e) => setCurfewEnd(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2 text-sm text-on-surface font-bold text-red-600 outline-none focus:border-primary"
                  />
                  <p className="text-[10px] text-secondary mt-0.5">Strict curfew deadline</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-semibold text-on-surface text-xs">
                    Assigned Duty Warden <span className="text-secondary font-normal">(Registered Wardens)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      onNavigate('warden-assignment');
                    }}
                    className="text-primary hover:underline text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">person_add</span>
                    <span>+ Register New Warden</span>
                  </button>
                </div>

                <div className="relative">
                  <select
                    value={wardenEmail}
                    onChange={(e) => {
                      if (e.target.value === '__register_warden__') {
                        setShowModal(false);
                        onNavigate('warden-assignment');
                      } else {
                        setWardenEmail(e.target.value);
                      }
                    }}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-sm text-on-surface outline-none focus:border-primary cursor-pointer appearance-none pr-9 font-medium"
                  >
                    <option value="">
                      {wardens.length > 0 ? '-- Select Registered Warden --' : '-- No Registered Wardens Found --'}
                    </option>
                    {wardens.map((w) => (
                      <option key={w.id} value={w.email}>
                        {w.name} ({w.email})
                      </option>
                    ))}
                    {editingHostel && wardenEmail && !wardens.some((w) => w.email.toLowerCase() === wardenEmail.toLowerCase()) && (
                      <option value={wardenEmail}>{wardenEmail}</option>
                    )}
                    <option value="__register_warden__">+ Add / Register New Warden First...</option>
                  </select>
                  <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-secondary text-base">
                    expand_more
                  </span>
                </div>

                {wardens.length === 0 ? (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200/60 rounded-lg p-2 mt-1.5 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">info</span>
                    <span>No wardens registered yet. Click &quot;+ Register New Warden&quot; above to create a warden first.</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-secondary mt-1">
                    {wardens.length} registered warden{wardens.length > 1 ? 's' : ''} available. Select who will oversee roll-call and receive night reports.
                  </p>
                )}
              </div>

              {/* Reminder Times Chip Editor */}
              <div className="bg-surface-container-low border border-outline-variant/20 rounded-xl p-3 space-y-2">
                <label className="block font-semibold text-on-surface">
                  Attendance Reminder Schedule (Default: 10:00 PM to 11:30 PM)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {reminders.map((time) => (
                    <span
                      key={time}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface text-on-surface text-xs font-mono font-semibold border border-outline-variant/30"
                    >
                      <span>{time}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveReminderTime(time)}
                        className="text-secondary hover:text-rose-500 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newReminderTime}
                    onChange={(e) => setNewReminderTime(e.target.value)}
                    placeholder="Add time (e.g. 22:45)"
                    className="flex-1 bg-surface border border-outline-variant/30 rounded-lg px-3 py-1.5 text-xs font-mono outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={handleAddReminderTime}
                    className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block font-semibold text-on-surface mb-1">Hostel Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2 text-sm text-on-surface outline-none focus:border-primary"
                >
                  <option value="active">Active (Accepting roll-call & check-ins)</option>
                  <option value="inactive">Inactive (Temporarily suspended)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-outline-variant/30 text-secondary hover:text-on-surface cursor-pointer text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-on-primary cursor-pointer text-xs font-semibold shadow-xs"
                >
                  {editingHostel ? 'Save Hostel Changes' : 'Register Hostel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
