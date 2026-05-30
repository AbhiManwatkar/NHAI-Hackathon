/**
 * @fileoverview SQLite database manager for offline biometric vault storage.
 * Manages connections, schema initialization, and CRUD operations for personnel,
 * attendance records, and sync queues. Employs AES-256-GCM memory decryption.
 *
 * @module BiometricVault/VaultManager
 * @version 1.0.0
 */

import SQLite from 'react-native-sqlite-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { VaultCrypto, EncryptedData } from './crypto';
import {
  Personnel,
  AttendanceRecord,
  SyncQueueItem,
  NHAIDepartment,
  PersonnelRole,
} from '../../types';
import { Logger } from '../../utils/logger';

const TAG = 'VaultManager';

// Enable promise support for cleaner async/await database code
SQLite.enablePromise(true);

/**
 * Interface representing a raw SQL row for personnel.
 */
interface SqlPersonnelRow {
  id: string;
  name: string;
  department: string;
  role: string;
  employee_id: string;
  phone: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  last_synced_at?: string | null;
}

/**
 * Interface representing a raw SQL row for face embeddings.
 */
interface SqlEmbeddingRow {
  id: string;
  personnel_id: string;
  encrypted_embedding: string;
  encryption_iv: string;
  auth_tag: string;
  quality_score: number;
  embedding_hash: string;
  is_primary: number;
  created_at: string;
}

/**
 * Singleton database manager for FaceGuard Offline.
 */
export class VaultManager {
  private static instance: VaultManager | null = null;
  private db: SQLite.SQLiteDatabase | null = null;
  private crypto: VaultCrypto;
  private isInitialized: boolean = false;

  private constructor() {
    this.crypto = new VaultCrypto();
  }

  /**
   * Retrieves the singleton instance of VaultManager.
   */
  static getInstance(): VaultManager {
    if (!VaultManager.instance) {
      VaultManager.instance = new VaultManager();
    }
    return VaultManager.instance;
  }

  /**
   * Initializes the vault database and encryption keys.
   *
   * @param deviceSeed - Hardware unique seed for key derivation.
   */
  async initialize(deviceSeed: string): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      Logger.info(TAG, 'Initializing database vault...');

      // 1. Initialize cryptographic keys
      await this.crypto.initialize(deviceSeed);

      // 2. Open SQLite database
      this.db = await SQLite.openDatabase({
        name: 'faceguard.db',
        location: 'default',
      });

      // 3. Create tables (equivalent to schema.sql)
      await this.db.transaction((tx) => {
        // Create Personnel Table
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS personnel (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            department TEXT NOT NULL,
            role TEXT NOT NULL,
            employee_id TEXT UNIQUE,
            phone TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            deleted_at TEXT DEFAULT NULL
          );
        `);

        // Create Embeddings Table
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS embeddings (
            id TEXT PRIMARY KEY NOT NULL,
            personnel_id TEXT NOT NULL,
            encrypted_embedding BLOB NOT NULL,
            encryption_iv TEXT NOT NULL,
            auth_tag TEXT NOT NULL,
            quality_score REAL NOT NULL,
            embedding_hash TEXT NOT NULL,
            is_primary INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE CASCADE
          );
        `);

        // Create Attendance Log Table
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS attendance_log (
            id TEXT PRIMARY KEY NOT NULL,
            personnel_id TEXT,
            timestamp TEXT NOT NULL DEFAULT (datetime('now')),
            location TEXT,
            site_id TEXT,
            confidence REAL NOT NULL,
            liveness_score REAL NOT NULL,
            active_liveness_passed INTEGER NOT NULL DEFAULT 0,
            liveness_challenge_type TEXT,
            auth_result TEXT NOT NULL DEFAULT 'UNKNOWN',
            synced INTEGER NOT NULL DEFAULT 0,
            synced_at TEXT DEFAULT NULL,
            device_id TEXT,
            FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE SET NULL
          );
        `);

        // Create Sync Queue Table
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS sync_queue (
            id TEXT PRIMARY KEY NOT NULL,
            table_name TEXT NOT NULL,
            record_id TEXT NOT NULL,
            operation TEXT NOT NULL,
            priority INTEGER NOT NULL DEFAULT 3,
            payload TEXT,
            retry_count INTEGER NOT NULL DEFAULT 0,
            max_retries INTEGER NOT NULL DEFAULT 5,
            last_error TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            last_attempt_at TEXT DEFAULT NULL,
            synced_at TEXT DEFAULT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING'
          );
        `);

