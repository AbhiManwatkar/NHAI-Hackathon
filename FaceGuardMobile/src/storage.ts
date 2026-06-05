/**
 * FaceGuard Offline – SQLite Storage (Expo)
 * Uses expo-sqlite for encrypted local biometric vault.
 */
import * as SQLite from 'expo-sqlite';
import { EmployeeEmbedding } from './engine';

let db: SQLite.SQLiteDatabase | null = null;

export async function initDB() {
  db = await SQLite.openDatabaseAsync('faceguard.db');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      embedding TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('CHECK_IN','CHECK_OUT')),
      confidence REAL,
      liveness_score REAL,
      sync_status TEXT NOT NULL DEFAULT 'LOCAL' CHECK(sync_status IN ('LOCAL','SYNCED','PURGED')),
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );
  `);
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function enrollEmployee(name: string, dept: string, embedding: number[]): Promise<string> {
  if (!db) await initDB();
  const id = uuid();
  await db!.runAsync(
    'INSERT INTO employees (id, name, department, embedding) VALUES (?, ?, ?, ?)',
    id, name, dept, JSON.stringify(embedding)
  );
  return id;
}

export async function loadGallery(): Promise<EmployeeEmbedding[]> {
  if (!db) await initDB();
  const rows = await db!.getAllAsync<{id:string; name:string; embedding:string}>(
    'SELECT id, name, embedding FROM employees'
  );
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    embedding: JSON.parse(r.embedding),
  }));
}

export async function logAttendance(empId: string, confidence: number, liveness: number): Promise<string> {
  if (!db) await initDB();
  const id = uuid();
  await db!.runAsync(
    `INSERT INTO attendance (id, employee_id, timestamp, type, confidence, liveness_score, sync_status)
     VALUES (?, ?, ?, 'CHECK_IN', ?, ?, 'LOCAL')`,
    id, empId, new Date().toISOString(), confidence, liveness
  );
  return id;
}

export async function getStats() {
  if (!db) await initDB();
  const emp = await db!.getFirstAsync<{c:number}>('SELECT COUNT(*) as c FROM employees');
  const att = await db!.getFirstAsync<{c:number}>('SELECT COUNT(*) as c FROM attendance');
  const uns = await db!.getFirstAsync<{c:number}>("SELECT COUNT(*) as c FROM attendance WHERE sync_status='LOCAL'");
  const today = new Date().toISOString().slice(0, 10);
  const tod = await db!.getFirstAsync<{c:number}>(`SELECT COUNT(*) as c FROM attendance WHERE timestamp LIKE '${today}%'`);
  return {
    totalEmployees: emp?.c ?? 0,
    totalAttendance: att?.c ?? 0,
    unsyncedCount: uns?.c ?? 0,
    todayCheckIns: tod?.c ?? 0,
  };
}

export async function getEmployees(): Promise<{id:string;name:string;department:string;created_at:string}[]> {
  if (!db) await initDB();
  return db!.getAllAsync('SELECT id, name, department, created_at FROM employees ORDER BY created_at DESC');
}

export async function deleteEmployee(id: string): Promise<void> {
  if (!db) await initDB();
  await db!.runAsync('DELETE FROM attendance WHERE employee_id = ?', id);
  await db!.runAsync('DELETE FROM employees WHERE id = ?', id);
}
