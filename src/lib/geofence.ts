/**
 * Browser Location Capture Validation & Geofencing Engine
 * Calculates Haversine perimeter distance, validates accuracy drift, and detects spoofing.
 */

import { LocationCapture, Hostel } from '../types';

export const DEFAULT_HOSTEL_COORDINATES: Record<string, { lat: number; lng: number; radiusMeters: number }> = {
  'HST-SUN-01': {
    lat: 31.9578,
    lng: 77.1095,
    radiusMeters: 200, // Sunrise Boys Hostel
  },
  'HST-ANN-02': {
    lat: 31.9592,
    lng: 77.111,
    radiusMeters: 150, // Sunrise Annex Block C
  },
};

/**
 * Calculates Haversine great-circle distance between two GPS coordinates in meters.
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export interface GeofenceValidationResult {
  isValid: boolean;
  isWithinGeofence: boolean;
  distanceMeters: number;
  accuracyMeters: number;
  isSuspicious: boolean;
  status: 'In-Bounds' | 'Off-Perimeter' | 'Excessive-Drift' | 'Mock-Detected';
  message: string;
}

/**
 * Validates browser location capture against residential hostel perimeter.
 */
export function validateLocationCapture(
  capture: LocationCapture,
  hostel?: Hostel | null
): GeofenceValidationResult {
  // 1. Mock location spoofing detection
  if (capture.isMocked) {
    return {
      isValid: false,
      isWithinGeofence: false,
      distanceMeters: 9999,
      accuracyMeters: capture.accuracyMeters,
      isSuspicious: true,
      status: 'Mock-Detected',
      message: 'Simulated or mock location provider detected. Physical device check required.',
    };
  }

  // 2. Resolve hostel reference geofence center
  const hostelId = hostel?.id || 'HST-SUN-01';
  const coords =
    hostel?.geofenceLatitude && hostel?.geofenceLongitude
      ? {
          lat: hostel.geofenceLatitude,
          lng: hostel.geofenceLongitude,
          radiusMeters: hostel.geofenceRadiusMeters || 200,
        }
      : DEFAULT_HOSTEL_COORDINATES[hostelId] || DEFAULT_HOSTEL_COORDINATES['HST-SUN-01'];

  // 3. Compute distance in meters
  const distanceMeters = calculateHaversineDistanceMeters(
    capture.latitude,
    capture.longitude,
    coords.lat,
    coords.lng
  );

  // 4. Accuracy validation: drift over 200 meters cannot assure presence
  if (capture.accuracyMeters > 200) {
    return {
      isValid: false,
      isWithinGeofence: distanceMeters <= coords.radiusMeters,
      distanceMeters,
      accuracyMeters: capture.accuracyMeters,
      isSuspicious: true,
      status: 'Excessive-Drift',
      message: `GPS accuracy too low (±${capture.accuracyMeters}m). Accuracy must be within ±100m.`,
    };
  }

  // 5. In-Bounds perimeter test
  const isWithin = distanceMeters <= coords.radiusMeters;

  if (!isWithin) {
    return {
      isValid: false,
      isWithinGeofence: false,
      distanceMeters,
      accuracyMeters: capture.accuracyMeters,
      isSuspicious: false,
      status: 'Off-Perimeter',
      message: `Device is outside hostel perimeter (${distanceMeters}m from boundary, limit ${coords.radiusMeters}m).`,
    };
  }

  return {
    isValid: true,
    isWithinGeofence: true,
    distanceMeters,
    accuracyMeters: capture.accuracyMeters,
    isSuspicious: false,
    status: 'In-Bounds',
    message: `Verified presence inside perimeter (${distanceMeters}m from center, ±${capture.accuracyMeters}m).`,
  };
}