        // Create App Metadata Table
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS app_metadata (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          );
        `);

        // Create indexes
        tx.executeSql(
          'CREATE INDEX IF NOT EXISTS idx_personnel_employee_id ON personnel(employee_id);',
        );
        tx.executeSql(
          'CREATE INDEX IF NOT EXISTS idx_embeddings_personnel_id ON embeddings(personnel_id);',
        );
        tx.executeSql(
          'CREATE INDEX IF NOT EXISTS idx_attendance_synced ON attendance_log(synced) WHERE synced = 0;',
        );
        tx.executeSql(
          'CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON sync_queue(status, priority, created_at) WHERE status = "PENDING";',
        );
      });

      this.isInitialized = true;
      Logger.info(TAG, 'Database vault initialized successfully with schema version 1.0.0');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown database error';
      Logger.error(TAG, `Database initialization failed: ${errMsg}`);
      throw error;
    }
  }

  /**
   * Enrolls a new personnel along with their initial face embedding.
   *
   * @param details - Core personnel registration details.
   * @param embedding - 128-dimensional face embedding.
   * @param quality - Embedding quality score.
   */
  async enrollPersonnel(
    details: {
      name: string;
      employeeId: string;
      department: NHAIDepartment;
      role: PersonnelRole;
      phone?: string;
    },
    embedding: number[],
    quality: number,
  ): Promise<Personnel> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const personnelId = uuidv4();
    const now = new Date().toISOString();

    try {
      // 1. Encrypt embedding vector
      const embeddingStr = JSON.stringify(embedding);
      const encrypted = await this.crypto.encrypt(embeddingStr);
      const hash = await this.crypto.hashEmbedding(embedding);

      // 2. Perform Transaction
      await this.db.transaction((tx) => {
        // Insert Personnel
        tx.executeSql(
          `INSERT INTO personnel (id, name, employee_id, department, role, phone, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [
            personnelId,
            details.name,
            details.employeeId,
            details.department,
            details.role,
            details.phone || null,
            now,
            now,
          ],
        );

