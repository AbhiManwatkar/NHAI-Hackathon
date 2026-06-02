/**
 * @fileoverview FaceGuard Offline - Shared TypeScript Interfaces & Types
 * @description Centralized type definitions for the NHAI FaceGuard Offline
 * facial recognition and liveness detection system. All interfaces support
 * full offline operation with eventual sync capability.
 * @version 1.0.0
 */

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Types
// ─────────────────────────────────────────────────────────────────────────────

/** Root stack navigator parameter list for type-safe navigation */
export type RootStackParamList = {
  Home: undefined;
  MainTabs: undefined;
  AttendanceLog: undefined;
  Admin: undefined;
  Enrolment: { editPersonnelId?: string } | undefined;
  Recognition: undefined;
  SyncStatus: undefined;
};

/** Bottom tab navigator parameter list */
export type MainTabParamList = {
  Home: undefined;
  Recognition: undefined;
  AttendanceLog: undefined;
  Admin: undefined;
};

/** Combined navigation param list for deep linking */
export type NavigationParamList = RootStackParamList & MainTabParamList;

// ─────────────────────────────────────────────────────────────────────────────
// Personnel & Enrollment Types
// ─────────────────────────────────────────────────────────────────────────────

/** Department classifications within NHAI */
export type NHAIDepartment =
  | 'Engineering'
  | 'Operations'
  | 'Administration'
  | 'Finance'
  | 'IT'
  | 'HR'
  | 'Safety'
  | 'Toll Operations'
  | 'Maintenance'
  | 'Project Management'
  | 'Other';

/** Personnel role within the organization */
export type PersonnelRole =
  | 'Field Engineer'
  | 'Site Supervisor'
  | 'Toll Operator'
  | 'Safety Inspector'
  | 'Project Manager'
  | 'Maintenance Worker'
  | 'Admin Staff'
  | 'Contractor'
  | 'Consultant'
  | 'Other';

/** Personnel record representing an enrolled individual */
export interface Personnel {
  /** Unique identifier (UUID v4) */
  id: string;
  /** Full name of the personnel */
  name: string;
  /** NHAI employee ID or contractor badge number */
  employeeId: string;
  /** Department affiliation */
  department: NHAIDepartment;
  /** Organizational role */
  role: PersonnelRole;
  /** Base64-encoded face thumbnail for display */
  photoThumbnail: string;
  /** Whether this personnel record is active */
  isActive: boolean;
  /** ISO 8601 timestamp of enrollment */
  enrolledAt: string;
  /** ISO 8601 timestamp of last update */
  updatedAt: string;
  /** ISO 8601 timestamp of last successful sync to server */
  lastSyncedAt: string | null;
}

/** Face angle captured during enrollment */
export type FaceCaptureAngle = 'front' | 'left' | 'right';

/** Single face capture during enrollment */
export interface FaceCapture {
  /** Capture angle */
  angle: FaceCaptureAngle;
  /** Base64-encoded image data */
  imageData: string;
  /** Face embedding vector (128-d or 512-d float array) */
  embedding: number[];
  /** Quality score of the capture (0-1) */
  qualityScore: number;
  /** ISO 8601 timestamp */
  capturedAt: string;
}

