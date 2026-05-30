/**
 * @file logger.ts
 * @description Structured logging utility for FaceGuard Offline.
 *
 * Features:
 * - Four severity levels: DEBUG, INFO, WARN, ERROR
 * - Console output (coloured in __DEV__)
 * - Persistent log file written via `react-native-fs` (RNFS)
 * - Each entry carries ISO-8601 timestamp, level, module tag, message,
 *   and optional structured data
 * - File rotation: when the log exceeds `MAX_LOG_SIZE_BYTES` the
 *   current file is archived and a fresh one is started
 *
 * Usage:
 * ```ts
 * import { Logger } from '@/utils/logger';
 *
 * Logger.info('FaceEngine', 'Model loaded', { version: 2 });
 * Logger.error('Sync', 'Upload failed', { status: 500 });
 *
 * const path = await Logger.getLogFile();
 * await Logger.clearLogs();
 * ```
 */

import RNFS from 'react-native-fs';

// ─── Types ───────────────────────────────────────────────────────────

/** Supported log severity levels. */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/** Numeric priority – lower means more verbose. */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

/** A single structured log entry. */
export interface LogEntry {
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Severity level */
  level: LogLevel;
  /** Subsystem / module tag */
  module: string;
  /** Human-readable message */
  message: string;
  /** Optional structured payload */
  data?: Record<string, unknown>;
}

// ─── Configuration ───────────────────────────────────────────────────

/** Directory where log files are stored. */
const LOG_DIR = `${RNFS.DocumentDirectoryPath}/logs`;

/** Active log file name. */
const LOG_FILE_NAME = 'faceguard.log';

/** Archived log file name. */
const ARCHIVE_FILE_NAME = 'faceguard.prev.log';

/** Maximum log file size before rotation (~2 MB). */
const MAX_LOG_SIZE_BYTES = 2 * 1024 * 1024;

/**
 * Minimum level to persist.
 * In production you may want to set this to INFO.
 */
let minLevel: LogLevel = __DEV__ ? LogLevel.DEBUG : LogLevel.INFO;

// ─── Internal State ──────────────────────────────────────────────────

let dirEnsured = false;
let writeQueue: Promise<void> = Promise.resolve();

/** Ensure the log directory exists (idempotent). */
async function ensureDir(): Promise<void> {
  if (dirEnsured) {
    return;
  }
  try {
    const exists = await RNFS.exists(LOG_DIR);
    if (!exists) {
      await RNFS.mkdir(LOG_DIR);
    }
    dirEnsured = true;
  } catch (err) {
    // Swallow – logging should never crash the app
    console.error('[Logger] Failed to create log directory', err);
  }
}

/** Full path to the active log file. */
function logFilePath(): string {
  return `${LOG_DIR}/${LOG_FILE_NAME}`;
}

/** Full path to the archive log file. */
function archiveFilePath(): string {
  return `${LOG_DIR}/${ARCHIVE_FILE_NAME}`;
}

// ─── File Rotation ───────────────────────────────────────────────────

/**
 * Rotate the log file if it exceeds `MAX_LOG_SIZE_BYTES`.
 * The current file becomes the archive; a new file is started.
 */
async function rotateIfNeeded(): Promise<void> {
  try {
    const path = logFilePath();
    const exists = await RNFS.exists(path);
    if (!exists) {
      return;
    }

    const stat = await RNFS.stat(path);
    const size = typeof stat.size === 'string' ? parseInt(stat.size, 10) : stat.size;

    if (size >= MAX_LOG_SIZE_BYTES) {
      // Archive existing file (overwrite previous archive)
      const archivePath = archiveFilePath();
      const archiveExists = await RNFS.exists(archivePath);
      if (archiveExists) {
        await RNFS.unlink(archivePath);
      }
      await RNFS.moveFile(path, archivePath);
    }
  } catch {
    // Swallow rotation errors
  }
}

// ─── Core Write ──────────────────────────────────────────────────────

/**
 * Serialise a `LogEntry` to a single line of text.
 */
function formatEntry(entry: LogEntry): string {
  const base = `[${entry.timestamp}] [${entry.level.padEnd(5)}] [${entry.module}] ${entry.message}`;
  if (entry.data && Object.keys(entry.data).length > 0) {
    try {
      return `${base} | ${JSON.stringify(entry.data)}\n`;
    } catch {
      return `${base} | [unserializable data]\n`;
    }
  }
  return `${base}\n`;
}

