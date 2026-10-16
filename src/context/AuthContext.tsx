/**
 * React Authentication & Multi-Hostel Context Provider
 * Manages live Firebase Auth & Firestore sessions, active hostel context, and legal consent versioning.
 * Backed by real live database records with admin@test.com / admin credentials.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, UserRole, Hostel, LegalConsentRecord } from '../types';
import {
  loginUser,
  registerUser,
  logoutUser,
  resetPassword as sendResetEmail,
  recordLegalConsent,
  switchActiveHostel,
  RegisterParams,
  LoginParams,
} from '../lib/auth-service';
import { ensureDatabaseSeeded, subscribeToHostels } from '../lib/db-seed';
import { validateUserProfile } from '@/lib/auth-guard';

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  activeHostelId: string;
  activeHostel: Hostel | null;
  availableHostels: Hostel[];
  authorizedHostels: Hostel[];
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  login: (params: LoginParams) => Promise<UserProfile>;
  register: (params: RegisterParams) => Promise<UserProfile>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  recordConsent: (
    terms: boolean,
    biometrics: boolean,
    geofence: boolean,
    name: string,
    rollNo: string
  ) => Promise<LegalConsentRecord>;
  switchHostel: (hostelId: string) => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_USER_KEY = 'hostelguard_active_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeHostelId, setActiveHostelId] = useState<string>('');
  const [availableHostels, setAvailableHostels] = useState<Hostel[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // Hydrate user session from localStorage on client mount (prevents SSR hydration mismatch and anti-tamper)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      if (stored) {
        const raw = JSON.parse(stored);
        const profile = validateUserProfile(raw);
        if (profile) {
          setUser(profile);
          // If the profile role was tampered and downgraded, re-sync to localStorage
          if (profile.role !== raw.role) {
            localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(profile));
          }
          if (profile.hostelId) {
            setActiveHostelId(profile.hostelId);
          }
        } else {
          localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
        }
      }
    } catch {}
    setIsInitialized(true);
  }, []);

  // Initialize DB and subscribe to live hostels
  useEffect(() => {
    ensureDatabaseSeeded().catch((err) => {
      console.warn('[AuthProvider] Seeding init:', err);
    });

    const unsubscribeHostels = subscribeToHostels((liveHostels) => {
      setAvailableHostels(liveHostels);
    });

    return () => {
      unsubscribeHostels();
    };
  }, []);

  // Listen for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            setUser(profile);
            localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(profile));
            if (profile.hostelId) {
              setActiveHostelId(profile.hostelId);
            }
          }
        } catch (err) {
          console.error('[AuthContext] Error loading user profile:', err);
        }
      }
      setIsInitialized(true);
    });

    return () => unsubscribe();
  }, []);

  // Strict authorized hostels calculation based on role:
  // - super_admin: sees all registered hostels
  // - warden: ONLY sees hostels explicitly assigned to them (user.hostelMemberships or user.hostelId)
  // - student: ONLY sees their assigned primary hostel (user.hostelId)
  const authorizedHostels = React.useMemo(() => {
    if (!user) return [];
    if (user.role === 'super_admin') return availableHostels;
    if (user.role === 'warden') {
      const assignedIds = new Set<string>();
      if (Array.isArray(user.hostelMemberships)) {
        user.hostelMemberships.forEach((id) => {
          if (id && typeof id === 'string' && id.trim()) {
            assignedIds.add(id.trim());
          }
        });
      } else if (user.hostelId && user.hostelId.trim()) {
        assignedIds.add(user.hostelId.trim());
      }
      return availableHostels.filter((h) => assignedIds.has(h.id));
    }
    if (user.role === 'student') {
      if (!user.hostelId) return [];
      return availableHostels.filter((h) => h.id === user.hostelId);
    }
    return [];
  }, [user, availableHostels]);

  // Synchronize activeHostelId with authorizedHostels
  useEffect(() => {
    if (!user) return;
    if (authorizedHostels.length === 0) {
      if (activeHostelId !== '') setActiveHostelId('');
    } else if (!authorizedHostels.some((h) => h.id === activeHostelId)) {
      setActiveHostelId(authorizedHostels[0].id);
    }
  }, [user, authorizedHostels, activeHostelId]);

  const activeHostel =
    authorizedHostels.find((h) => h.id === activeHostelId) ||
    (authorizedHostels.length > 0 ? authorizedHostels[0] : null);

  const clearError = () => setError(null);

  const login = async (params: LoginParams): Promise<UserProfile> => {
    setIsLoading(true);
    setError(null);
    try {
      const profile = await loginUser(params);
      setUser(profile);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(profile));
      if (profile.hostelId) {
        setActiveHostelId(profile.hostelId);
      }
      return profile;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid institutional credentials.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (params: RegisterParams): Promise<UserProfile> => {
    setIsLoading(true);
    setError(null);
    try {
      const profile = await registerUser(params);
      setUser(profile);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(profile));
      setActiveHostelId(profile.hostelId);
      return profile;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await logoutUser();
      setUser(null);
      localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    } catch (err) {
      console.warn('[AuthContext] Logout exception:', err);
      setUser(null);
      localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await sendResetEmail(email);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password reset failed.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const recordConsent = async (
    terms: boolean,
    biometrics: boolean,
    geofence: boolean,
    name: string,
    rollNo: string
  ): Promise<LegalConsentRecord> => {
    if (!user) throw new Error('User must be logged in to record consent.');

    const record = await recordLegalConsent({
      userId: user.uid,
      userEmail: user.email,
      hostelId: activeHostelId,
      version: 'v2.4',
      termsAccepted: terms,
      biometricAccepted: biometrics,
      geofenceAccepted: geofence,
      signatureName: name,
      rollNo,
    });

    const updatedProfile: UserProfile = {
      ...user,
      policyConsentVersion: 'v2.4',
      consentAcceptedAt: record.timestamp,
    };
    setUser(updatedProfile);
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(updatedProfile));

    return record;
  };

  const switchHostel = (targetHostelId: string) => {
    if (!user) return;
    try {
      const updated = switchActiveHostel(user, targetHostelId);
      setUser(updated);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(updated));
      setActiveHostelId(targetHostelId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to switch hostel jurisdiction.';
      setError(msg);
    }
  };

  const value: AuthContextType = {
    user,
    role: user?.role || 'student',
    activeHostelId,
    activeHostel,
    availableHostels,
    authorizedHostels,
    isAuthenticated: !!user,
    isLoading,
    isInitialized,
    error,
    login,
    register,
    logout,
    resetPassword,
    recordConsent,
    switchHostel,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
