-- ============================================================================
-- FaceGuard Offline - BiometricVault SQLite Schema
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY, 
  value TEXT, 
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY, 
  name TEXT NOT NULL, 
  employee_code TEXT UNIQUE NOT NULL,
  designation TEXT, 
  department TEXT, 
  enrolled_at INTEGER, 
  enrolled_by TEXT,
  device_id TEXT, 
  sync_status TEXT DEFAULT 'LOCAL', 
  last_sync INTEGER
);

CREATE TABLE IF NOT EXISTS face_embeddings (
  id TEXT PRIMARY KEY, 
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  embedding_cipher TEXT NOT NULL, -- AES-256 encrypted JSON of Float32[128]
  iv TEXT NOT NULL, -- Base64 encoded 16-byte IV
  created_at INTEGER, 
  device_id TEXT, 
  embedding_version TEXT DEFAULT 'mobilefacenet_int8_v1'
);

CREATE TABLE IF NOT EXISTS attendance_log (
  id TEXT PRIMARY KEY, 
  employee_id TEXT REFERENCES employees(id),
  action TEXT NOT NULL CHECK(action IN ('CHECK_IN','CHECK_OUT')),
  timestamp INTEGER NOT NULL, 
  gps_lat REAL, 
  gps_lng REAL,
  liveness_passive_score REAL, 
  liveness_active_passed INTEGER,
  recognition_confidence REAL, 
  inference_ms INTEGER,
  spoof_attempt INTEGER DEFAULT 0, 
  sync_status TEXT DEFAULT 'LOCAL',
  synced_at INTEGER, 
  purged_at INTEGER
);

CREATE TABLE IF NOT EXISTS spoof_log (
  id TEXT PRIMARY KEY, 
  timestamp INTEGER, 
  device_id TEXT,
  spoof_type TEXT, 
  passive_score REAL, 
  frame_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_log(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sync ON attendance_log(sync_status);
CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance_log(timestamp);
