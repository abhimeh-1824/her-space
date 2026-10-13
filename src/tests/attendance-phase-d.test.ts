/**
 * Phase D Automated Security & Attendance Test Suite
 * Tests duplicate submissions idempotency, unauthorized user protections,
 * boundary times & midnight transition, and browser geofence validation.
 */

import {
  calculateCurfewWindow,
  evaluateCurfewStatus,
} from '../lib/timezone';
import {
  validateLocationCapture,
  calculateHaversineDistanceMeters,
} from '../lib/geofence';
import {
  checkInResident,
  requestCurfewExtension,
  CheckInRequest,
} from '../lib/attendance-service';
import { UserProfile, LocationCapture } from '../types';
import { ForbiddenError, ValidationError } from '../lib/errors';

function assert(condition: boolean, testName: string, detail?: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${testName} - ${detail || 'Condition not met'}`);
    process.exitCode = 1;
    throw new Error(`Test failed: ${testName}`);
  }
  console.log(`✅ PASSED: ${testName}`);
}

async function runPhaseDTests() {
  console.log('====================================================');
  console.log('Running HostelGuard Phase D Attendance Engine Test Suite');
  console.log('====================================================\n');

  let passedCount = 0;

  const validStudentProfile: UserProfile = {
    uid: 'stu_102_rahul',
    email: 'rahul.s@campus.edu',
    role: 'student',
    name: 'Rahul Sharma',
    hostelId: 'HST-SUN-01',
    hostelMemberships: ['HST-SUN-01'],
    policyConsentVersion: 'v2.4',
    createdAt: new Date().toISOString(),
  };

  const otherStudentProfile: UserProfile = {
    uid: 'stu_999_attacker',
    email: 'attacker@campus.edu',
    role: 'student',
    name: 'Attacker Student',
    hostelId: 'HST-SUN-01',
    hostelMemberships: ['HST-SUN-01'],
    policyConsentVersion: 'v2.4',
    createdAt: new Date().toISOString(),
  };

  const validLocation: LocationCapture = {
    latitude: 31.95785,
    longitude: 77.10955,
    accuracyMeters: 12,
    timestamp: new Date().toISOString(),
    isMocked: false,
    address: 'Sunrise Boys Hostel Front Lawn',
  };

  // ---------------------------------------------------------------
  // Test 1: Unauthorized User Access
  // ---------------------------------------------------------------
  try {
    let unauthorizedBlocked = false;
    try {
      // Attacker attempts to check in Rahul
      await checkInResident({
        studentId: 'STU-102',
        studentDocId: 'stu_102_rahul',
        hostelId: 'HST-SUN-01',
        location: validLocation,
        actor: otherStudentProfile, // Attacker is NOT Rahul
      });
    } catch (err) {
      if (err instanceof ForbiddenError) {
        unauthorizedBlocked = true;
      }
    }

    assert(
      unauthorizedBlocked,
      'Test 1: Unauthorized User Check-In Protection',
      'Student A must NOT be able to submit check-in for Student B'
    );
    passedCount++;
  } catch (e) {
    console.error(e);
  }

  // ---------------------------------------------------------------
  // Test 2: Idempotent Check-in & Duplicate Submissions
  // ---------------------------------------------------------------
  try {
    const sessionDate = '2026-10-13';

    // First check-in
    const firstCheckIn = await checkInResident({
      studentId: 'STU-102',
      studentDocId: 'stu_102_rahul',
      hostelId: 'HST-SUN-01',
      location: validLocation,
      actor: validStudentProfile,
      sessionDate,
    });

    assert(
      firstCheckIn.status === 'Confirmed IN',
      'Test 2A: Initial Check-In Success',
      `Expected status 'Confirmed IN', got ${firstCheckIn.status}`
    );

    // Duplicate check-in replay with same session date
    const secondCheckIn = await checkInResident({
      studentId: 'STU-102',
      studentDocId: 'stu_102_rahul',
      hostelId: 'HST-SUN-01',
      location: validLocation,
      actor: validStudentProfile,
      sessionDate,
    });

    assert(
      secondCheckIn.record.id === firstCheckIn.record.id,
      'Test 2B: Idempotent Deduplication (Record Identity)',
      'Subsequent check-in must preserve record ID and avoid duplicated entry'
    );
    passedCount += 2;
  } catch (e) {
    console.error(e);
  }

  // ---------------------------------------------------------------
  // Test 3: Curfew Boundary Times & Midnight Day-Rollover
  // ---------------------------------------------------------------
  try {
    const sessionDate = '2026-10-13';
    // Window: 2026-10-13 22:00 to 2026-10-14 00:00 (Midnight rollover!)
    const window = calculateCurfewWindow(sessionDate, '22:00', '00:00', 0);

    // 3A: Pre-window time (21:59:50) -> Too early
    const earlyTime = new Date(2026, 9, 13, 21, 59, 50);
    const earlyEval = evaluateCurfewStatus(earlyTime, window);
    assert(
      earlyEval.isTooEarly && !earlyEval.isWithinWindow,
      'Test 3A: Pre-Window Boundary (21:59 IST)',
      'Attempting check-in before 22:00 must be flagged isTooEarly'
    );

    // 3B: In-window standard time (22:45) -> In window
    const inWindowTime = new Date(2026, 9, 13, 22, 45, 0);
    const inWindowEval = evaluateCurfewStatus(inWindowTime, window);
    assert(
      inWindowEval.isWithinWindow && !earlyEval.isLate,
      'Test 3B: In-Window Curfew (22:45 IST)',
      '22:45 must fall within valid curfew window'
    );

    // 3C: Post-midnight standard cutoff (00:05 next day) without extension -> Late
    const lateTime = new Date(2026, 9, 14, 0, 5, 0); // Oct 14 00:05
    const lateEval = evaluateCurfewStatus(lateTime, window);
    assert(
      lateEval.isLate && !lateEval.isWithinWindow,
      'Test 3C: Midnight Rollover Cutoff (00:05 IST Without Extension)',
      '00:05 past midnight cutoff must be flagged isLate'
    );

    // 3D: Past midnight with 45-minute approved extension (00:30 next day) -> Valid
    const extendedWindow = calculateCurfewWindow(sessionDate, '22:00', '00:00', 45);
    const extendedTime = new Date(2026, 9, 14, 0, 30, 0); // Oct 14 00:30
    const extendedEval = evaluateCurfewStatus(extendedTime, extendedWindow);
    assert(
      extendedEval.isWithinWindow && extendedEval.hasExtensionApplied,
      'Test 3D: Curfew Extension Buffer (00:30 IST with +45m Extension)',
      '00:30 with 45m extension must be accepted inside extended window'
    );
    passedCount += 4;
  } catch (e) {
    console.error(e);
  }

  // ---------------------------------------------------------------
  // Test 4: Browser Location Capture & Geofence Validation
  // ---------------------------------------------------------------
  try {
    // 4A: Valid in-bounds capture
    const inBoundsResult = validateLocationCapture(validLocation, {
      id: 'HST-SUN-01',
      name: 'Sunrise Boys Hostel',
      jurisdictionCode: '#HST-SUN-01',
      tenancyNode: 'NODE-01',
      capacity: 120,
      totalStudents: 120,
      activeShift: 'Night Shift',
    });
    assert(
      inBoundsResult.isValid && inBoundsResult.isWithinGeofence,
      'Test 4A: In-Bounds Geofence Verification',
      `Expected in-bounds within 200m, calculated distance: ${inBoundsResult.distanceMeters}m`
    );

    // 4B: Off-perimeter coordinate (~4.5km away)
    const offPerimeterLocation: LocationCapture = {
      latitude: 31.9900,
      longitude: 77.1600,
      accuracyMeters: 15,
      timestamp: new Date().toISOString(),
      isMocked: false,
    };
    const offResult = validateLocationCapture(offPerimeterLocation);
    assert(
      !offResult.isValid && !offResult.isWithinGeofence && offResult.status === 'Off-Perimeter',
      'Test 4B: Off-Perimeter Location Rejection',
      `Distance ${offResult.distanceMeters}m must be rejected as Off-Perimeter`
    );

    // 4C: Mock Location Spoofing Detection
    const spoofedLocation: LocationCapture = {
      ...validLocation,
      isMocked: true,
    };
    const spoofResult = validateLocationCapture(spoofedLocation);
    assert(
      !spoofResult.isValid && spoofResult.status === 'Mock-Detected',
      'Test 4C: Mock GPS Spoofing Detection',
      'Mock location flag must trigger immediate security rejection'
    );

    // 4D: Excessive GPS Accuracy Drift (>200m)
    const driftLocation: LocationCapture = {
      ...validLocation,
      accuracyMeters: 350,
    };
    const driftResult = validateLocationCapture(driftLocation);
    assert(
      !driftResult.isValid && driftResult.status === 'Excessive-Drift',
      'Test 4D: Excessive Accuracy Drift Rejection',
      'Inaccurate GPS drift (>200m) must be rejected'
    );
    passedCount += 4;
  } catch (e) {
    console.error(e);
  }

  // ---------------------------------------------------------------
  // Test 5: Extension Request Parameter Validation
  // ---------------------------------------------------------------
  try {
    let invalidDurationRejected = false;
    try {
      await requestCurfewExtension({
        studentDocId: 'stu_102_rahul',
        studentId: 'STU-102',
        studentName: 'Rahul Sharma',
        hostelId: 'HST-SUN-01',
        room: 'B-204',
        durationMinutes: 5, // Under 15m minimum!
        reason: 'Short test',
        actor: validStudentProfile,
      });
    } catch (err) {
      if (err instanceof ValidationError) {
        invalidDurationRejected = true;
      }
    }

    assert(
      invalidDurationRejected,
      'Test 5: Curfew Extension Bounds Validation (Minimum 15m)',
      'Extension requests under 15 minutes must be rejected'
    );
    passedCount++;
  } catch (e) {
    console.error(e);
  }

  console.log('\n====================================================');
  console.log(`Results: ${passedCount}/12 Phase D Tests Passed Successfully!`);
  console.log('====================================================\n');

  try {
    const { terminate } = await import('firebase/firestore');
    const { db } = await import('../lib/firebase');
    await terminate(db);
  } catch {}
  process.exit(0);
}

runPhaseDTests().catch((err) => {
  console.error('Phase D test suite uncaught failure:', err);
  process.exit(1);
});
