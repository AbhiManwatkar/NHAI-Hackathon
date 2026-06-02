import SQLite from 'react-native-sqlite-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

SQLite.enablePromise(true);

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
}

const MAX_MEMORY_LOGS = 200;
const memoryLogs: LogEntry[] = [];

const consoleByLevel: Record<LogLevel, (...args: unknown[]) => void> = {
  DEBUG: console.debug,
  INFO: console.info,
  WARN: console.warn,
  ERROR: console.error,
  SECURITY: console.warn,
};

let securityWriteQueue: Promise<void> = Promise.resolve();

function log(
  level: LogLevel,
  module: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  const entry: LogEntry = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    data,
  };

  memoryLogs.unshift(entry);
  if (memoryLogs.length > MAX_MEMORY_LOGS) {
    memoryLogs.splice(MAX_MEMORY_LOGS);
  }

  if (__DEV__) {
    consoleByLevel[level](`[${level}] [${module}] ${message}`, data ?? '');
  }

  if (level === 'SECURITY') {
    enqueueSecurityWrite(entry);
  }
}

function enqueueSecurityWrite(entry: LogEntry): void {
  securityWriteQueue = securityWriteQueue
    .then(async () => {
      const db = await SQLite.openDatabase({
        name: 'faceguard_vault.db',
        location: 'default',
      });

      await db.executeSql(`
        CREATE TABLE IF NOT EXISTS spoof_log (
          id TEXT PRIMARY KEY,
          timestamp INTEGER,
          device_id TEXT,
          spoof_type TEXT,
          passive_score REAL,
          frame_hash TEXT
        );
      `);

      const payload = entry.data ?? {};
      await db.executeSql(
        `INSERT INTO spoof_log (id, timestamp, device_id, spoof_type, passive_score, frame_hash)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          entry.id,
          new Date(entry.timestamp).getTime(),
          typeof payload.deviceId === 'string' ? payload.deviceId : null,
          typeof payload.reason === 'string' ? payload.reason : entry.message,
          typeof payload.confidence === 'number' ? payload.confidence : 0,
          typeof payload.frameHash === 'string' ? payload.frameHash : entry.id,
        ],
      );
    })
    .catch((error) => {
      console.error('[Logger] Failed to persist SECURITY log', error);
    });
}

function getLogs(level?: LogLevel, module?: string): LogEntry[] {
  return memoryLogs.filter((entry) => {
    const matchesLevel = level ? entry.level === level : true;
    const matchesModule = module ? entry.module === module : true;
    return matchesLevel && matchesModule;
  });
}

function exportLogsAsJSON(): string {
  return JSON.stringify(memoryLogs, null, 2);
}

async function flush(): Promise<void> {
  await securityWriteQueue;
}

export const Logger = {
  log,
  debug: (module: string, message: string, data?: Record<string, unknown>) =>
    log('DEBUG', module, message, data),
  info: (module: string, message: string, data?: Record<string, unknown>) =>
    log('INFO', module, message, data),
  warn: (module: string, message: string, data?: Record<string, unknown>) =>
    log('WARN', module, message, data),
  error: (module: string, message: string, data?: Record<string, unknown>) =>
    log('ERROR', module, message, data),
  security: (module: string, message: string, data?: Record<string, unknown>) =>
    log('SECURITY', module, message, data),
  getLogs,
  exportLogsAsJSON,
  flush,
} as const;

export { log, getLogs, exportLogsAsJSON };
export default Logger;
