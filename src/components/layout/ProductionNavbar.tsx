import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AppScreen, Hostel } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { subscribeToHostels } from '../../lib/db-seed';

export interface ProductionNavbarProps {
  currentScreen?: AppScreen;
  onNavigate?: (screen: AppScreen) => void;
  onLogout?: () => void;
}

const screenToPath: Record<string, string> = {
  'warden-dashboard': '/warden/dashboard',
  'warden-assignment': '/warden/wardens',
  'hostel-registration': '/warden/hostels',
  'student-management': '/warden/students',
  'attendance-monitoring': '/warden/monitoring',
  'hostel-settings': '/warden/settings',
  'student-dashboard': '/student/dashboard',
  'attendance-history': '/student/history',
  'location-setup': '/student/location-setup',
  'terms-privacy': '/rules',
  'login': '/login',
};

export const ProductionNavbar: React.FC<ProductionNavbarProps> = ({
  currentScreen,
  onNavigate,
  onLogout,
}) => {
  const router = useRouter();
  const pathname = usePathname() || '';
  const { user, activeHostelId, switchHostel, logout, availableHostels, authorizedHostels } = useAuth();
  const hostels = availableHostels;
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const isAdmin = user?.role === 'super_admin';
  const isWarden = user?.role === 'warden';
  const isStudent = user?.role === 'student';

  const activeHostel = authorizedHostels.find((h) => h.id === activeHostelId) || authorizedHostels[0];

  const handleNav = (screen: AppScreen) => {
    if (onNavigate) {
      onNavigate(screen);
    }
    const targetPath = screenToPath[screen];
    if (targetPath) {
      router.push(targetPath);
    }
    setMobileDrawerOpen(false);
  };

  // Nav item list based on role
  const navItems = [
    ...(isAdmin || isWarden
      ? [
          {
            id: 'warden-dashboard' as AppScreen,
            label: 'Dashboard',
            icon: 'dashboard',
            badge: null,
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            id: 'warden-assignment' as AppScreen,
            label: 'Wardens',
            icon: 'badge',
            badge: null,
          },
          {
            id: 'hostel-registration' as AppScreen,
            label: 'Hostels',
            icon: 'domain',
            badge: `${hostels.length}`,
          },
        ]
      : []),
    ...(isAdmin || isWarden
      ? [
          {
            id: 'student-management' as AppScreen,
            label: 'Resident Roster',
            icon: 'group',
            badge: null,
          },
          {
            id: 'attendance-monitoring' as AppScreen,
            label: 'Night Sweep',
            icon: 'notifications_active',
            badge: 'Live',
          },
          {
            id: 'hostel-settings' as AppScreen,
            label: 'Reports & Timings',
            icon: 'assessment',
            badge: null,
          },
        ]
      : []),
    ...(isStudent
      ? [
          {
            id: 'student-dashboard' as AppScreen,
            label: 'Night Attendance',
            icon: 'how_to_reg',
            badge: 'Required',
          },
          {
            id: 'attendance-history' as AppScreen,
            label: 'Attendance History',
            icon: 'history',
            badge: null,
          },
          {
            id: 'location-setup' as AppScreen,
            label: 'Device & Location',
            icon: 'near_me',
            badge: null,
          },
        ]
      : []),
    {
      id: 'terms-privacy' as AppScreen,
      label: 'Hostel Rules & Privacy',
      icon: 'policy',
      badge: null,
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between">
      {/* Brand & Active Hostel */}
      <div className="space-y-4">
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div
            onClick={() => handleNav(isStudent ? 'student-dashboard' : 'warden-dashboard')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-violet-500/25 group-hover:scale-105 transition-transform shrink-0">
              <span className="material-symbols-outlined text-xl">shield</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-white leading-none">
                  HER-SPACE
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30 uppercase tracking-wide">
                  {isAdmin ? 'ADMIN' : isWarden ? 'WARDEN' : 'RESIDENT'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Hostel Attendance System</p>
            </div>
          </div>

          {/* Close button on mobile drawer */}
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(false)}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>


        {/* Navigation Items Menu */}
        <nav className="space-y-1 pt-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
            Navigation
          </div>
          {navItems.map((item) => {
            const itemPath = screenToPath[item.id];
            const isActive = currentScreen
              ? currentScreen === item.id
              : itemPath
              ? pathname.startsWith(itemPath)
              : false;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`material-symbols-outlined text-lg ${
                      isActive ? 'text-white' : 'text-slate-400'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : item.badge === 'Live'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Profile & Sign Out (Bottom of Sidebar) */}
      <div className="pt-4 border-t border-slate-800 space-y-3">
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 flex items-center justify-center font-bold text-xs shrink-0">
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'HS'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate">{user?.name || 'Authorized User'}</p>
            <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            setMobileDrawerOpen(false);
            if (onLogout) {
              onLogout();
            } else {
              await logout();
              router.push('/login');
            }
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-semibold transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">logout</span>
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. DESKTOP PERMANENT SIDEBAR (Visible on md and up: >= 768px) */}
      <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-64 bg-slate-900 border-r border-slate-800 p-4 z-40 flex-col justify-between overflow-y-auto">
        {sidebarContent}
      </aside>

      {/* 2. MOBILE TOP APP BAR (Phones: < md screens) */}
      <header className="md:hidden sticky top-0 z-30 bg-slate-900/95 border-b border-slate-800 backdrop-blur-md px-3 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-200 hover:text-white cursor-pointer"
            aria-label="Open Navigation Menu"
          >
            <span className="material-symbols-outlined text-xl">menu</span>
          </button>

          <div
            onClick={() => handleNav(isStudent ? 'student-dashboard' : 'warden-dashboard')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-base">shield</span>
            </div>
            <span className="font-extrabold text-sm text-white">HER-SPACE</span>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30 uppercase">
              {isAdmin ? 'ADMIN' : isWarden ? 'WARDEN' : 'RESIDENT'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="w-9 h-9 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-300 hover:text-red-400 cursor-pointer"
          title="Sign Out"
        >
          <span className="material-symbols-outlined text-lg">logout</span>
        </button>
      </header>

      {/* 3. MOBILE SLIDE-OUT SIDEBAR DRAWER (< md screens) */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 p-4 shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
