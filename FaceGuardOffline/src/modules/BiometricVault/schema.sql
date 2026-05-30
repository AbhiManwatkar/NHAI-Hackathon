-- ============================================================================
-- FaceGuard Offline - BiometricVault SQLite Schema
-- ============================================================================
-- Purpose: Offline-first biometric data storage for NHAI field personnel
--          authentication system.
--
-- Tables:
--   1. personnel       - Personnel identity records
--   2. embeddings       - Encrypted face embedding vectors
--   3. attendance_log   - Attendance/authentication records
--   4. sync_queue       - Offline operation queue for cloud sync
--   5. app_metadata     - Application-level key-value settings
--
-- Security: All face embeddings are stored as AES-256-GCM encrypted BLOBs.
--           No plaintext biometric data is persisted.
--
-- Version: 1.0.0
-- Created: 2026-05-28
-- ============================================================================

-- Enable WAL mode for better concurrent read/write performance
PRAGMA journal_mode = WAL;

-- Enable foreign key enforcement
PRAGMA foreign_keys = ON;

-- Set page size for optimal mobile storage performance
PRAGMA page_size = 4096;

-- ============================================================================
-- Table: personnel
-- ============================================================================
-- Stores identity information for enrolled NHAI field personnel.
-- Each record represents a unique person in the system.
-- ============================================================================
CREATE TABLE IF NOT EXISTS personnel (
    -- Unique identifier (UUID v4)
    id              TEXT PRIMARY KEY NOT NULL,

    -- Personnel full name
    name            TEXT NOT NULL,

    -- NHAI department (e.g., 'Highway Operations', 'Toll Management')
    department      TEXT NOT NULL,

    -- Personnel role (e.g., 'Field Engineer', 'Toll Operator', 'Supervisor')
    role            TEXT NOT NULL,

    -- NHAI employee/contractor ID
    employee_id     TEXT UNIQUE,

    -- Contact phone number (optional)
    phone           TEXT,

    -- Whether this personnel record is active
    is_active       INTEGER NOT NULL DEFAULT 1,

    -- Record creation timestamp (ISO 8601)
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),

    -- Last update timestamp (ISO 8601)
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),

    -- Soft delete timestamp (NULL if not deleted)
    deleted_at      TEXT DEFAULT NULL
);

-- Index for fast lookup by employee ID
CREATE INDEX IF NOT EXISTS idx_personnel_employee_id
    ON personnel(employee_id);

-- Index for filtering active personnel
CREATE INDEX IF NOT EXISTS idx_personnel_active
    ON personnel(is_active) WHERE is_active = 1;

-- Index for department-based queries
CREATE INDEX IF NOT EXISTS idx_personnel_department
    ON personnel(department);

-- ============================================================================
-- Table: embeddings
-- ============================================================================
-- Stores AES-256-GCM encrypted face embedding vectors.
-- Each personnel may have multiple embeddings for robustness.
-- Embeddings are NEVER stored in plaintext.
-- ============================================================================
CREATE TABLE IF NOT EXISTS embeddings (
    -- Unique identifier (UUID v4)
    id                  TEXT PRIMARY KEY NOT NULL,

    -- Foreign key to personnel record
    personnel_id        TEXT NOT NULL,

    -- AES-256-GCM encrypted embedding vector (binary blob)
    -- Contains: encrypted 128-dim Float32Array + IV + auth tag
    encrypted_embedding BLOB NOT NULL,

    -- Initialization vector used for AES-GCM encryption (hex string)
    encryption_iv       TEXT NOT NULL,

    -- AES-GCM authentication tag (hex string)
    auth_tag            TEXT NOT NULL,

    -- Quality score of the source face image [0.0 - 1.0]
    quality_score       REAL NOT NULL CHECK (quality_score >= 0.0 AND quality_score <= 1.0),

    -- SHA-256 hash of the embedding for integrity verification
    embedding_hash      TEXT NOT NULL,

    -- Whether this is the primary/best embedding for the personnel
    is_primary          INTEGER NOT NULL DEFAULT 0,

    -- Record creation timestamp (ISO 8601)
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),

    -- Foreign key constraint
    FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE CASCADE
);