        // Insert Embedding
        const embeddingId = uuidv4();
        tx.executeSql(
          `INSERT INTO embeddings (id, personnel_id, encrypted_embedding, encryption_iv, auth_tag, quality_score, embedding_hash, is_primary, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [
            embeddingId,
            personnelId,
            encrypted.ciphertext,
            encrypted.iv,
            encrypted.tag,
            quality,
            hash,
            now,
          ],
        );

        // Push personnel insert to Sync Queue
        const syncId1 = uuidv4();
        const payload1 = JSON.stringify({
          id: personnelId,
          name: details.name,
          employee_id: details.employeeId,
          department: details.department,
          role: details.role,
          phone: details.phone || null,
          created_at: now,
        });
        tx.executeSql(
          `INSERT INTO sync_queue (id, table_name, record_id, operation, priority, payload, status)
           VALUES (?, 'personnel', ?, 'INSERT', 3, ?, 'PENDING')`,
          [syncId1, personnelId, payload1],
        );

        // Push embedding insert to Sync Queue
        const syncId2 = uuidv4();
        const payload2 = JSON.stringify({
          id: embeddingId,
          personnel_id: personnelId,
          encrypted_embedding: encrypted.ciphertext,
          encryption_iv: encrypted.iv,
          auth_tag: encrypted.tag,
          quality_score: quality,
          created_at: now,
        });
        tx.executeSql(
          `INSERT INTO sync_queue (id, table_name, record_id, operation, priority, payload, status)
           VALUES (?, 'embeddings', ?, 'INSERT', 2, ?, 'PENDING')`,
          [syncId2, embeddingId, payload2],
        );
      });

      Logger.info(
        TAG,
        `Successfully enrolled NHAI personnel: ${details.name} (ID: ${details.employeeId})`,
      );

      return {
        id: personnelId,
        name: details.name,
        employeeId: details.employeeId,
        department: details.department,
        role: details.role,
        photoThumbnail: '', // Optional Base64 thumb placeholder
        isActive: true,
        enrolledAt: now,
        updatedAt: now,
        lastSyncedAt: null,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown enrolment error';
      Logger.error(TAG, `Failed to enroll personnel: ${errMsg}`);
      throw error;
    }
  }

  /**
   * Records a face recognition attendance check-in.
   */
  async recordAttendance(
    personnelId: string | null,
    personnelName: string,
    confidence: number,
    livenessScore: number,
    method: 'face_recognition' | 'manual_override',
    location: { latitude: number; longitude: number; accuracy: number } | null,
    deviceId: string,
  ): Promise<AttendanceRecord> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const attendanceId = uuidv4();
    const now = new Date().toISOString();
    const locationJson = location ? JSON.stringify(location) : null;
    const authResult = personnelId ? 'AUTHENTICATED' : 'REJECTED';

    try {
      await this.db.transaction((tx) => {
        tx.executeSql(
          `INSERT INTO attendance_log (id, personnel_id, timestamp, location, confidence, liveness_score, auth_result, synced, device_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
          [
            attendanceId,
            personnelId,
            now,
            locationJson,
            confidence,
            livenessScore,
            authResult,
            deviceId,
          ],
        );

        // Queue sync item
        const syncId = uuidv4();
        const payload = JSON.stringify({
          id: attendanceId,
          personnel_id: personnelId,
          timestamp: now,
          location,
          confidence,
          liveness_score: livenessScore,
          auth_result: authResult,
          device_id: deviceId,
        });

        tx.executeSql(
          `INSERT INTO sync_queue (id, table_name, record_id, operation, priority, payload, status)
           VALUES (?, 'attendance_log', ?, 'INSERT', 1, ?, 'PENDING')`,
          [syncId, attendanceId, payload],
        );
      });

      Logger.info(TAG, `Attendance logged for: ${personnelName} (Status: ${authResult})`);

      return {
        id: attendanceId,
        personnelId: personnelId || '',
        personnelName: personnelName,
        capturedPhoto: '',
        confidence,
        livenessScore,
        method,
        location,
        deviceId,
        timestamp: now,
        isSynced: false,
        lastSyncAttempt: null,
        syncAttempts: 0,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown log error';
      Logger.error(TAG, `Failed to record attendance: ${errMsg}`);
      throw error;
    }
  }

  /**
   * Retrieves all active face embeddings from the local DB, decrypts them in RAM,
   * and performs a Cosine Similarity match against the input embedding vector.
   *
   * @param searchEmbedding - Probe embedding vector.
   * @param threshold - Minimum cosine similarity required.
   * @returns The matched personnel identity or null.
   */
  async searchByEmbedding(
    searchEmbedding: number[],
    threshold: number,
  ): Promise<{ personnel: Personnel; similarity: number } | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // 1. Fetch all embeddings and their parent personnel
      const results = await this.db.executeSql(`
        SELECT e.personnel_id, e.encrypted_embedding, e.encryption_iv, e.auth_tag,
               p.name, p.employee_id, p.department, p.role, p.is_active, p.created_at, p.updated_at
        FROM embeddings e
        INNER JOIN personnel p ON e.personnel_id = p.id
        WHERE p.is_active = 1
      `);

      const rows = results[0].rows;
      let bestMatch: { personnel: Personnel; similarity: number } | null = null;
      let maxSimilarity = -1;

      for (let i = 0; i < rows.length; i++) {
        const row = rows.item(i);

        // 2. Decrypt embedding in memory
        const encryptedEnvelope: EncryptedData = {
          ciphertext: row.encrypted_embedding,
          iv: row.encryption_iv,
          tag: row.auth_tag,
        };

        try {
          const decryptedStr = await this.crypto.decrypt(encryptedEnvelope);
          const candidateEmbedding: number[] = JSON.parse(decryptedStr);

          // 3. Compute cosine similarity
          const sim = this.computeCosineSimilarity(searchEmbedding, candidateEmbedding);

          if (sim > maxSimilarity && sim >= threshold) {
            maxSimilarity = sim;
            bestMatch = {
              personnel: {
                id: row.personnel_id,
                name: row.name,
                employeeId: row.employee_id,
                department: row.department as NHAIDepartment,
                role: row.role as PersonnelRole,
                photoThumbnail: '',
                isActive: row.is_active === 1,
                enrolledAt: row.created_at,
                updatedAt: row.updated_at,
                lastSyncedAt: null,
              },
              similarity: sim,
            };
          }
        } catch (decryptionError) {
          Logger.warn(
            TAG,
            `Skipping embedding for personnel ID ${row.personnel_id} due to decryption failure.`,
          );
        }
      }

      return bestMatch;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Search failed';
      Logger.error(TAG, `Biometric search error: ${errMsg}`);
      throw error;
    }
  }

  /**
   * Retrieves pending items from the Sync Queue.
   */
  async getUnsynced(): Promise<SyncQueueItem[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const results = await this.db.executeSql(`
        SELECT id, table_name as type, record_id as referenceId, payload, priority, status, retry_count as retryCount
        FROM sync_queue
        WHERE status = 'PENDING'
        ORDER BY priority ASC, created_at ASC
      `);

      const rows = results[0].rows;
      const items: SyncQueueItem[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows.item(i);
        items.push({
          id: row.id,
          type: row.type,
          referenceId: row.referenceId,
          payload: row.payload,
          priority: row.priority === 1 ? 'critical' : row.priority === 2 ? 'high' : 'normal',
          status: 'pending',
          retryCount: row.retryCount,
          maxRetries: 5,
          lastError: null,
          queuedAt: new Date().toISOString(),
          lastAttemptAt: null,
          nextRetryAt: null,
        });
      }

      return items;
    } catch (error) {
      Logger.error(TAG, `Failed to retrieve sync queue: ${error}`);
      return [];
    }
  }

  /**
   * Marks sync queue items as completed and updates target tables.
   */
  async markSynced(queueIds: string[]): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    if (queueIds.length === 0) {
      return;
    }

    const now = new Date().toISOString();
    const placeholders = queueIds.map(() => '?').join(',');

    try {
      await this.db.transaction((tx) => {
        // Update sync queue items to COMPLETED
        tx.executeSql(
          `UPDATE sync_queue
           SET status = 'COMPLETED', synced_at = ?
           WHERE id IN (${placeholders})`,
          [now, ...queueIds],
        );

        // Update target records
        // For attendance log, update synced = 1
        tx.executeSql(
          `UPDATE attendance_log
           SET synced = 1, synced_at = ?
           WHERE id IN (
             SELECT record_id FROM sync_queue WHERE id IN (${placeholders}) AND table_name = 'attendance_log'
           )`,
          [now, ...queueIds],
        );
      });

      Logger.info(TAG, `Successfully synced ${queueIds.length} batch items.`);
    } catch (error) {
      Logger.error(TAG, `Failed to mark sync queue: ${error}`);
    }
  }

  /**
   * Returns total statistics about the vault database size and records.
   */
  async getStats(): Promise<{
    personnelCount: number;
    attendanceCount: number;
    pendingSyncCount: number;
  }> {
    if (!this.db) {
      return { personnelCount: 0, attendanceCount: 0, pendingSyncCount: 0 };
    }

    try {
      const pResult = await this.db.executeSql(
        'SELECT COUNT(*) as count FROM personnel WHERE deleted_at IS NULL',
      );
      const aResult = await this.db.executeSql('SELECT COUNT(*) as count FROM attendance_log');
      const sResult = await this.db.executeSql(
        'SELECT COUNT(*) as count FROM sync_queue WHERE status = "PENDING"',
      );

      return {
        personnelCount: pResult[0].rows.item(0).count,
        attendanceCount: aResult[0].rows.item(0).count,
        pendingSyncCount: sResult[0].rows.item(0).count,
      };
    } catch (error) {
      Logger.error(TAG, `Failed to retrieve vault statistics: ${error}`);
      return { personnelCount: 0, attendanceCount: 0, pendingSyncCount: 0 };
    }
  }

  /**
   * Computes cosine similarity between two vectors.
   */
  private computeCosineSimilarity(vec1: number[], vec2: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    const len = Math.min(vec1.length, vec2.length);
    for (let i = 0; i < len; i++) {
      dotProduct += vec1[i] * vec2[i];
      normA += vec1[i] * vec1[i];
      normB += vec2[i] * vec2[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator < 1e-10 ? 0 : dotProduct / denominator;
  }
}
export default VaultManager;
