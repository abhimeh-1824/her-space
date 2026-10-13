import React, { useState } from 'react';
import { AppScreen, UserRole } from '../types';

interface ScreenSwitcherProps {
  currentScreen: AppScreen;
  onSelectScreen: (screen: AppScreen) => void;
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  deviceMode: 'responsive' | 'mobile-frame';
  onToggleDeviceMode: () => void;
}

const SCREENS: { id: AppScreen; number: number; name: string; icon: string; category: string }[] = [
  { id: 'login', number: 1, name: 'Login & Register', icon: 'login', category: 'Authentication' },
  { id: 'student-dashboard', number: 2, name: 'Student Dashboard', icon: 'dashboard', category: 'Student' },
  { id: 'location-setup', number: 3, name: 'Location & Setup', icon: 'location_on', category: 'Student' },
  { id: 'attendance-history', number: 4, name: 'Attendance History', icon: 'history', category: 'Student' },
  { id: 'warden-dashboard', number: 5, name: 'Warden Dashboard', icon: 'admin_panel_settings', category: 'Warden' },
  { id: 'student-management', number: 6, name: 'Student Registry', icon: 'group', category: 'Warden' },
  { id: 'attendance-monitoring', number: 7, name: 'Attendance Live Monitor', icon: 'radar', category: 'Warden' },
  { id: 'hostel-settings', number: 8, name: 'Hostel Settings & Reports', icon: 'settings', category: 'Admin' },
  { id: 'terms-privacy', number: 9, name: 'Terms & Privacy', icon: 'policy', category: 'Compliance' },
];

export const ScreenSwitcher: React.FC<ScreenSwitcherProps> = ({
  currentScreen,
  onSelectScreen,
  currentRole,
  onSelectRole,
  deviceMode,
  onToggleDeviceMode,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const activeMeta = SCREENS.find((s) => s.id === currentScreen) || SCREENS[0];

  return (
    <div className="sticky top-0 z-50 bg-neutral-900 text-white border-b border-neutral-800 text-xs shadow-md">
      {/* Primary compact bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-3">
        {/* Brand / Screen badge */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-blue-600/30 text-blue-400 border border-blue-500/40 px-2 py-0.5 rounded-md font-mono text-[11px] font-bold">
            <span className="material-symbols-outlined text-xs">shield</span>
            HOSTELGUARD
          </div>

          <div className="h-3.5 w-px bg-neutral-700 hidden sm:block"></div>

          {/* Active screen indicator with dropdown toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-2.5 py-1 rounded-md transition-colors"
          >
            <span className="text-amber-400 font-bold">Screen {activeMeta.number}:</span>
            <span className="font-semibold text-white">{activeMeta.name}</span>
            <span className="material-symbols-outlined text-sm text-neutral-400">
              {isOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        </div>

        {/* Quick jump screen numbers (1 - 9) */}
        <div className="hidden lg:flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
          {SCREENS.map((s) => {
            const isActive = currentScreen === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onSelectScreen(s.id)}
                className={`w-7 h-7 rounded-md font-mono text-xs font-bold transition-all flex items-center justify-center ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs scale-105'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
                title={`Screen ${s.number}: ${s.name}`}
              >
                {s.number}
              </button>
            );
          })}
        </div>

        {/* Right side controls: Role toggle & Device Mode */}
        <div className="flex items-center gap-2">
          {/* Quick role switcher */}
          <div className="hidden sm:flex items-center bg-neutral-800 rounded-md p-0.5 text-[11px]">
            <button
              onClick={() => onSelectRole('student')}
              className={`px-2 py-0.5 rounded transition-colors ${
                currentRole === 'student' ? 'bg-blue-600 text-white font-semibold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Student
            </button>
            <button
              onClick={() => onSelectRole('warden')}
              className={`px-2 py-0.5 rounded transition-colors ${
                currentRole === 'warden' ? 'bg-indigo-600 text-white font-semibold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Warden
            </button>
          </div>

          {/* Device viewport preview toggle */}
          <button
            onClick={onToggleDeviceMode}
            className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${
              deviceMode === 'mobile-frame'
                ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/40'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
            }`}
            title={deviceMode === 'mobile-frame' ? 'Switch to Full Responsive' : 'Switch to Mobile Frame'}
          >
            <span className="material-symbols-outlined text-sm">
              {deviceMode === 'mobile-frame' ? 'stay_current_portrait' : 'devices'}
            </span>
            <span className="hidden md:inline">
              {deviceMode === 'mobile-frame' ? 'Mobile Frame' : 'Full Width'}
            </span>
          </button>
        </div>
      </div>

      {/* Expanded Screen Navigation Drawer */}
      {isOpen && (
        <div className="bg-neutral-950 border-t border-neutral-800 px-4 sm:px-6 py-4 animate-in slide-in-from-top-2 duration-150">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-3 text-xs text-neutral-400">
              <span className="uppercase tracking-wider font-bold">Select Screen to Inspect (All 9 Screens Built)</span>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:text-white flex items-center gap-1 text-[11px]"
              >
                <span className="material-symbols-outlined text-sm">close</span>
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {SCREENS.map((s) => {
                const isActive = currentScreen === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      onSelectScreen(s.id);
                      setIsOpen(false);
                    }}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                      isActive
                        ? 'bg-blue-950/60 border-blue-500 text-white shadow-sm'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-850'
                    }`}
                  >
                    <div
                      className={`h-7 w-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                        isActive ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      {s.number}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                        {s.category}
                      </div>
                      <div className="font-semibold text-xs truncate text-white">{s.name}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