-- Index for fast lookup by personnel
CREATE INDEX IF NOT EXISTS idx_embeddings_personnel_id
    ON embeddings(personnel_id);

-- Index for finding primary embeddings
CREATE INDEX IF NOT EXISTS idx_embeddings_primary
    ON embeddings(is_primary) WHERE is_primary = 1;

-- Index for quality-based filtering
CREATE INDEX IF NOT EXISTS idx_embeddings_quality
    ON embeddings(quality_score DESC);

-- ============================================================================
-- Table: attendance_log
-- ============================================================================
-- Records authentication/attendance events.
-- Each record represents a face recognition check-in event.
-- ============================================================================
CREATE TABLE IF NOT EXISTS attendance_log (
    -- Unique identifier (UUID v4)
    id              TEXT PRIMARY KEY NOT NULL,

    -- Foreign key to the authenticated personnel (NULL if unrecognized)
    personnel_id    TEXT,

    -- Timestamp of the attendance event (ISO 8601)
    timestamp       TEXT NOT NULL DEFAULT (datetime('now')),

    -- GPS location as JSON string: {"latitude": float, "longitude": float, "accuracy": float}
    location        TEXT,

    -- NHAI site/toll plaza identifier
    site_id         TEXT,

    -- Face recognition confidence score [0.0 - 1.0]
    confidence      REAL NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),

    -- Liveness detection score [0.0 - 1.0]
    liveness_score  REAL NOT NULL CHECK (liveness_score >= 0.0 AND liveness_score <= 1.0),

    -- Whether active liveness challenge was passed
    active_liveness_passed INTEGER NOT NULL DEFAULT 0,

    -- Type of liveness challenge used (NULL if passive only)
    liveness_challenge_type TEXT,

    -- Authentication result: 'AUTHENTICATED', 'REJECTED', 'UNKNOWN'
    auth_result     TEXT NOT NULL DEFAULT 'UNKNOWN',

    -- Whether this record has been synced to cloud
    synced          INTEGER NOT NULL DEFAULT 0,

    -- Cloud sync timestamp (NULL if not yet synced)
    synced_at       TEXT DEFAULT NULL,

    -- Device identifier that recorded this attendance
    device_id       TEXT,

    -- Foreign key constraint (allow NULL for unrecognized faces)
    FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE SET NULL
);

-- Index for syncing unsynced records (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_attendance_synced
    ON attendance_log(synced) WHERE synced = 0;

-- Index for personnel attendance history
CREATE INDEX IF NOT EXISTS idx_attendance_personnel
    ON attendance_log(personnel_id, timestamp DESC);

-- Index for date-range queries
CREATE INDEX IF NOT EXISTS idx_attendance_timestamp
    ON attendance_log(timestamp DESC);

-- Index for site-based reporting
CREATE INDEX IF NOT EXISTS idx_attendance_site
    ON attendance_log(site_id, timestamp DESC);

-- ============================================================================
-- Table: sync_queue
-- ============================================================================
-- Queue for tracking offline operations that need cloud synchronization.
-- Operations are processed in priority order when connectivity is available.
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_queue (
    -- Unique identifier (UUID v4)
    id              TEXT PRIMARY KEY NOT NULL,

    -- Name of the source table ('personnel', 'embeddings', 'attendance_log')
    table_name      TEXT NOT NULL CHECK (
        table_name IN ('personnel', 'embeddings', 'attendance_log')
    ),

    -- ID of the record in the source table
    record_id       TEXT NOT NULL,

    -- Type of operation: 'INSERT', 'UPDATE', 'DELETE'
    operation       TEXT NOT NULL CHECK (
        operation IN ('INSERT', 'UPDATE', 'DELETE')
    ),

    -- Priority level (lower number = higher priority)
    -- 1 = attendance (critical), 2 = embeddings, 3 = personnel, 4 = logs
    priority        INTEGER NOT NULL DEFAULT 3,

    -- JSON payload containing the data to sync (for offline resilience)
    payload         TEXT,

    -- Number of sync attempts made
    retry_count     INTEGER NOT NULL DEFAULT 0,

    -- Maximum retry attempts before marking as failed
    max_retries     INTEGER NOT NULL DEFAULT 5,

    -- Last error message from sync attempt
    last_error      TEXT,

    -- Operation creation timestamp (ISO 8601)
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),

    -- Timestamp of last sync attempt (ISO 8601)
    last_attempt_at TEXT DEFAULT NULL,

    -- Timestamp when successfully synced (ISO 8601)
    synced_at       TEXT DEFAULT NULL,

    -- Status: 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'
    status          TEXT NOT NULL DEFAULT 'PENDING' CHECK (
        status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED')
    )
);

