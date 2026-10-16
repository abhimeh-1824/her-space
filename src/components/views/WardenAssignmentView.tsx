import React, { useState, useEffect } from 'react';
import { collection, doc, query, where, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { AppScreen, Hostel } from '../../types';
import {
  subscribeToHostels,
  saveWardenToDb,
  subscribeToWardens,
  deleteWardenFromDb,
  refetchHostelsFromDb,
  refetchWardensFromDb,
} from '../../lib/db-seed';
import { useAuth } from '../../context/AuthContext';

export interface WardenAssignmentViewProps {
  onNavigate: (screen: AppScreen) => void;
  onLogout: () => void;
}

interface WardenRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  assignedHostels: string[];
  status: 'active' | 'inactive';
  inviteToken?: string;
  inviteStatus?: 'pending' | 'used';
  passwordSet?: boolean;
}

export const WardenAssignmentView: React.FC<WardenAssignmentViewProps> = ({
  onNavigate,
  onLogout,
}) => {
  const { user } = useAuth();
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [wardens, setWardens] = useState<WardenRecord[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWarden, setEditingWarden] = useState<WardenRecord | null>(null);
  const [shareLinkModal, setShareLinkModal] = useState<{
    name: string;
    email: string;
    role: string;
    url: string;
  } | null>(null);

  // New Warden Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedHostels, setSelectedHostels] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubHostels = subscribeToHostels((liveHostels) => {
      setHostels(liveHostels);
    });

    // Listen to registered wardens from unified subscription
    const unsubWardens = subscribeToWardens((liveWardens) => {
      const seen = new Set<string>();
      const list: WardenRecord[] = [];
      for (const d of liveWardens) {
        const key = (d.email || d.id || '').trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        list.push({
          id: d.id,
          name: d.name || 'Warden',
          email: d.email || '',
          phone: d.phone || '',
          assignedHostels: d.hostelMemberships || (d.hostelId ? [d.hostelId] : []),
          status: d.status || 'active',
          inviteToken: d.inviteToken,
          inviteStatus: d.inviteStatus || (d.password ? 'used' : 'pending'),
          passwordSet: !!d.password,
        });
      }
      setWardens(list);
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

  const toggleHostelSelection = (hostelId: string) => {
    setSelectedHostels((prev) =>
      prev.includes(hostelId) ? prev.filter((id) => id !== hostelId) : [...prev, hostelId]
    );
  };

  const handleSaveWarden = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      showToast('Please enter name and email.');
      return;
    }
    const wardenId = editingWarden ? editingWarden.id : `w_${Date.now()}`;
    const wardenDocData = {
      id: wardenId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || '',
      hostelId: selectedHostels[0] || '',
      hostelMemberships: selectedHostels,
      status: editingWarden?.status || ('active' as const),
    };

    let inviteToken = '';
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          role: 'warden',
          email: email.trim().toLowerCase(),
          name: name.trim(),
          hostelId: selectedHostels[0] || '',
        }),
      });
      if (res.ok) {
        const invData = await res.json();
        inviteToken = invData.token;
      }
    } catch (e) {
      console.warn('Invite generation note:', e);
    }

    try {
      await saveWardenToDb({
        ...wardenDocData,
        inviteToken,
        inviteStatus: 'pending',
        passwordSet: false,
      });
      showToast(`Warden "${name}" saved to database successfully.`);
    } catch (err: any) {
      console.warn('[WardenAssignmentView] Save warden Firestore note:', err);
      showToast(`Warden saved.`);
    }

    if (editingWarden) {
      setWardens((prev) =>
        prev.map((w) =>
          w.id === editingWarden.id
            ? {
                ...w,
                name: name.trim(),
                email: email.trim().toLowerCase(),
                phone: phone.trim() || undefined,
                assignedHostels: selectedHostels,
                inviteToken: inviteToken || w.inviteToken,
              }
            : w
        )
      );
    } else {
      const cleanEmail = email.trim().toLowerCase();
      const newWarden: WardenRecord = {
        id: wardenId,
        name: name.trim(),
        email: cleanEmail,
        phone: phone.trim() || undefined,
        assignedHostels: selectedHostels,
        status: 'active',
        inviteToken,
        inviteStatus: 'pending',
        passwordSet: false,
      };
      setWardens((prev) => {
        const filtered = prev.filter((w) => w.id !== wardenId && w.email.toLowerCase() !== cleanEmail);
        return [newWarden, ...filtered];
      });

      if (inviteToken) {
        const url = `${window.location.origin}/setup/${inviteToken}`;
        if (navigator?.clipboard?.writeText) {
          navigator.clipboard.writeText(url).catch(() => {});
        }
        setShareLinkModal({
          name: name.trim(),
          email: cleanEmail,
          role: 'Warden',
          url,
        });
      }
    }

    setShowAddModal(false);
    setEditingWarden(null);
    setName('');
    setEmail('');
    setPhone('');
    setSelectedHostels([]);
  };

  const handleShareWardenLink = async (w: WardenRecord) => {
    let token = w.inviteToken;
    if (!token) {
      try {
        const res = await fetch('/api/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate',
            role: 'warden',
            email: w.email,
            name: w.name,
            hostelId: w.assignedHostels[0] || '',
          }),
        });
        if (res.ok) {
          const invData = await res.json();
          token = invData.token;
          w.inviteToken = token;
        }
      } catch (e) {
        console.warn('Invite token generation note:', e);
      }
    }
    const targetToken = token || w.id;
    const url = `${window.location.origin}/setup/${targetToken}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    showToast(`Setup link copied! Share with ${w.name} to set password.`);
    setShareLinkModal({
      name: w.name,
      email: w.email,
      role: 'Warden',
      url,
    });
  };

  const handleDeleteWarden = async (id: string, wardenName: string) => {
    if (!window.confirm(`Are you sure you want to remove warden "${wardenName}"?`)) return;
    try {
      await deleteWardenFromDb(id);
      setWardens((prev) => prev.filter((w) => w.id !== id));
      showToast(`Warden "${wardenName}" removed from database.`);
    } catch (err) {
      setWardens((prev) => prev.filter((w) => w.id !== id));
      showToast(`Warden removed.`);
    }
  };

  const handleOpenEdit = (w: WardenRecord) => {
    setEditingWarden(w);
    setName(w.name);
    setEmail(w.email);
    setPhone(w.phone || '');
    setSelectedHostels(w.assignedHostels);
    setShowAddModal(true);
  };

  const handleToggleStatus = (id: string) => {
    setWardens((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, status: w.status === 'active' ? 'inactive' : 'active' } : w
      )
    );
    showToast('Warden access status updated.');
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
              Warden management and assignment requires institutional administrator privileges. Wardens can only monitor attendance for their assigned hostels.
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
              <span className="material-symbols-outlined text-[22px]">badge</span>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-on-surface leading-tight">Warden Assignments</h1>
              <p className="text-xs text-secondary mt-0.5">Manage hostel wardens and multi-hostel jurisdictions</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setEditingWarden(null);
                setName('');
                setEmail('');
                setPhone('');
                setSelectedHostels([]);
                setShowAddModal(true);
              }}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-on-primary text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              <span>Assign New Warden</span>
            </button>
          </div>
        </div>

        {/* Info card */}
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-violet-700 text-xl mt-0.5">verified_user</span>
          <div className="text-xs text-violet-900 space-y-0.5">
            <p className="font-bold">Multi-Hostel Assignment Principle</p>
            <p className="text-violet-800">
              One warden can be assigned to multiple hostels. When a warden logs in, they only see their assigned hostels and can switch between them. Wardens cannot change their own roles or assign themselves to other hostels.
            </p>
          </div>
        </div>

        {/* Wardens List Container */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-xs overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between">
            <div>
              <h2 className="font-title-md font-bold text-on-surface">Registered Wardens ({wardens.length})</h2>
              <p className="font-label-xs text-secondary">Authorized administrators with roll-call and monitoring access</p>
            </div>
          </div>

          {/* Mobile Card View (< md) */}
          <div className="md:hidden divide-y divide-outline-variant/20">
            {wardens.length === 0 ? (
              <div className="py-10 text-center text-xs text-secondary px-4">
                No wardens assigned yet.
              </div>
            ) : (
              wardens.map((w) => (
                <div key={w.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        {w.name.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-on-surface">{w.name}</p>
                        <p className="text-[11px] text-secondary font-mono">{w.email}</p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        w.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {w.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-secondary tracking-wider block mb-1">
                      Assigned Hostels
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {w.assignedHostels.map((hid) => {
                        const h = hostels.find((item) => item.id === hid);
                        return (
                          <span
                            key={hid}
                            className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface text-[11px] font-medium border border-outline-variant/30"
                          >
                            {h?.name || hid}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-end gap-2 border-t border-outline-variant/10">
                    <button
                      onClick={() => handleShareWardenLink(w)}
                      className="px-2.5 py-1.5 rounded-lg border border-violet-300 bg-violet-50 text-violet-700 text-xs font-semibold hover:bg-violet-100 transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">link</span>
                      <span>Share Link</span>
                    </button>
                    <button
                      onClick={() => handleOpenEdit(w)}
                      className="px-3 py-1.5 rounded-lg border border-outline-variant/30 hover:bg-surface-container text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleStatus(w.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-secondary hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                    >
                      {w.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500">Warden</th>
                  <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500">Contact Email</th>
                  <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500">Assigned Hostels</th>
                  <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500">Status</th>
                  <th className="py-2.5 px-4 text-right text-[11px] font-semibold text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {wardens.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-secondary">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-4xl text-slate-400">badge</span>
                        <p className="font-semibold text-sm text-on-surface">No wardens assigned yet</p>
                        <p className="text-xs text-secondary">Register and assign your first warden using the button above.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  wardens.map((w) => (
                    <tr key={w.id} className="hover:bg-surface-container-low/40 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                          {w.name.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <div>
                          <p className="font-bold text-on-surface">{w.name}</p>
                          <p className="text-xs text-secondary">{w.phone || 'No phone recorded'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-secondary font-mono">{w.email}</td>
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1.5">
                        {w.assignedHostels.map((hid) => {
                          const h = hostels.find((item) => item.id === hid);
                          return (
                            <span
                              key={hid}
                              className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface font-label-xs font-semibold border border-outline-variant/30"
                            >
                              {h?.name || hid}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-2.5 py-1 rounded-full text-label-xs font-semibold ${
                          w.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {w.status === 'active' ? (w.passwordSet ? 'Active Duty' : 'Pending Password') : 'Deactivated'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      <button
                        onClick={() => handleShareWardenLink(w)}
                        className="px-2.5 py-1.5 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 shadow-xs"
                        title="Copy shareable link for warden to set password"
                      >
                        <span className="material-symbols-outlined text-xs">link</span>
                        <span>Share Link</span>
                      </button>
                      <button
                        onClick={() => handleOpenEdit(w)}
                        className="px-3 py-1.5 rounded-lg border border-outline-variant/30 hover:bg-surface-container text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus(w.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-secondary hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                      >
                        {w.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDeleteWarden(w.id, w.name)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add / Edit Warden Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="max-w-md w-full bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <h3 className="font-title-md font-bold text-on-surface">
                {editingWarden ? 'Edit Warden Assignments' : 'Register New Warden'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingWarden(null);
                }}
                className="text-secondary hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveWarden} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-on-surface mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sunita Rao"
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2 text-sm text-on-surface outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-on-surface mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="warden@herspace.app"
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2 text-sm text-on-surface outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-on-surface mb-1">Mobile Number (Optional)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="6267549800"
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2 text-sm text-on-surface outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-on-surface mb-1.5">
                  Assigned Hostels (Optional)
                </label>
                <div className="space-y-2 border border-outline-variant/20 rounded-xl p-3 bg-surface-container-low max-h-40 overflow-y-auto">
                  {hostels.length === 0 ? (
                    <p className="text-secondary text-xs italic">
                      No hostels registered yet. You can create this warden now, and select them from the dropdown when registering a hostel!
                    </p>
                  ) : (
                    hostels.map((h) => {
                      const isChecked = selectedHostels.includes(h.id);
                      return (
                        <label
                          key={h.id}
                          className="flex items-center gap-2.5 cursor-pointer hover:text-primary transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleHostelSelection(h.id)}
                            className="rounded text-primary focus:ring-primary h-4 w-4"
                          />
                          <span className="font-medium text-on-surface text-xs">{h.name}</span>
                          <span className="text-secondary text-[11px] ml-auto">({h.id})</span>
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-[11px] text-secondary mt-1">
                  You can also assign or change wardens directly inside the Hostel settings dropdown.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingWarden(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-outline-variant/30 text-secondary hover:text-on-surface cursor-pointer text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-on-primary cursor-pointer text-xs font-semibold shadow-xs"
                >
                  {editingWarden ? 'Save Assignments' : 'Create & Assign Warden'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shareable Set-Password Link Modal */}
      {shareLinkModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-md w-full p-6 border border-outline-variant/30 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-bold">
                <span className="material-symbols-outlined">link</span>
                <h3 className="font-title-md">Warden Invitation &amp; Password Link</h3>
              </div>
              <button
                onClick={() => setShareLinkModal(null)}
                className="text-secondary hover:text-on-surface p-1 rounded-lg cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <p className="text-xs text-secondary leading-relaxed">
              Share this single-use activation link with <strong>{shareLinkModal.name}</strong> ({shareLinkModal.email}). They will open this link to set their password. Once they set it, the link will expire automatically.
            </p>
            <div className="flex items-center gap-2 bg-surface-container-low p-2.5 rounded-xl border border-outline-variant/30">
              <input
                type="text"
                readOnly
                value={shareLinkModal.url}
                className="bg-transparent text-xs text-on-surface font-mono w-full outline-none select-all"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareLinkModal.url);
                  showToast('Setup link copied to clipboard!');
                }}
                className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-on-primary text-xs font-semibold shrink-0 cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <span className="material-symbols-outlined text-xs">content_copy</span>
                <span>Copy</span>
              </button>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShareLinkModal(null)}
                className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
