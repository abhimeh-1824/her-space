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
import { INITIAL_HOSTELS } from '../data/mockData';
import { ensureDatabaseSeeded, subscribeToHostels } from '../lib/db-seed';

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  activeHostelId: string;
  activeHostel: Hostel;
  availableHostels: Hostel[];
  isAuthenticated: boolean;
  isLoading: boolean;
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
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      if (stored) {
        return JSON.parse(stored) as UserProfile;
      }
    } catch {}
    return null;
  });

  const [activeHostelId, setActiveHostelId] = useState<string>(() => user?.hostelId || 'HST-SUN-01');
  const [availableHostels, setAvailableHostels] = useState<Hostel[]>(INITIAL_HOSTELS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize DB and subscribe to live hostels
  useEffect(() => {
    ensureDatabaseSeeded().catch((err) => {
      console.warn('[AuthProvider] Seeding init:', err);
    });

    const unsubscribeHostels = subscribeToHostels((liveHostels) => {
      if (liveHostels.length > 0) {
        setAvailableHostels(liveHostels);
      }
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
    });

    return () => unsubscribe();
  }, []);

  const activeHostel =
    availableHostels.find((h) => h.id === activeHostelId) || availableHostels[0] || INITIAL_HOSTELS[0];

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
    isAuthenticated: !!user,
    isLoading,
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