-- Index for fetching pending operations in priority order
CREATE INDEX IF NOT EXISTS idx_sync_queue_pending
    ON sync_queue(status, priority, created_at)
    WHERE status = 'PENDING';

-- Index for cleanup of completed sync operations
CREATE INDEX IF NOT EXISTS idx_sync_queue_completed
    ON sync_queue(status, synced_at)
    WHERE status = 'COMPLETED';

-- Index for finding operations for a specific record
CREATE INDEX IF NOT EXISTS idx_sync_queue_record
    ON sync_queue(table_name, record_id);

-- ============================================================================
-- Table: app_metadata
-- ============================================================================
-- Key-value store for application settings, sync state, and metadata.
-- ============================================================================
CREATE TABLE IF NOT EXISTS app_metadata (
    -- Setting key
    key             TEXT PRIMARY KEY NOT NULL,

    -- Setting value (stored as text, parse as needed)
    value           TEXT NOT NULL,

    -- Last update timestamp
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- Default metadata entries
-- ============================================================================
INSERT OR IGNORE INTO app_metadata (key, value) VALUES
    ('schema_version', '1.0.0'),
    ('last_sync_timestamp', ''),
    ('device_id', ''),
    ('max_offline_days', '30'),
    ('max_embeddings_per_person', '5'),
    ('auto_purge_enabled', 'true');

-- ============================================================================
-- Triggers
-- ============================================================================

-- Auto-update the updated_at timestamp on personnel changes
CREATE TRIGGER IF NOT EXISTS trg_personnel_updated_at
AFTER UPDATE ON personnel
FOR EACH ROW
BEGIN
    UPDATE personnel SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Auto-enqueue sync operations when attendance is logged
CREATE TRIGGER IF NOT EXISTS trg_attendance_sync_queue
AFTER INSERT ON attendance_log
FOR EACH ROW
BEGIN
    INSERT INTO sync_queue (id, table_name, record_id, operation, priority, created_at)
    VALUES (
        lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
              substr(hex(randomblob(2)),2) || '-' ||
              substr('89ab', abs(random()) % 4 + 1, 1) ||
              substr(hex(randomblob(2)),2) || '-' ||
              hex(randomblob(6))),
        'attendance_log',
        NEW.id,
        'INSERT',
        1,  -- Highest priority
        datetime('now')
    );
END;

-- Auto-enqueue sync operations when embeddings are added
CREATE TRIGGER IF NOT EXISTS trg_embeddings_sync_queue
AFTER INSERT ON embeddings
FOR EACH ROW
BEGIN
    INSERT INTO sync_queue (id, table_name, record_id, operation, priority, created_at)
    VALUES (
        lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
              substr(hex(randomblob(2)),2) || '-' ||
              substr('89ab', abs(random()) % 4 + 1, 1) ||
              substr(hex(randomblob(2)),2) || '-' ||
              hex(randomblob(6))),
        'embeddings',
        NEW.id,
        'INSERT',
        2,
        datetime('now')
    );
END;