/** Complete enrollment record linking personnel to face data */
export interface Enrollment {
  /** Unique enrollment ID */
  id: string;
  /** Associated personnel ID */
  personnelId: string;
  /** Array of face captures (front, left, right) */
  captures: FaceCapture[];
  /** Average embedding used for matching */
  averageEmbedding: number[];
  /** Whether liveness check was passed */
  livenessVerified: boolean;
  /** Overall enrollment quality score */
  qualityScore: number;
  /** Enrollment status */
  status: 'in_progress' | 'completed' | 'failed' | 'revoked';
  /** ISO 8601 timestamp of enrollment completion */
  completedAt: string | null;
  /** ISO 8601 timestamp of creation */
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Camera & Face Detection Types
// ─────────────────────────────────────────────────────────────────────────────

/** Raw camera frame data */
export interface CameraFrame {
  /** Frame width in pixels */
  width: number;
  /** Frame height in pixels */
  height: number;
  /** Base64-encoded frame data */
  data: string;
  /** Frame timestamp in milliseconds */
  timestamp: number;
  /** Camera orientation */
  orientation: 'portrait' | 'landscape-left' | 'landscape-right' | 'upside-down';
}

/** Bounding box for detected face region */
export interface BoundingBox {
  /** X coordinate of top-left corner (normalized 0-1) */
  x: number;
  /** Y coordinate of top-left corner (normalized 0-1) */
  y: number;
  /** Width of bounding box (normalized 0-1) */
  width: number;
  /** Height of bounding box (normalized 0-1) */
  height: number;
}

/** Facial landmark point */
export interface Landmark {
  /** Landmark identifier */
  type:
    | 'left_eye'
    | 'right_eye'
    | 'nose_tip'
    | 'mouth_left'
    | 'mouth_right'
    | 'left_ear'
    | 'right_ear'
    | 'chin';
  /** X coordinate (normalized 0-1) */
  x: number;
  /** Y coordinate (normalized 0-1) */
  y: number;
  /** Confidence for this landmark detection */
  confidence: number;
}

/** Face detection result from a single frame */
export interface FaceDetectionResult {
  /** Whether a face was detected */
  detected: boolean;
  /** Bounding box of the detected face */
  boundingBox: BoundingBox | null;
  /** Detected facial landmarks */
  landmarks: Landmark[];
  /** Face detection confidence (0-1) */
  confidence: number;
  /** Estimated head pose - yaw in degrees */
  yaw: number;
  /** Estimated head pose - pitch in degrees */
  pitch: number;
  /** Estimated head pose - roll in degrees */
  roll: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Liveness Detection Types
// ─────────────────────────────────────────────────────────────────────────────

/** Liveness challenge types presented to the user */
export enum LivenessChallenge {
  /** User must blink their eyes */
  BLINK = 'BLINK',
  /** User must turn head left */
  TURN_LEFT = 'TURN_LEFT',
  /** User must turn head right */
  TURN_RIGHT = 'TURN_RIGHT',
  /** User must smile */
  SMILE = 'SMILE',
  /** User must nod (up-down head movement) */
  NOD = 'NOD',
  /** Passive texture analysis (no user action needed) */
  PASSIVE_TEXTURE = 'PASSIVE_TEXTURE',
  /** Depth-based liveness (requires depth camera) */
  DEPTH_CHECK = 'DEPTH_CHECK',
}

/** Result of a liveness verification */
export interface LivenessResult {
  /** Whether the subject passed liveness check */
  isLive: boolean;
  /** Liveness confidence score (0-1) */
  score: number;
  /** Challenges that were attempted */
  challengesAttempted: LivenessChallenge[];
  /** Challenges that were successfully completed */
  challengesPassed: LivenessChallenge[];
  /** Reason for failure if applicable */
  failureReason: string | null;
  /** ISO 8601 timestamp of the check */
  checkedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Face Matching Types
// ─────────────────────────────────────────────────────────────────────────────

/** Result of a face recognition/matching operation */
export interface FaceMatchResult {
  /** Whether a match was found above threshold */
  matched: boolean;
  /** Matched personnel (null if no match) */
  personnel: Personnel | null;
  /** Cosine similarity score (0-1, higher = more similar) */
  confidence: number;
  /** Distance metric value */
  distance: number;
  /** Matching threshold used */
  threshold: number;
  /** Time taken for matching in milliseconds */
  processingTimeMs: number;
  /** Total candidates searched */
  candidatesSearched: number;
  /** Liveness result from the recognition attempt */
  livenessResult: LivenessResult | null;
  /** ISO 8601 timestamp */
  matchedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Attendance Types
// ─────────────────────────────────────────────────────────────────────────────

/** Attendance verification method */
export type AttendanceMethod = 'face_recognition' | 'manual_override' | 'admin_bypass';

/** Single attendance record */
export interface AttendanceRecord {
  /** Unique attendance record ID */
  id: string;
  /** Personnel ID who was authenticated */
  personnelId: string;
  /** Personnel name (denormalized for display) */
  personnelName: string;
  /** Base64-encoded face thumbnail captured at attendance time */
  capturedPhoto: string;
  /** Face match confidence score (0-1) */
  confidence: number;
  /** Liveness score at time of attendance (0-1) */
  livenessScore: number;
  /** Method used for attendance verification */
  method: AttendanceMethod;
  /** GPS coordinates if available */
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null;
  /** Device ID where attendance was recorded */
  deviceId: string;
  /** ISO 8601 timestamp of attendance */
  timestamp: string;
  /** Whether record has been synced to server */
  isSynced: boolean;
  /** ISO 8601 timestamp of last sync attempt */
  lastSyncAttempt: string | null;
  /** Number of sync attempts */
  syncAttempts: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync Types
// ─────────────────────────────────────────────────────────────────────────────

/** Sync item types */
export type SyncItemType = 'attendance' | 'enrollment' | 'personnel' | 'log' | 'config';

/** Priority levels for sync queue items */
export type SyncPriority = 'critical' | 'high' | 'normal' | 'low';

/** Current sync operation status */
export type SyncOperationStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

/** Individual item in the sync queue */
export interface SyncQueueItem {
  /** Unique queue item ID */
  id: string;
  /** Type of data being synced */
  type: SyncItemType;
  /** Reference ID of the source record */
  referenceId: string;
  /** Serialized payload data */
  payload: string;
  /** Sync priority */
  priority: SyncPriority;
  /** Current status */
  status: SyncOperationStatus;
  /** Number of retry attempts */
  retryCount: number;
  /** Maximum retry attempts before giving up */
  maxRetries: number;
  /** Error message from last failed attempt */
  lastError: string | null;
  /** ISO 8601 timestamp when item was queued */
  queuedAt: string;
  /** ISO 8601 timestamp of last attempt */
  lastAttemptAt: string | null;
  /** ISO 8601 timestamp of next scheduled retry */
  nextRetryAt: string | null;
}

/** Overall sync status for the application */
export interface SyncStatus {
  /** Whether the device currently has network connectivity */
  isConnected: boolean;
  /** Whether a sync operation is currently in progress */
  isSyncing: boolean;
  /** Number of items waiting to be synced */
  pendingCount: number;
  /** Number of items that failed to sync */
  failedCount: number;
  /** Total items successfully synced in current session */
  completedCount: number;
  /** ISO 8601 timestamp of last successful sync */
  lastSuccessfulSync: string | null;
  /** Current sync progress (0-1) */
  progress: number;
  /** Current sync error message if any */
  currentError: string | null;
  /** Upload speed in bytes per second (0 if not syncing) */
  uploadSpeedBps: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage & Admin Types
// ─────────────────────────────────────────────────────────────────────────────

/** Storage statistics for admin dashboard */
export interface StorageStats {
  /** Total database file size in bytes */
  databaseSizeBytes: number;
  /** Total face embeddings storage in bytes */
  embeddingsSizeBytes: number;
  /** Total photo thumbnails storage in bytes */
  thumbnailsSizeBytes: number;
  /** Total app cache size in bytes */
  cacheSizeBytes: number;
  /** Total enrolled personnel count */
  personnelCount: number;
  /** Total enrollment records */
  enrollmentCount: number;
  /** Total attendance records */
  attendanceCount: number;
  /** Pending sync items count */
  pendingSyncCount: number;
  /** Total error/audit log entries */
  logEntryCount: number;
  /** Available device storage in bytes */
  availableStorageBytes: number;
  /** Last time stats were calculated */
  calculatedAt: string;
}

/** Admin action types for audit logging */
export enum AdminAction {
  /** Force sync all pending items */
  FORCE_SYNC = 'FORCE_SYNC',
  /** Purge stale/old records */
  PURGE_STALE = 'PURGE_STALE',
  /** Re-encrypt the secure vault */
  RE_ENCRYPT_VAULT = 'RE_ENCRYPT_VAULT',
  /** Export application logs */
  EXPORT_LOGS = 'EXPORT_LOGS',
  /** Add new personnel */
  ADD_PERSONNEL = 'ADD_PERSONNEL',
  /** Remove personnel */
  REMOVE_PERSONNEL = 'REMOVE_PERSONNEL',
  /** Update personnel record */
  UPDATE_PERSONNEL = 'UPDATE_PERSONNEL',
  /** Reset admin PIN */
  RESET_PIN = 'RESET_PIN',
  /** Clear application cache */
  CLEAR_CACHE = 'CLEAR_CACHE',
  /** Factory reset the application */
  FACTORY_RESET = 'FACTORY_RESET',
}

/** Admin audit log entry */
export interface AdminAuditLog {
  /** Unique log entry ID */
  id: string;
  /** Action performed */
  action: AdminAction;
  /** Admin user who performed the action */
  performedBy: string;
  /** Additional details about the action */
  details: string;
  /** ISO 8601 timestamp */
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Application Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** Application configuration settings */
export interface AppConfig {
  /** Face matching confidence threshold (0-1) */
  matchThreshold: number;
  /** Liveness detection threshold (0-1) */
  livenessThreshold: number;
  /** Maximum face captures per enrollment */
  maxCapturesPerEnrollment: number;
  /** Auto-sync interval in minutes (0 = disabled) */
  autoSyncIntervalMinutes: number;
  /** Maximum sync retry attempts */
  maxSyncRetries: number;
  /** Data retention period in days */
  dataRetentionDays: number;
  /** Whether to require liveness check for attendance */
  requireLivenessForAttendance: boolean;
  /** Whether to capture GPS location with attendance */
  captureLocationWithAttendance: boolean;
  /** Admin PIN hash (bcrypt) */
  adminPinHash: string;
  /** Device unique identifier */
  deviceId: string;
  /** API endpoint for sync (when online) */
  syncEndpoint: string;
  /** Application version */
  appVersion: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI State Types
// ─────────────────────────────────────────────────────────────────────────────

/** Enrollment step in multi-step flow */
export type EnrollmentStep =
  | 'details'
  | 'capture_front'
  | 'capture_left'
  | 'capture_right'
  | 'liveness'
  | 'confirmation';

/** Dashboard statistics for HomeScreen */
export interface DashboardStats {
  /** Total enrolled personnel */
  totalEnrolled: number;
  /** Today's attendance count */
  todayAttendance: number;
  /** Current sync status */
  syncStatus: SyncStatus;
  /** Last sync timestamp */
  lastSyncTime: string | null;
}

/** Toast notification type */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/** Toast notification data */
export interface ToastData {
  /** Toast type */
  type: ToastType;
  /** Toast message */
  message: string;
  /** Duration in milliseconds */
  duration: number;
}
