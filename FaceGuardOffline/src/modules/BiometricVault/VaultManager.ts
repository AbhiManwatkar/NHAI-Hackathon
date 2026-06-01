/**
 * @fileoverview SQLite database manager for offline biometric vault storage.
 * Manages schema creation, CRUD operations, embedding encryption/decryption,
 * and memory caching of face embeddings.
 * 
 * @module BiometricVault/VaultManager
 * @version 1.0.0
 */

import SQLite from 'react-native-sqlite-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { DeviceCrypto } from './crypto';
import { averageEmbeddings } from '../FaceEngine/EmbeddingMatcher';

SQLite.enablePromise(true);

export interface EnrolmentData {
  id?: string;
  name: string;
  employee_code: string;
  designation?: string;
  department?: string;
  enrolled_by?: string;
  device_id?: string;
}

export interface Employee {
  id: string;
  name: string;
  employee_code: string;
  designation?: string | null;
  department?: string | null;
  enrolled_at: number;
  enrolled_by?: string | null;
  device_id?: string | null;
  sync_status: string;
  last_sync?: number | null;
}

export interface EmployeeEmbedding {
  employeeId: string;
  embedding: number[];
}

export interface AttendanceEntry {
  id?: string;
  employee_id: string | null;
  action: 'CHECK_IN' | 'CHECK_OUT';
  timestamp: number;
  gps_lat?: number | null;
  gps_lng?: number | null;
  liveness_passive_score: number;
  liveness_active_passed: number;
  recognition_confidence: number;
  inference_ms: number;
  spoof_attempt?: number;
  sync_status?: string;
  synced_at?: number | null;
  purged_at?: number | null;
}

export interface AttendanceLog extends AttendanceEntry {
  id: string;
}

export interface SpoofLog {
  id: string;
  timestamp: number;
  device_id: string | null;
  spoof_type: string | null;
  passive_score: number;
  frame_hash: string;
}

export class VaultManager {
  private static instance: VaultManager | null = null;
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitialized = false;
  private embeddingCache = new Map<string, number[]>();

  private constructor() {}

  static getInstance(): VaultManager {
    if (!VaultManager.instance) {
      VaultManager.instance = new VaultManager();
    }
    return VaultManager.instance;
  }

  /**
   * Initializes the database connection and schema.
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // 1. Derivation check for device encryption key
      const key = await DeviceCrypto.getDeviceKey();
      if (!key) {
        throw new Error('Device key is not derivable');
      }

      // 2. Open SQLite Database
      this.db = await SQLite.openDatabase({
        name: 'faceguard_vault.db',
        location: 'default',
      });

      // 3. Create tables (Schema definition matching schema.sql)
      await this.db.transaction((tx) => {
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS app_config (
            key TEXT PRIMARY KEY, 
            value TEXT, 
            updated_at INTEGER
          );
        `);

        tx.executeSql(`
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
        `);

        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS face_embeddings (
            id TEXT PRIMARY KEY, 
            employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            embedding_cipher TEXT NOT NULL,
            iv TEXT NOT NULL,
            created_at INTEGER, 
            device_id TEXT, 
            embedding_version TEXT DEFAULT 'mobilefacenet_int8_v1'
          );
        `);

        tx.executeSql(`
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
        `);

        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS spoof_log (
            id TEXT PRIMARY KEY, 
            timestamp INTEGER, 
            device_id TEXT,
            spoof_type TEXT, 
            passive_score REAL, 
            frame_hash TEXT
          );
        `);

        // Indices
        tx.executeSql('CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_log(employee_id);');
        tx.executeSql('CREATE INDEX IF NOT EXISTS idx_attendance_sync ON attendance_log(sync_status);');
        tx.executeSql('CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance_log(timestamp);');
      });

      this.isInitialized = true;
      console.log(`[VaultManager] Vault initialised on device.`);
      
      // Load cache into memory on launch
      await this.refreshEmbeddingCache();

    } catch (error) {
      console.error('[VaultManager] Failed to initialize SQLite biometric vault:', error);
      throw error;
    }
  }

  /**
   * Enroll a new employee.
   */
  async enrollEmployee(data: EnrolmentData, embeddings: number[][]): Promise<Employee> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    if (embeddings.length < 3) {
      throw new Error('Enrollment requires at least 3 face captures');
    }

    const employeeId = data.id || uuidv4();
    const now = Date.now();

    // 1. Average 3+ captures
    const avgEmbedding = averageEmbeddings(embeddings);
    
    // 2. Encrypt the averaged embedding
    const encrypted = await DeviceCrypto.encryptEmbedding(avgEmbedding);

    const employee: Employee = {
      id: employeeId,
      name: data.name,
      employee_code: data.employee_code,
      designation: data.designation || null,
      department: data.department || null,
      enrolled_at: now,
      enrolled_by: data.enrolled_by || null,
      device_id: data.device_id || null,
      sync_status: 'LOCAL',
      last_sync: null,
    };

