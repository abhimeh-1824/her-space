import React from 'react';
import { AppScreen } from '../../types';
import { WardenDashboardView } from './WardenDashboardView';

export interface AdminDashboardViewProps {
  onNavigate: (screen: AppScreen) => void;
  onLogout: () => void;
}

/**
 * Screen 2: Admin Dashboard
 * Provides complete hostel management, warden assignment shortcuts,
 * campus-wide attendance monitoring, and multi-hostel switching.
 */
export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  onNavigate,
  onLogout,
}) => {
  return <WardenDashboardView onNavigate={onNavigate} onLogout={onLogout} />;
};