/**
 * Append text to the log file, serialised through a write queue so
 * concurrent calls don't interleave.
 */
function enqueueWrite(text: string): void {
  writeQueue = writeQueue
    .then(() => ensureDir())
    .then(() => rotateIfNeeded())
    .then(() => RNFS.appendFile(logFilePath(), text, 'utf8'))
    .catch((err) => {
      console.error('[Logger] Write failed', err);
    });
}

// ─── Console Helpers ─────────────────────────────────────────────────

const CONSOLE_METHODS: Record<LogLevel, (...args: unknown[]) => void> = {
  [LogLevel.DEBUG]: console.debug,
  [LogLevel.INFO]: console.info,
  [LogLevel.WARN]: console.warn,
  [LogLevel.ERROR]: console.error,
};

const LEVEL_EMOJI: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: '🐛',
  [LogLevel.INFO]: 'ℹ️',
  [LogLevel.WARN]: '⚠️',
  [LogLevel.ERROR]: '🔴',
};

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Write a structured log entry.
 *
 * @param level   Severity level.
 * @param module  Subsystem / module name (e.g. `'FaceEngine'`).
 * @param message Human-readable message.
 * @param data    Optional structured payload.
 */
function log(
  level: LogLevel,
  module: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  // Filter by minimum level
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    data,
  };

  // Console output (dev builds only to avoid perf hit)
  if (__DEV__) {
    const consoleFn = CONSOLE_METHODS[level];
    const emoji = LEVEL_EMOJI[level];
    consoleFn(`${emoji} [${module}] ${message}`, data ?? '');
  }

  // Persistent file output
  enqueueWrite(formatEntry(entry));
}

/** Shorthand for `log(LogLevel.DEBUG, …)`. */
function debug(module: string, message: string, data?: Record<string, unknown>): void {
  log(LogLevel.DEBUG, module, message, data);
}

/** Shorthand for `log(LogLevel.INFO, …)`. */
function info(module: string, message: string, data?: Record<string, unknown>): void {
  log(LogLevel.INFO, module, message, data);
}

/** Shorthand for `log(LogLevel.WARN, …)`. */
function warn(module: string, message: string, data?: Record<string, unknown>): void {
  log(LogLevel.WARN, module, message, data);
}

/** Shorthand for `log(LogLevel.ERROR, …)`. */
function error(module: string, message: string, data?: Record<string, unknown>): void {
  log(LogLevel.ERROR, module, message, data);
}

/**
 * Get the absolute file-system path to the active log file.
 *
 * @returns Path string (file may not yet exist if nothing has been logged).
 */
async function getLogFile(): Promise<string> {
  await ensureDir();
  return logFilePath();
}

/**
 * Delete all log files (active + archive).
 */
async function clearLogs(): Promise<void> {
  try {
    const active = logFilePath();
    const archive = archiveFilePath();

    if (await RNFS.exists(active)) {
      await RNFS.unlink(active);
    }
    if (await RNFS.exists(archive)) {
      await RNFS.unlink(archive);
    }
  } catch (err) {
    console.error('[Logger] Failed to clear logs', err);
  }
}

/**
 * Read the full contents of the active log file.
 *
 * @returns Log text, or empty string if no file exists.
 */
async function readLogs(): Promise<string> {
  try {
    const path = logFilePath();
    if (await RNFS.exists(path)) {
      return await RNFS.readFile(path, 'utf8');
    }
  } catch (err) {
    console.error('[Logger] Failed to read logs', err);
  }
  return '';
}

/**
 * Change the minimum severity level at runtime.
 *
 * @param level New minimum level.
 */
function setMinLevel(level: LogLevel): void {
  minLevel = level;
}

/**
 * Flush the write queue – useful before app shutdown.
 */
async function flush(): Promise<void> {
  await writeQueue;
}

// ─── Singleton Export ────────────────────────────────────────────────

/**
 * Structured logger singleton.
 *
 * ```ts
 * import { Logger } from '@/utils/logger';
 * Logger.info('Auth', 'User authenticated', { userId: 42 });
 * ```
 */
export const Logger = {
  log,
  debug,
  info,
  warn,
  error,
  getLogFile,
  clearLogs,
  readLogs,
  setMinLevel,
  flush,
  LogLevel,
} as const;

export default Logger;
