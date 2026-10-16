/**
 * Phase G Automated Test Suite for HostelGuard
 * Tests hostel-specific settings, tenancy boundary permissions,
 * attendance report metrics consistency across Asia/Kolkata timezone,
 * RFC 4180 CSV import & export engine, and audit ledger tracking.
 */

import {
  getHostelsForUser,
  updateHostelDetails,
  getHostelSettings,
  updateHostelSettings,
  generateAttendanceReport,
  exportAttendanceToCsv,
  exportAuditLogsToCsv,
  parseAndValidateStudentCsv,
  getAuditHistory,
  isValidTimeString,
  hostelCache,
} from '../lib/hostel-service';
import { UserProfile, Student, AttendanceRecord, Hostel } from '../types';
import { ForbiddenError, ValidationError } from '../lib/errors';
const INITIAL_STUDENTS: Student[] = [
  {
    id: 't_stu_1',
    studentId: 'STU-001',
    hostelId: 'HST-SUN-01',
    name: 'Rahul Sharma',
    rollNo: '#21CSE084',
    semester: '4th Sem',
    room: 'A-101',
    block: 'Block A',
    floor: 1,
    email: 'rahul.s@campus.edu',
    phone: '+91 98000 00000',
    guardianPhone: '+91 98000 00001',
    status: 'active',
    device: 'Mobile',
    browser: 'Chrome',
    deviceStatus: 'registered',
    attendanceStatus: 'IN',
    lastUpdated: '10:00 PM',
    avatarInitials: 'RS',
  },
  {
    id: 't_stu_2',
    studentId: 'STU-002',
    hostelId: 'HST-SUN-01',
    name: 'Pooja Verma',
    rollNo: '#21CSE085',
    semester: '4th Sem',
    room: 'A-102',
    block: 'Block A',
    floor: 1,
    email: 'pooja@herspace.app',
    phone: '+91 98000 00001',
    guardianPhone: '+91 98000 00002',
    status: 'active',
    device: 'Mobile',
    browser: 'Chrome',
    deviceStatus: 'registered',
    attendanceStatus: 'OUT',
    lastUpdated: '09:00 PM',
    avatarInitials: 'PV',
  },
];

const INITIAL_ATTENDANCE_HISTORY: AttendanceRecord[] = [
  {
    id: 'att_1',
    refId: '#ATT-001',
    studentId: 'STU-001',
    hostelId: 'HST-SUN-01',
    date: new Date().toISOString().slice(0, 10),
    status: 'Confirmed IN',
    method: 'Biometric Face-Mesh',
  },
  {
    id: 'att_2',
    refId: '#ATT-002',
    studentId: 'STU-002',
    hostelId: 'HST-SUN-01',
    date: new Date().toISOString().slice(0, 10),
    status: 'Declared OUT',
    method: 'Warden Override',
  },
];