    try {
      await this.db.transaction((tx) => {
        tx.executeSql(
          `INSERT INTO employees (id, name, employee_code, designation, department, enrolled_at, enrolled_by, device_id, sync_status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            employee.id,
            employee.name,
            employee.employee_code,
            employee.designation,
            employee.department,
            employee.enrolled_at,
            employee.enrolled_by,
            employee.device_id,
            employee.sync_status,
          ]
        );

        tx.executeSql(
          `INSERT INTO face_embeddings (id, employee_id, embedding_cipher, iv, created_at, device_id) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            employee.id,
            encrypted.cipher,
            encrypted.iv,
            now,
            employee.device_id,
          ]
        );
      });

      // Update in-memory cache
      this.embeddingCache.set(employee.id, avgEmbedding);
      return employee;
    } catch (error) {
      console.error('[VaultManager] Failed to enroll employee:', error);
      throw error;
    }
  }

  /**
   * Retrieve all enrolled employees.
   */
  async getAllEmployees(): Promise<Employee[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const results = await this.db.executeSql('SELECT * FROM employees');
      const employees: Employee[] = [];
      const rows = results[0].rows;
      for (let i = 0; i < rows.length; i++) {
        const item = rows.item(i);
        employees.push({
          id: item.id,
          name: item.name,
          employee_code: item.employee_code,
          designation: item.designation,
          department: item.department,
          enrolled_at: item.enrolled_at,
          enrolled_by: item.enrolled_by,
          device_id: item.device_id,
          sync_status: item.sync_status,
          last_sync: item.last_sync,
        });
      }
      return employees;
    } catch (error) {
      console.error('[VaultManager] Failed to get all employees:', error);
      return [];
    }
  }

  /**
   * Delete an employee record and cascade delete associated embeddings.
   */
  async deleteEmployee(id: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      await this.db.transaction((tx) => {
        tx.executeSql('DELETE FROM employees WHERE id = ?', [id]);
      });
      this.embeddingCache.delete(id);
    } catch (error) {
      console.error(`[VaultManager] Failed to delete employee ${id}:`, error);
      throw error;
    }
  }

  /**
   * Returns the count of enrolled employees.
   */
  async getEmployeeCount(): Promise<number> {
    if (!this.db) {
      return 0;
    }

    try {
      const results = await this.db.executeSql('SELECT COUNT(*) as count FROM employees');
      return results[0].rows.item(0).count;
    } catch (error) {
      console.error('[VaultManager] Failed to get employee count:', error);
      return 0;
    }
  }

  /**
   * Decrypts all embeddings from the database and returns them.
   */
  async loadAllEmbeddings(): Promise<EmployeeEmbedding[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const results = await this.db.executeSql('SELECT employee_id, embedding_cipher, iv FROM face_embeddings');
      const list: EmployeeEmbedding[] = [];
      const rows = results[0].rows;

      for (let i = 0; i < rows.length; i++) {
        const item = rows.item(i);
        try {
          const decrypted = await DeviceCrypto.decryptEmbedding(item.embedding_cipher, item.iv);
          list.push({
            employeeId: item.employee_id,
            embedding: decrypted,
          });
        } catch (decryptionError) {
          console.warn(`[VaultManager] Decryption failed for employee: ${item.employee_id}`);
        }
      }

      return list;
    } catch (error) {
      console.error('[VaultManager] Failed to load all embeddings:', error);
      return [];
    }
  }

  /**
   * Refreshes the in-memory embedding cache.
   */
  async refreshEmbeddingCache(): Promise<void> {
    const list = await this.loadAllEmbeddings();
    this.embeddingCache.clear();
    for (const item of list) {
      this.embeddingCache.set(item.employeeId, item.embedding);
    }
    console.log(`[VaultManager] Embedding cache refreshed. Loaded ${this.embeddingCache.size} embeddings.`);
  }

  /**
   * Log attendance check-in or check-out.
   */
  async logAttendance(log: AttendanceEntry): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const id = log.id || uuidv4();
    try {
      await this.db.transaction((tx) => {
        tx.executeSql(
          `INSERT INTO attendance_log (
            id, employee_id, action, timestamp, gps_lat, gps_lng, 
            liveness_passive_score, liveness_active_passed, recognition_confidence, 
            inference_ms, spoof_attempt, sync_status, synced_at, purged_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            log.employee_id,
            log.action,
            log.timestamp,
            log.gps_lat || null,
            log.gps_lng || null,
            log.liveness_passive_score,
            log.liveness_active_passed,
            log.recognition_confidence,
            log.inference_ms,
            log.spoof_attempt || 0,
            log.sync_status || 'LOCAL',
            log.synced_at || null,
            log.purged_at || null,
          ]
        );

        if (log.employee_id) {
          tx.executeSql(
            'UPDATE employees SET last_sync = ? WHERE id = ?',
            [log.timestamp, log.employee_id]
          );
        }
      });
    } catch (error) {
      console.error('[VaultManager] Failed to log attendance:', error);
      throw error;
    }
  }

  /**
   * Get all attendance logged today.
   */
  async getTodayAttendance(): Promise<AttendanceLog[]> {
    if (!this.db) {
      return [];
    }

    const startOfToday = new Date().setHours(0, 0, 0, 0);

    try {
      const results = await this.db.executeSql(
        'SELECT * FROM attendance_log WHERE timestamp >= ? ORDER BY timestamp DESC',
        [startOfToday]
      );
      const list: AttendanceLog[] = [];
      const rows = results[0].rows;
      for (let i = 0; i < rows.length; i++) {
        const item = rows.item(i);
        list.push({
          id: item.id,
          employee_id: item.employee_id,
          action: item.action,
          timestamp: item.timestamp,
          gps_lat: item.gps_lat,
          gps_lng: item.gps_lng,
          liveness_passive_score: item.liveness_passive_score,
          liveness_active_passed: item.liveness_active_passed,
          recognition_confidence: item.recognition_confidence,
          inference_ms: item.inference_ms,
          spoof_attempt: item.spoof_attempt,
          sync_status: item.sync_status,
          synced_at: item.synced_at,
          purged_at: item.purged_at,
        });
      }
      return list;
    } catch (error) {
      console.error('[VaultManager] Failed to fetch today\'s attendance:', error);
      return [];
    }
  }

  /**
   * Get unsynced attendance records.
   */
  async getUnsyncedRecords(): Promise<AttendanceLog[]> {
    if (!this.db) {
      return [];
    }

    try {
      const results = await this.db.executeSql(
        "SELECT * FROM attendance_log WHERE sync_status = 'LOCAL'"
      );
      const list: AttendanceLog[] = [];
      const rows = results[0].rows;
      for (let i = 0; i < rows.length; i++) {
        const item = rows.item(i);
        list.push({
          id: item.id,
          employee_id: item.employee_id,
          action: item.action,
          timestamp: item.timestamp,
          gps_lat: item.gps_lat,
          gps_lng: item.gps_lng,
          liveness_passive_score: item.liveness_passive_score,
          liveness_active_passed: item.liveness_active_passed,
          recognition_confidence: item.recognition_confidence,
          inference_ms: item.inference_ms,
          spoof_attempt: item.spoof_attempt,
          sync_status: item.sync_status,
          synced_at: item.synced_at,
          purged_at: item.purged_at,
        });
      }
      return list;
    } catch (error) {
      console.error('[VaultManager] Failed to fetch unsynced attendance:', error);
      return [];
    }
  }

  /**
   * Mark attendance records as successfully synced.
   */
  async markSynced(ids: string[]): Promise<void> {
    if (!this.db || ids.length === 0) {
      return;
    }

    const placeholders = ids.map(() => '?').join(',');
    const now = Date.now();

    try {
      await this.db.transaction((tx) => {
        tx.executeSql(
          `UPDATE attendance_log SET sync_status = 'SYNCED', synced_at = ? WHERE id IN (${placeholders})`,
          [now, ...ids]
        );
      });
    } catch (error) {
      console.error('[VaultManager] Failed to mark synced records:', error);
      throw error;
    }
  }

  /**
   * Purge records by IDs.
   */
  async purgeRecords(ids: string[]): Promise<void> {
    if (!this.db || ids.length === 0) {
      return;
    }

    const placeholders = ids.map(() => '?').join(',');
    const now = Date.now();

    try {
      await this.db.transaction((tx) => {
        tx.executeSql(
          `UPDATE attendance_log SET purged_at = ? WHERE id IN (${placeholders})`,
          [now, ...ids]
        );
      });
    } catch (error) {
      console.error('[VaultManager] Failed to purge records:', error);
      throw error;
    }
  }

  /**
   * Retrieve spoof logs.
   */
  async getSpoofAttempts(since: number): Promise<SpoofLog[]> {
    if (!this.db) {
      return [];
    }

    try {
      const results = await this.db.executeSql(
        'SELECT * FROM spoof_log WHERE timestamp >= ? ORDER BY timestamp DESC',
        [since]
      );
      const list: SpoofLog[] = [];
      const rows = results[0].rows;
      for (let i = 0; i < rows.length; i++) {
        const item = rows.item(i);
        list.push({
          id: item.id,
          timestamp: item.timestamp,
          device_id: item.device_id,
          spoof_type: item.spoof_type,
          passive_score: item.passive_score,
          frame_hash: item.frame_hash,
        });
      }
      return list;
    } catch (error) {
      console.error('[VaultManager] Failed to fetch spoof logs:', error);
      return [];
    }
  }

  /**
   * Exposed cache map for fast in-memory matching.
   */
  getCache(): Map<string, number[]> {
    return this.embeddingCache;
  }
}
export default VaultManager;
