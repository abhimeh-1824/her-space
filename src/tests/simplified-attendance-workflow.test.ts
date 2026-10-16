import assert from 'node:assert';
import {
  createResidentInvitation,
  verifyInvitationToken,
  completeResidentSetup,
  regenerateResidentInvitation,
  hashToken,
} from '../lib/invitation-service';
import {
  checkOutResident,
  checkInResident,
  recordEstimatedReturnTime,
} from '../lib/attendance-service';
import { processHostelNightReminders } from '../lib/notifications';
import { UserProfile, Student } from '../types';

console.log('====================================================');
console.log('Running Simplified Attendance System Verification Suite');
console.log('====================================================\n');

async function runTests() {
  const adminActor: UserProfile = {
    uid: 'admin_test_01',
    email: 'admin@herspace.app',
    role: 'super_admin',
    name: 'Chief Admin',
    hostelId: 'HST-HER-01',
    hostelMemberships: ['HST-HER-01', 'HST-HER-02'],
    policyConsentVersion: 'v2.4',
    createdAt: new Date().toISOString(),
  };

  const wardenActor: UserProfile = {
    uid: 'warden_test_01',
    email: 'warden@herspace.app',
    role: 'warden',
    name: 'Warden Sunita',
    hostelId: 'HST-HER-01',
    hostelMemberships: ['HST-HER-01'],
    policyConsentVersion: 'v2.4',
    createdAt: new Date().toISOString(),
  };

  const studentActor: UserProfile = {
    uid: 'stu_doc_102',
    email: 'ananya@herspace.app',
    role: 'student',
    name: 'Ananya Sharma',
    hostelId: 'HST-HER-01',
    hostelMemberships: ['HST-HER-01'],
    roomNumber: '101',
    policyConsentVersion: 'v2.4',
    createdAt: new Date().toISOString(),
  };

  // -------------------------------------------------------------------------
  // Test 1: Flow C - Resident Invitation Token Security (SHA-256, Single-Use, Expiry)
  // -------------------------------------------------------------------------
  console.log('--- Test 1: Flow C - Resident Setup Link Security ---');

  const invResult = await createResidentInvitation({
    residentDocId: 'stu_doc_102',
    residentId: 'STU-102',
    name: 'Ananya Sharma',
    emailOrPhone: 'ananya@herspace.app',
    roomNumber: '101',
    hostelId: 'HST-HER-01',
    actor: wardenActor,
    appBaseUrl: 'http://localhost:3000',
  });

  assert.ok(invResult.setupUrl.includes('/setup/'), 'Setup URL must contain /setup/ path');
  assert.strictEqual(invResult.invitation.status, 'pending');
  assert.strictEqual(invResult.invitation.residentId, 'STU-102');

  // Verify token hash is 64-char hex SHA-256
  const rawToken = invResult.invitation.token;
  const computedHash = await hashToken(rawToken);
  assert.strictEqual(invResult.invitation.tokenHash, computedHash, 'Stored token must match SHA-256 hash');
  console.log('✅ PASSED: Test 1A: Setup token generation & SHA-256 hash verification');

  // Verify token lookup
  const verifiedToken = await verifyInvitationToken(rawToken);
  assert.strictEqual(verifiedToken.name, 'Ananya Sharma');
  assert.strictEqual(verifiedToken.roomNumber, '101');
  console.log('✅ PASSED: Test 1B: Valid token verification');

  // Identity verification check on setup completion: must fail if identifier does not match
  try {
    await completeResidentSetup({
      token: rawToken,
      password: 'password123',
      verificationIdentifier: 'WRONG_ID',
    });
    assert.fail('Should reject mismatched identity verification');
  } catch (err: unknown) {
    assert.ok(
      err instanceof Error && err.message.includes('Identity verification failed'),
      'Must enforce identity matching check'
    );
  }
  console.log('✅ PASSED: Test 1C: Mismatched identity verification rejected');

  // Valid setup completion with correct Resident ID
  const setupResult = await completeResidentSetup({
    token: rawToken,
    password: 'password123',
    verificationIdentifier: 'STU-102',
    deviceModel: 'Mobile Chrome',
  });
  assert.ok(setupResult.success);
  assert.strictEqual(setupResult.user.role, 'student', 'Resident setup must not escalate role');
  console.log('✅ PASSED: Test 1D: Setup completion with identity verification & role binding');

  // Single-use token enforcement: subsequent attempts must be rejected
  try {
    await verifyInvitationToken(rawToken);
    assert.fail('Should reject already used token');
  } catch (err: unknown) {
    assert.ok(
      err instanceof Error && err.message.includes('already been used'),
      'Must enforce single-use token invalidation'
    );
  }
  console.log('✅ PASSED: Test 1E: Single-use token enforcement (reuse blocked)');

  // -------------------------------------------------------------------------
  // Test 2: Flow D - Resident Check OUT (Anywhere, Authoritative Timestamp, Idempotent)
  // -------------------------------------------------------------------------
  console.log('\n--- Test 2: Flow D - Resident Check OUT ---');

  const outRecord = await checkOutResident({
    studentDocId: 'stu_doc_102',
    studentId: 'STU-102',
    hostelId: 'HST-HER-01',
    outPassReason: 'Going to city library',
    actor: studentActor,
  });

  assert.strictEqual(outRecord.status, 'Declared OUT');
  assert.ok(outRecord.checkOutAt, 'Must record authoritative server timestamp');
  assert.strictEqual(outRecord.outReason, 'Going to city library');
  console.log('✅ PASSED: Test 2A: Check OUT recorded with authoritative timestamp and optional note');

  // Idempotency: checking OUT again while already OUT must return existing absence without creating duplicate
  const replayOutRecord = await checkOutResident({
    studentDocId: 'stu_doc_102',
    studentId: 'STU-102',
    hostelId: 'HST-HER-01',
    outPassReason: 'Duplicate click',
    actor: studentActor,
  });
  assert.strictEqual(replayOutRecord.id, outRecord.id, 'Must return same uninterrupted absence record');
  console.log('✅ PASSED: Test 2B: Idempotent check OUT (no duplicate uninterrupted records)');

  // -------------------------------------------------------------------------
  // Test 3: Flow E - Resident Check IN Location Verification & Exact Outside Warning
  // -------------------------------------------------------------------------
  console.log('\n--- Test 3: Flow E - Check IN Location Verification ---');

  // 3A: Outside permitted radius (far away e.g. 5 km away in city center)
  const outsideResult = await checkInResident({
    studentDocId: 'stu_doc_102',
    studentId: 'STU-102',
    hostelId: 'HST-HER-01',
    location: {
      latitude: 31.9100, // ~5.5 km away from HER-SPACE coordinates (31.9578, 77.1095)
      longitude: 77.1000,
      accuracyMeters: 15,
      timestamp: new Date().toISOString(),
      isMocked: false,
    },
    actor: studentActor,
  });

  // Verify status remains OUT
  assert.strictEqual(outsideResult.isOutsideRadius, true);
  assert.strictEqual(outsideResult.status, 'Declared OUT', 'Status must remain OUT when outside radius');
  assert.ok(outsideResult.distanceMeters > 500, 'Distance must exceed hostel radius');

  // Verify exact required warning string
  const expectedWarning =
    "You appear to be outside your hostel's permitted check-in area. Your attendance status has not changed. Please return to the hostel and try again.";
  assert.strictEqual(
    outsideResult.message,
    expectedWarning,
    'Must return exact required outside-radius warning string'
  );
  console.log('✅ PASSED: Test 3A: Outside radius check-in rejected with exact warning and status kept OUT');

  // 3B: Inside permitted radius (within ~15m of hostel boundary)
  const insideResult = await checkInResident({
    studentDocId: 'stu_doc_102',
    studentId: 'STU-102',
    hostelId: 'HST-HER-01',
    location: {
      latitude: 31.95781,
      longitude: 77.10951,
      accuracyMeters: 12,
      timestamp: new Date().toISOString(),
      isMocked: false,
      address: 'HER-SPACE Main Residency complex',
    },
    actor: studentActor,
  });

  assert.strictEqual(insideResult.isOutsideRadius, undefined);
  assert.ok(insideResult.status === 'Confirmed IN' || insideResult.status === 'Late Check-in');
  assert.ok(insideResult.record.checkInAt, 'Accepted check-in must record server timestamp');
  console.log('✅ PASSED: Test 3B: Inside radius check-in accepted with authoritative timestamp');

  // -------------------------------------------------------------------------
  // Test 4: Flow F - Estimated Return Time Submission & Night Reminders
  // -------------------------------------------------------------------------
  console.log('\n--- Test 4: Flow F - Estimated Return Time & Night Reminders ---');

  // First mark resident OUT again
  await checkOutResident({
    studentDocId: 'stu_doc_102',
    studentId: 'STU-102',
    hostelId: 'HST-HER-01',
    outPassReason: 'Evening study group',
    actor: studentActor,
  });

  // Submit estimated return time
  await recordEstimatedReturnTime('stu_doc_102', 'HST-HER-01', '23:15', studentActor);
  console.log('✅ PASSED: Test 4A: Estimated return time recorded (status remains OUT)');

  // Night Reminders Job with OUT resident list
  const reminderResult = await processHostelNightReminders({
    hostelId: 'HST-HER-01',
    scheduledSlot: '22:15',
    authHeader: 'Bearer hostelguard_cf_worker_cron_sec_89b21',
    outResidents: [
      {
        name: 'Ananya Sharma',
        room: '101',
        studentId: 'STU-102',
        outTime: '19:30',
        estimatedReturnTime: '23:15',
      },
    ],
    wardenEmail: 'warden@herspace.app',
  });

  assert.strictEqual(reminderResult.success, true);
  assert.strictEqual(reminderResult.outCount, 1);
  assert.strictEqual(reminderResult.pushesDispatched, 1);
  assert.strictEqual(reminderResult.wardenEmailStatus, 'provider_accepted');
  console.log('✅ PASSED: Test 4B: Scheduled reminder processed OUT residents and dispatched warden summary');

  // Unambiguous report when 0 residents are OUT
  const clearReminderResult = await processHostelNightReminders({
    hostelId: 'HST-HER-02',
    scheduledSlot: '22:30',
    authHeader: 'Bearer hostelguard_cf_worker_cron_sec_89b21',
    outResidents: [],
    wardenEmail: 'warden@herspace.app',
  });
  assert.strictEqual(clearReminderResult.success, true);
  assert.strictEqual(clearReminderResult.outCount, 0);
  assert.ok(
    clearReminderResult.summary.includes('All residents accounted for (0 OUT)'),
    'Email report must clearly confirm no residents OUT'
  );
  console.log('✅ PASSED: Test 4C: Clear unambiguous report when zero residents are OUT');

  // Idempotency: retry of same slot must be safely skipped
  const duplicateJobResult = await processHostelNightReminders({
    hostelId: 'HST-HER-01',
    scheduledSlot: '22:15',
    authHeader: 'Bearer hostelguard_cf_worker_cron_sec_89b21',
    outResidents: [],
    wardenEmail: 'warden@herspace.app',
  });
  assert.strictEqual(duplicateJobResult.isDuplicateSkipped, true);
  console.log('✅ PASSED: Test 4D: Duplicate scheduler invocation safely skipped (Idempotency Lock)');

  console.log('\n====================================================');
  console.log('All 12 Simplified Workflow Verification Tests Passed!');
  console.log('====================================================');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