function assert(condition: boolean, testName: string, detail?: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${testName} - ${detail || 'Condition not met'}`);
    process.exitCode = 1;
    throw new Error(`Test failed: ${testName}`);
  }
  console.log(`✅ PASSED: ${testName}`);
}

async function runPhaseGTests() {
  console.log('====================================================');
  console.log('Running HostelGuard Phase G Hostel Settings & Reports Suite');
  console.log('====================================================\n');

  // Seed test hostels in cache for test environment
  hostelCache.set('HST-SUN-01', {
    id: 'HST-SUN-01',
    name: 'Sunita Rao Hall',
    jurisdictionCode: 'JUR-SUN-01',
    capacity: 200,
    totalStudents: 180,
    activeShift: 'Night Curfew Shift',
    curfewStart: '22:00',
    curfewEnd: '00:00',
  } as Hostel);
  hostelCache.set('HST-ANN-02', {
    id: 'HST-ANN-02',
    name: 'Ananya Sen Block',
    jurisdictionCode: 'JUR-ANN-02',
    capacity: 150,
    totalStudents: 140,
    activeShift: 'Night Curfew Shift',
    curfewStart: '22:00',
    curfewEnd: '00:00',
  } as Hostel);

  // Test Actors
  const superAdmin: UserProfile = {
    uid: 'admin_root',
    email: 'admin@campus.edu',
    role: 'super_admin',
    name: 'Chief Warden Admin',
    hostelId: 'HST-SUN-01',
    hostelMemberships: ['HST-SUN-01', 'HST-ANN-02'],
    policyConsentVersion: 'v2.4',
    createdAt: new Date().toISOString(),
  };

  const authorizedWarden: UserProfile = {
    uid: 'warden_sharma',
    email: 'warden.sharma@campus.edu',
    role: 'warden',
    name: 'Warden R. K. Sharma',
    hostelId: 'HST-SUN-01',
    hostelMemberships: ['HST-SUN-01'],
    policyConsentVersion: 'v2.4',
    createdAt: new Date().toISOString(),
  };

  const studentUser: UserProfile = {
    uid: 'student_rahul',
    email: 'rahul.s@campus.edu',
    role: 'student',
    name: 'Rahul Sharma',
    hostelId: 'HST-SUN-01',
    hostelMemberships: ['HST-SUN-01'],
    policyConsentVersion: 'v2.4',
    createdAt: new Date().toISOString(),
  };

  // ------------------------------------------------------------------------
  // Test 1: Authorized Hostel Management & Multi-Hostel Tenancy Access
  // ------------------------------------------------------------------------
  console.log('--- Test 1: Authorized Hostel Management & Tenancy Access ---');

  const adminHostels = await getHostelsForUser(superAdmin);
  assert(
    adminHostels.length >= 2,
    'Test 1A: Super Admin retrieves full campus hostel portfolio',
    `Expected at least 2 hostels, got ${adminHostels.length}`
  );

  const wardenHostels = await getHostelsForUser(authorizedWarden);
  assert(
    wardenHostels.every((h) => h.id === 'HST-SUN-01'),
    'Test 1B: Warden access restricted strictly to assigned hostel jurisdiction',
    `Warden had access to ${wardenHostels.map((h) => h.id).join(', ')}`
  );

  const studentHostels = await getHostelsForUser(studentUser);
  assert(
    studentHostels.length === 1 && studentHostels[0].id === 'HST-SUN-01',
    'Test 1C: Resident student confined to primary residential hostel',
    `Student had access to ${studentHostels.map((h) => h.id).join(', ')}`
  );

  let crossHostelBlocked = false;
  try {
    // Authorized warden only has HST-SUN-01, attempts to update HST-ANN-02
    await updateHostelDetails('HST-ANN-02', { capacity: 60 }, authorizedWarden);
  } catch (err) {
    if (err instanceof ForbiddenError) crossHostelBlocked = true;
  }
  assert(
    crossHostelBlocked,
    'Test 1D: Unauthorized cross-hostel property modification rejected with ForbiddenError'
  );

  // ------------------------------------------------------------------------
  // Test 2: Hostel Settings Updates & Boundary Bounds Validation
  // ------------------------------------------------------------------------
  console.log('\n--- Test 2: Hostel Settings Updates & Bounds Validation ---');

  assert(
    isValidTimeString('22:00') && isValidTimeString('00:00') && !isValidTimeString('25:00') && !isValidTimeString('invalid'),
    'Test 2A: 24-hour time format validator strictly verifies HH:MM ranges'
  );

  let invalidTimeBlocked = false;
  try {
    await updateHostelSettings(
      {
        hostelId: 'HST-SUN-01',
        windowOpen: '25:99',
      },
      authorizedWarden
    );
  } catch (err) {
    if (err instanceof ValidationError) invalidTimeBlocked = true;
  }
  assert(
    invalidTimeBlocked,
    'Test 2B: Malformed window opening time rejected with ValidationError'
  );

  let outOfBoundsExtBlocked = false;
  try {
    await updateHostelSettings(
      {
        hostelId: 'HST-SUN-01',
        maxExtensionMins: 300, // exceeds max 180 min buffer
      },
      authorizedWarden
    );
  } catch (err) {
    if (err instanceof ValidationError) outOfBoundsExtBlocked = true;
  }
  assert(
    outOfBoundsExtBlocked,
    'Test 2C: Out-of-bounds curfew extension buffer (>180m) rejected with ValidationError'
  );

  let outOfBoundsGeofenceBlocked = false;
  try {
    await updateHostelSettings(
      {
        hostelId: 'HST-SUN-01',
        geofenceRadiusMeters: 5, // under minimum 10m threshold
      },
      authorizedWarden
    );
  } catch (err) {
    if (err instanceof ValidationError) outOfBoundsGeofenceBlocked = true;
  }
  assert(
    outOfBoundsGeofenceBlocked,
    'Test 2D: Geofence radius under 10m minimum rejected with ValidationError'
  );

  // Valid settings update
  const updatedSettings = await updateHostelSettings(
    {
      hostelId: 'HST-SUN-01',
      windowOpen: '21:30',
      curfewCutoff: '00:00',
      maxExtensionMins: 90,
      geofenceRadiusMeters: 200,
      lateProtocol: 'strict-lock',
    },
    authorizedWarden,
    'Winter schedule examination adjustments'
  );
  assert(
    updatedSettings.windowOpen === '21:30' &&
      updatedSettings.maxExtensionMins === 90 &&
      updatedSettings.geofenceRadiusMeters === 200 &&
      updatedSettings.lateProtocol === 'strict-lock',
    'Test 2E: Valid hostel settings configuration committed and cached successfully'
  );

  // ------------------------------------------------------------------------
  // Test 3: Attendance Reports & Timezone Metric Aggregation Consistency
  // ------------------------------------------------------------------------
  console.log('\n--- Test 3: Attendance Reports & Timezone Metrics Consistency ---');

  const report = generateAttendanceReport(
    {
      hostelId: 'HST-SUN-01',
      datePreset: '30d',
    },
    INITIAL_STUDENTS,
    INITIAL_ATTENDANCE_HISTORY
  );

  const { metrics, records } = report;
  const sumRecords =
    metrics.confirmedCount +
    metrics.declaredOutCount +
    metrics.lateCount +
    metrics.exceptionCount;

  assert(
    metrics.totalRecords === sumRecords,
    'Test 3A: Mathematical consistency: Total records equals sum of status categories',
    `Total: ${metrics.totalRecords}, Sum: ${sumRecords}`
  );

  assert(
    metrics.attendanceRate >= 0 && metrics.attendanceRate <= 100,
    'Test 3B: Attendance compliance percentage within valid 0–100% bounds',
    `Rate: ${metrics.attendanceRate}%`
  );

  assert(
    metrics.dailyBreakdown.length === 5,
    'Test 3C: Daily chart trend trajectory generated across 5 temporal intervals'
  );

  const filteredByStatus = generateAttendanceReport(
    {
      hostelId: 'HST-SUN-01',
      status: 'Confirmed IN',
    },
    INITIAL_STUDENTS,
    INITIAL_ATTENDANCE_HISTORY
  );
  assert(
    filteredByStatus.records.every((r) => r.status === 'Confirmed IN'),
    'Test 3D: Status filter correctly confines report records to matching status'
  );

  const filteredBySearch = generateAttendanceReport(
    {
      hostelId: 'HST-SUN-01',
      searchQuery: 'Rahul',
    },
    INITIAL_STUDENTS,
    INITIAL_ATTENDANCE_HISTORY
  );
  assert(
    filteredBySearch.records.some((r) => r.studentName?.includes('Rahul')),
    'Test 3E: Full-text search accurately isolates resident records by name query'
  );

  // ------------------------------------------------------------------------
  // Test 4: RFC 4180 CSV Export Generation
  // ------------------------------------------------------------------------
  console.log('\n--- Test 4: RFC 4180 CSV Export Engine ---');

  const attendanceCsv = exportAttendanceToCsv(INITIAL_ATTENDANCE_HISTORY, INITIAL_STUDENTS);
  assert(
    attendanceCsv.includes('Date,Reference ID,Student ID,Student Name,Roll Number,Room,Status'),
    'Test 4A: Attendance CSV contains standard institutional column headers'
  );
  assert(
    attendanceCsv.includes('Confirmed IN') && attendanceCsv.includes('Declared OUT'),
    'Test 4B: Attendance CSV correctly serializes attendance status taxonomy'
  );

  const auditHistory = await getAuditHistory('HST-SUN-01');
  const auditCsv = exportAuditLogsToCsv(auditHistory);
  assert(
    auditCsv.includes('Audit ID,Timestamp (IST),Operator,Role,Policy Target'),
    'Test 4C: Audit log CSV includes tamper-evident ledger schema headers'
  );

  // ------------------------------------------------------------------------
  // Test 5: CSV Import Parser, Validation & Duplicate Detection
  // ------------------------------------------------------------------------
  console.log('\n--- Test 5: CSV Import Parser & Validation Engine ---');

  // Empty CSV
  const emptyImport = parseAndValidateStudentCsv('', 'HST-SUN-01');
  assert(
    emptyImport.errors.length > 0 && emptyImport.importedCount === 0,
    'Test 5A: Empty CSV payload properly rejected'
  );

  // Missing headers
  const missingHeadersCsv = `some_header,another_header\nvalue1,value2`;
  const missingHeadersImport = parseAndValidateStudentCsv(missingHeadersCsv, 'HST-SUN-01');
  assert(
    missingHeadersImport.errors.some((e) => e.field === 'headers'),
    'Test 5B: CSV missing mandatory columns rejected with descriptive error'
  );

  // Valid CSV with duplicate detection & malformed email check
  const testCsvContent = `name,rollNo,room,email,phone,semester
Aakash Verma,#23CSE012,A-101,aakash.v@campus.edu,+91 98160 11223,1st Sem
Divya Sharma,#22ECE045,B-205,divya.s@campus.edu,+91 98160 22334,3rd Sem
Invalid Email Resident,#21MEC033,C-302,not-an-email,+91 98160 33445,5th Sem
Duplicate Roll Resident,#23CSE012,B-204,dup.roll@campus.edu,+91 98160 44556,1st Sem
`;

  const parsedBatch = parseAndValidateStudentCsv(testCsvContent, 'HST-SUN-01');
  assert(
    parsedBatch.importedCount === 2,
    'Test 5C: Valid resident records successfully parsed and accepted (2/4 rows)',
    `Imported count: ${parsedBatch.importedCount}`
  );
  assert(
    parsedBatch.errors.some((e) => e.field === 'email'),
    'Test 5D: Malformed email row properly isolated with validation error'
  );
  assert(
    parsedBatch.errors.some((e) => e.field === 'rollNo' && e.message.includes('Duplicate')),
    'Test 5E: Duplicate roll number within CSV batch detected and skipped'
  );

  // ------------------------------------------------------------------------
  // Test 6: Audit History Logging & Category Filtering
  // ------------------------------------------------------------------------
  console.log('\n--- Test 6: Audit History Logging & Filtering ---');

  const scheduleAudits = await getAuditHistory('HST-SUN-01', 'schedule');
  assert(
    scheduleAudits.every((l) => !l.category || l.category === 'schedule'),
    'Test 6A: Audit history filtered by "schedule" category returns only schedule modifications'
  );

  const searchedAudits = await getAuditHistory('HST-SUN-01', undefined, 'Sharma');
  assert(
    searchedAudits.some((l) => l.operator.includes('Sharma')),
    'Test 6B: Search query filters audit entries by operator identity'
  );

  console.log('\n====================================================');
  console.log('Results: All Phase G Tests Passed Successfully!');
  console.log('====================================================\n');
}

runPhaseGTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
