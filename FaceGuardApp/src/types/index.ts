/**
 * FaceGuard Offline – Shared Type Definitions
 * =============================================
 *
 * Central type definitions for the entire FaceGuard SDK.
 * All modules import from this file to ensure type consistency.
 */

// ── Configuration ────────────────────────────────────────────────────

export interface FaceGuardConfig {
  /** Unique NHAI site identifier (e.g., 'NH_001') */
  siteCode: string;
  /** AWS DynamoDB connection configuration */
  awsConfig: AWSConfig;
  /** Cosine similarity match threshold (default: 0.65) */
  threshold?: number;
  /** Enforce MiniFASNet liveness check (default: true) */
  livenessRequired?: boolean;
  /** Enable automatic background sync (default: true) */
  autoSync?: boolean;
  /** Background fetch interval in minutes (default: 15) */
  syncIntervalMinutes?: number;
  /** DynamoDB BatchWrite item limit (default: 25) */
  maxBatchSize?: number;
  /** PBKDF2 iteration count (default: 100000) */
  encryptionIterations?: number;
  /** Auto-purge embeddings after confirmed sync (default: true) */
  purgeAfterSync?: boolean;
}

export interface AWSConfig {
  region: string;
  tableName: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

// ── Face Engine Types ────────────────────────────────────────────────

export interface EmployeeEmbedding {
  id: string;
  name: string;
  embedding: number[];
}

export interface MatchResult {
  employee: { id: string; name: string };
  score: number;
}

export interface EyeLandmarks {
  p1: Point2D;
  p2: Point2D;
  p3: Point2D;
  p4: Point2D;
  p5: Point2D;
  p6: Point2D;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface SpoofScores {
  liveScore: number;
  depthScore: number;
  moireScore: number;
}

export type SpoofType = 'live' | 'print_attack' | 'screen_replay' | 'unknown_spoof';

export interface FaceBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  landmarks?: Point2D[];
}

export interface PipelineTimings {
  blazeface_ms: number;
  clahe_ms: number;
  mobilefacenet_ms: number;
  minifasnet_ms: number;
  cosine_match_ms: number;
  total_ms: number;
}

// ── Biometric Vault Types ────────────────────────────────────────────

export interface EncryptedData {
  ciphertext: string;
  iv: string;
}

export interface EmployeeRecord {
  id: string;
  name: string;
  department: string;
  created_at: string;
}

export interface EmbeddingRow {
  id: string;
  employee_id: string;
  ciphertext: string;
  iv: string;
  version: number;
}

export interface DecryptedEmbedding {
  employeeId: string;
  name: string;
  embedding: number[];
}

export interface EnrolData {
  name: string;
  department: string;
  embedding: number[];
}

export interface AttendanceInput {
  employeeId: string;
  timestamp: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  confidence: number;
  livenessScore: number;
}

export interface AttendanceRecord extends AttendanceInput {
  id: string;
  syncStatus: 'LOCAL' | 'SYNCED' | 'PURGED';
}

export interface SyncableRecord {
  id: string;
  employeeId: string;
  timestamp: string;
  type: string;
  confidence: number;
  livenessScore: number;
  syncStatus: string;
}

// ── Sync Types ───────────────────────────────────────────────────────

export interface SyncSummary {
  uploaded: number;
  failed: number;
  remaining: number;
}

// ── SDK Result Types ─────────────────────────────────────────────────

export interface EnrolOptions {
  name: string;
  department: string;
  employeeId?: string;
  captureAngles?: number;
}

export interface EnrolResult {
  success: boolean;
  employee: { id: string; name: string; department: string };
  qualityScore: number;
}

export type RejectionReason = 'no_face' | 'spoof_detected' | 'no_match' | 'below_threshold';

export interface AttendanceResult {
  success: boolean;
  employee: { id: string; name: string; department: string };
  confidence: number;
  livenessScore: number;
  latencyMs: number;
  reason?: RejectionReason;
}

// ── Error Codes ──────────────────────────────────────────────────────

export enum FaceGuardError {
  FG_INIT_FAILED = 'FG_INIT_FAILED',
  FG_NO_FACE = 'FG_NO_FACE',
  FG_SPOOF_DETECTED = 'FG_SPOOF_DETECTED',
  FG_NO_MATCH = 'FG_NO_MATCH',
  FG_BELOW_THRESHOLD = 'FG_BELOW_THRESHOLD',
  FG_CAMERA_DENIED = 'FG_CAMERA_DENIED',
  FG_DB_ERROR = 'FG_DB_ERROR',
  FG_SYNC_FAILED = 'FG_SYNC_FAILED',
  FG_ENCRYPTION_ERROR = 'FG_ENCRYPTION_ERROR',
}

export class FaceGuardException extends Error {
  code: FaceGuardError;

  constructor(code: FaceGuardError, message: string) {
    super(message);
    this.name = 'FaceGuardException';
    this.code = code;
  }
}
