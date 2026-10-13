export type AppScreen =
  | 'login'
  | 'student-dashboard'
  | 'location-setup'
  | 'attendance-history'
  | 'warden-dashboard'
  | 'student-management'
  | 'attendance-monitoring'
  | 'hostel-settings'
  | 'terms-privacy';

export type UserRole = 'student' | 'warden' | 'super_admin';

export interface LegalConsentRecord {
  id: string;
  userId: string;
  userEmail: string;
  hostelId: string;
  version: string; // e.g. "v2.4"
  termsAccepted: boolean;
  biometricAccepted: boolean;
  geofenceAccepted: boolean;
  signatureName: string;
  rollNo: string;
  signatureHash: string;
  ipAddress?: string;
  timestamp: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  hostelId: string; // Primary hostel
  hostelMemberships: string[]; // Multi-hostel access list for wardens/students
  policyConsentVersion: string; // Versioned legal consent e.g. "v2.4"
  consentAcceptedAt?: string;
  phone?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Student {
  id: string;
  studentId: string; // e.g. STU-102
  hostelId?: string; // Multi-hostel residential boundary
  name: string;
  rollNo: string; // e.g. #21CSE084
  semester: string;
  room: string;
  block: string;
  floor: number;
  email: string;
  phone: string;
  status: 'active' | 'inactive';
  device: string;
  browser: string;
  deviceStatus: 'registered' | 'pending' | 'stale';
  fcmToken?: string;
  attendanceStatus: 'IN' | 'OUT' | 'Pending' | 'Late' | 'Exception';
  attendanceTime?: string;
  outTime?: string;
  outPass?: string;
  lastLocationSnapshot?: string;
  locationAccuracy?: string;
  lastUpdated: string;
  guardianPhone: string;
  avatarUrl?: string;
  avatarInitials: string;
  notes?: string;
}

export interface LocationCapture {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  timestamp: string;
  isMocked?: boolean;
  address?: string;
}

export interface AttendanceSession {
  id: string;
  hostelId: string;
  date: string; // YYYY-MM-DD
  windowStart: string; // "22:00"
  cutoffTime: string; // "00:00"
  status: 'scheduled' | 'active' | 'closed';
  totalExpected: number;
  confirmedCount: number;
  declaredOutCount: number;
  pendingCount: number;
  exceptionCount: number;
  createdAt: string;
  closedAt?: string;
}

export interface AttendanceRecord {
  id: string;
  refId: string; // #ATT-2026-1013
  studentId?: string;
  hostelId?: string;
  date: string;
  status: 'Confirmed IN' | 'Declared OUT' | 'Pending / Unconfirmed' | 'Late Check-in' | 'Exception Override';
  confirmationTime?: string;
  capturedAddress?: string;
  accuracy?: string;
  method: string;
  notes?: string;
  checkInAt?: string;
  checkOutAt?: string;
  verifiedBy?: string;
  createdAt?: string;
  location?: LocationCapture;
  isWithinGeofence?: boolean;
  distanceFromHostelMeters?: number;
}

export interface CurfewExtension {
  id: string;
  studentId: string;
  hostelId?: string;
  studentName: string;
  room: string;
  durationMinutes: number;
  reason: string;
  proposedCutoff: string;
  reqTime: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface Hostel {
  id: string;
  name: string;
  jurisdictionCode: string;
  tenancyNode: string;
  capacity: number;
  totalStudents: number;
  activeShift: string;
  curfewStart?: string;
  curfewEnd?: string;
  geofenceLatitude?: number;
  geofenceLongitude?: number;
  geofenceRadiusMeters?: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  operator: string;
  role: string;
  target: string;
  previousValue: string;
  newValue: string;
  reason: string;
  category?: 'schedule' | 'attendance' | 'security' | 'resident' | 'system';
}

// ---------------------------------------------------------
// Phase A & B: Firestore & Shared Response Schemas
// ---------------------------------------------------------

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    timestamp: string;
    requestId: string;
    version: string;
    pagination?: {
      total: number;
      page: number;
      pageSize: number;
      hasMore: boolean;
    };
  };
}

export interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (role: UserRole, email: string) => Promise<void>;
  logout: () => Promise<void>;
}

// ---------------------------------------------------------
// Phase E: FCM Device Registration, Notification Jobs & Scheduler
// ---------------------------------------------------------

export interface DeviceRegistration {
  id: string; // token hash or uuid
  userId: string;
  userEmail: string;
  hostelId: string;
  fcmToken: string;
  deviceModel: string;
  browser: string;
  status: 'active' | 'stale' | 'revoked';
  lastRegisteredAt: string;
  lastActiveAt: string;
}

export type NotificationJobType =
  | 'curfew_window_open'
  | 'curfew_reminder_1'
  | 'curfew_reminder_2'
  | 'curfew_violation_alert'
  | 'extension_status_update';

export interface NotificationJob {
  id: string; // e.g. "job_rem1_HST-SUN-01_2026-10-13"
  idempotencyKey: string;
  jobType: NotificationJobType;
  hostelId: string;
  sessionDate: string;
  targetUserIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped_duplicate';
  retryCount: number;
  maxRetries: number;
  lastAttemptAt?: string;
  errorLog?: string[];
  createdAt: string;
  completedAt?: string;
}

export interface SchedulerInvocationResult {
  success: boolean;
  invocationKey: string;
  isDuplicateSkipped: boolean;
  jobsProcessed: number;
  notificationsDispatched: number;
  failures: number;
  timestamp: string;
  details: string;
}

// ---------------------------------------------------------
// Phase G: Hostel Settings, Attendance Reports & CSV Management
// ---------------------------------------------------------

export interface HostelSettings {
  hostelId: string;
  hostelName: string;
  tenancyNode: string;
  campusZone: string;
  capacity: number;
  totalStudents: number;
  activeShift: string;
  windowOpen: string; // e.g. "22:00"
  reminder1: string;  // e.g. "22:15"
  reminder2: string;  // e.g. "23:00"
  curfewCutoff: string; // e.g. "00:00"
  lateProtocol: 'warden-req' | 'auto-log' | 'strict-lock';
  missingProtocol: 'physical' | 'call-parent' | 'security-dispatch';
  allowExtensions: boolean;
  maxExtensionMins: number; // 15 to 180
  geofenceLatitude: number;
  geofenceLongitude: number;
  geofenceRadiusMeters: number;
  primaryWarden: string;
  securityCheckpost: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface AttendanceReportFilter {
  hostelId?: string;
  datePreset?: 'today' | '7d' | '30d' | 'custom';
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  status?: string;    // 'Confirmed IN' | 'Declared OUT' | 'Late Check-in' | etc.
  room?: string;
  block?: string;
  searchQuery?: string;
}

export interface AttendanceDailyMetric {
  date: string; // YYYY-MM-DD
  formattedDate: string;
  total: number;
  confirmed: number;
  out: number;
  late: number;
  exception: number;
  attendanceRate: number; // percentage
}

export interface AttendanceReportMetrics {
  totalExpected: number;
  totalRecords: number;
  confirmedCount: number;
  declaredOutCount: number;
  lateCount: number;
  exceptionCount: number;
  attendanceRate: number; // percentage e.g. 91.4
  onTimeRate: number;     // percentage e.g. 87.5
  dailyBreakdown: AttendanceDailyMetric[];
}

export interface CsvImportError {
  row: number;
  field: string;
  message: string;
  data: Record<string, string>;
}

export interface CsvImportResult {
  totalRows: number;
  importedCount: number;
  errors: CsvImportError[];
  importedStudents: Student[];
}

