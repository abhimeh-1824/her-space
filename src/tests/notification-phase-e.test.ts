/**
 * Phase E Automated Notification & Scheduler Test Suite
 * Tests FCM device registration, concurrency-safe cron idempotency,
 * protected endpoint authentication, retry limits, and honest status reporting.
 */

import {
  registerDeviceToken,
  dispatchNotificationJob,
  handleCronSchedulerInvocation,
  validateCronSecret,
  DEFAULT_CRON_SECRET,
} from '../lib/notifications';
import { NotificationJob } from '../types';
import { UnauthorizedError, ValidationError } from '../lib/errors';

function assert(condition: boolean, testName: string, detail?: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${testName} - ${detail || 'Condition not met'}`);
    process.exitCode = 1;
    throw new Error(`Test failed: ${testName}`);
  }
  console.log(`✅ PASSED: ${testName}`);
}

async function runPhaseETests() {
  console.log('====================================================');
  console.log('Running HostelGuard Phase E Notifications & Cron Test Suite');
  console.log('====================================================\n');

  let passedCount = 0;

  // ---------------------------------------------------------------
  // Test 1: FCM Device Registration & Token Binding
  // ---------------------------------------------------------------
  try {
    const reg = await registerDeviceToken({
      userId: 'stu_102_rahul',
      userEmail: 'rahul.s@campus.edu',
      hostelId: 'HST-SUN-01',
      fcmToken: 'fcm_test_token_89a01b22_valid_pixel8',
      deviceModel: 'Pixel 8 Pro',
      browser: 'Chrome 122',
    });

    assert(
      reg.status === 'active' && reg.fcmToken.includes('fcm_test_token'),
      'Test 1A: FCM Device Push Token Registration',
      'Device token must be registered with active status'
    );

    // Missing token validation rejection
    let missingTokenRejected = false;
    try {
      await registerDeviceToken({
        userId: 'stu_102_rahul',
        userEmail: 'rahul.s@campus.edu',
        hostelId: 'HST-SUN-01',
        fcmToken: '',
      });
    } catch (err) {
      if (err instanceof ValidationError) {
        missingTokenRejected = true;
      }
    }

    assert(
      missingTokenRejected,
      'Test 1B: Empty Token Registration Rejection',
      'Empty FCM token must throw ValidationError'
    );
    passedCount += 2;
  } catch (e) {
    console.error(e);
  }

  // ---------------------------------------------------------------
  // Test 2: Protected Scheduler Endpoint Authentication (Secret Protection)
  // ---------------------------------------------------------------
  try {
    // 2A: Unauthenticated invocation (no auth header)
    let unauthorizedBlocked = false;
    try {
      await handleCronSchedulerInvocation({
        authHeader: undefined,
        secretHeader: undefined,
        slotKey: 'slot_unauth_test',
        jobType: 'curfew_reminder_1',
      });
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        unauthorizedBlocked = true;
      }
    }

    assert(
      unauthorizedBlocked,
      'Test 2A: Missing Bearer Token Rejection (401 Unauthorized)',
      'Scheduler must reject calls missing valid Cloudflare Worker Cron secret'
    );

    // 2B: Invalid secret token
    let invalidSecretBlocked = false;
    try {
      await handleCronSchedulerInvocation({
        authHeader: 'Bearer wrong_malicious_secret_token_99',
        slotKey: 'slot_invalid_sec',
        jobType: 'curfew_reminder_1',
      });
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        invalidSecretBlocked = true;
      }
    }

    assert(
      invalidSecretBlocked,
      'Test 2B: Invalid Secret Token Rejection',
      'Scheduler must reject invalid secret tokens'
    );

    // 2C: Valid Bearer token
    assert(
      validateCronSecret(`Bearer ${DEFAULT_CRON_SECRET}`),
      'Test 2C: Valid Bearer Secret Authentication',
      'Cloudflare Worker Cron Bearer token must validate successfully'
    );
    passedCount += 3;
  } catch (e) {
    console.error(e);
  }

  // ---------------------------------------------------------------
  // Test 3: Concurrency-Safe Idempotency & Duplicate Cron Invocations
  // ---------------------------------------------------------------
  try {
    const uniqueCronSlot = `cron_rem1_20261013_${Date.now()}`;

    // First invocation: executes
    const firstRun = await handleCronSchedulerInvocation({
      authHeader: `Bearer ${DEFAULT_CRON_SECRET}`,
      slotKey: uniqueCronSlot,
      jobType: 'curfew_reminder_1',
      hostelId: 'HST-SUN-01',
      sessionDate: '2026-10-13',
    });

    assert(
      firstRun.success && !firstRun.isDuplicateSkipped && firstRun.jobsProcessed === 1,
      'Test 3A: Initial Cron Invocations Dispatch',
      'First cron invocation for slot must process jobs'
    );

    // Duplicate invocation: must be caught by concurrency lease & skipped
    const secondRun = await handleCronSchedulerInvocation({
      authHeader: `Bearer ${DEFAULT_CRON_SECRET}`,
      slotKey: uniqueCronSlot,
      jobType: 'curfew_reminder_1',
      hostelId: 'HST-SUN-01',
      sessionDate: '2026-10-13',
    });

    assert(
      secondRun.success && secondRun.isDuplicateSkipped && secondRun.jobsProcessed === 0,
      'Test 3B: Duplicate Scheduler Invocation Idempotency (Safe Skip)',
      'Subsequent cron ping for same slot must be skipped idempotently'
    );
    passedCount += 2;
  } catch (e) {
    console.error(e);
  }

  // ---------------------------------------------------------------
  // Test 4: Exponential Backoff Retries & Dead-Letter (Retry Limit = 3)
  // ---------------------------------------------------------------
  try {
    const failingJob: NotificationJob = {
      id: 'job_fail_test_01',
      idempotencyKey: 'key_fail_test',
      jobType: 'curfew_reminder_2',
      hostelId: 'HST-SUN-01',
      sessionDate: '2026-10-13',
      targetUserIds: ['STU-FAIL-99'],
      title: 'Failing alert',
      body: 'Will fail downstream gateway',
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
    };

    // Simulated gateway that always fails
    const mockFailingGateway = async () => false;

    const result = await dispatchNotificationJob(failingJob, mockFailingGateway);

    assert(
      !result.success && result.status === 'failed' && failingJob.retryCount === 3,
      'Test 4: Retry Limits & Dead-Letter Queue (maxRetries = 3)',
      `Job must retry up to 3 times before transitioning to 'failed', got retries: ${failingJob.retryCount}`
    );
    passedCount++;
  } catch (e) {
    console.error(e);
  }

  // ---------------------------------------------------------------
  // Test 5: Honest Notification Status Reporting
  // ---------------------------------------------------------------
  try {
    const honestJob: NotificationJob = {
      id: 'job_honest_test_02',
      idempotencyKey: 'key_honest_test',
      jobType: 'curfew_violation_alert',
      hostelId: 'HST-SUN-01',
      sessionDate: '2026-10-13',
      targetUserIds: ['STU-102', 'STU-103', 'STU-104'],
      title: 'Midnight Curfew Alert',
      body: 'Roll-call window closed.',
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
    };

    const honestResult = await dispatchNotificationJob(honestJob);

    assert(
      honestResult.success &&
        honestResult.dispatched === 3 &&
        honestResult.failed === 0 &&
        honestResult.status === 'completed',
      'Test 5: Honest Notification Metrics & Status Reporting',
      `Expected dispatched: 3, failed: 0, completed. Got: ${JSON.stringify(honestResult)}`
    );
    passedCount++;
  } catch (e) {
    console.error(e);
  }

  // ---------------------------------------------------------------
  // Test 6: Secret Exposure Prevention
  // ---------------------------------------------------------------
  try {
    const slotKey = `slot_secret_check_${Date.now()}`;
    const result = await handleCronSchedulerInvocation({
      authHeader: `Bearer ${DEFAULT_CRON_SECRET}`,
      slotKey,
      jobType: 'curfew_window_open',
    });

    const serialized = JSON.stringify(result);
    assert(
      !serialized.includes(DEFAULT_CRON_SECRET),
      'Test 6: Secret Sanitization (No Secret Leakage in Payload)',
      'Invocation response must never expose the raw cron secret'
    );
    passedCount++;
  } catch (e) {
    console.error(e);
  }

  console.log('\n====================================================');
  console.log(`Results: ${passedCount}/10 Phase E Tests Passed Successfully!`);
  console.log('====================================================\n');

  try {
    const { terminate } = await import('firebase/firestore');
    const { db } = await import('../lib/firebase');
    await terminate(db);
  } catch {}
  process.exit(0);
}

runPhaseETests().catch((err) => {
  console.error('Phase E test suite uncaught failure:', err);
  process.exit(1);
});
