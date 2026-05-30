/**
 * @file benchmark.ts
 * @description Performance benchmarking utility for FaceGuard Offline.
 *
 * Tracks wall-clock durations for labelled operations (face detection
 * inference, frame processing, enrolment, etc.) and exposes aggregate
 * metrics (min / max / avg / p95 / count) per label.
 *
 * All timing uses the high-resolution `performance.now()` API available
 * in Hermes and JSC.
 *
 * Usage:
 * ```ts
 * import { Benchmark } from '@/utils/benchmark';
 *
 * Benchmark.startTimer('face_detect');
 * await detectFace(frame);
 * Benchmark.endTimer('face_detect');
 *
 * console.log(Benchmark.getMetrics('face_detect'));
 * Benchmark.logPerformance();
 * ```
 */

// ─── Types ───────────────────────────────────────────────────────────

/** Aggregate statistics for a single labelled operation. */
export interface BenchmarkMetrics {
  /** Human-readable label */
  label: string;
  /** Total number of completed measurements */
  count: number;
  /** Minimum duration (ms) */
  min: number;
  /** Maximum duration (ms) */
  max: number;
  /** Arithmetic mean duration (ms) */
  avg: number;
  /** 95th percentile duration (ms) */
  p95: number;
  /** Most recent duration (ms) */
  last: number;
  /** Sum of all durations (ms) */
  total: number;
}

export interface BenchmarkSummaryRow {
  label: string;
  count: number;
  mean: number;
  min: number;
  max: number;
  p95: number;
}

export type BenchmarkSummary = Record<string, BenchmarkSummaryRow>;

/** Internal record for an in-flight timer. */
interface TimerEntry {
  startTime: number;
}

// ─── State ───────────────────────────────────────────────────────────

/** Map of label → in-flight timer start timestamp. */
const activeTimers: Map<string, TimerEntry> = new Map();

/** Map of label → list of recorded durations (ms). */
const durationsMap: Map<string, number[]> = new Map();

/** Maximum number of durations to retain per label to avoid OOM. */
const MAX_HISTORY = 1000;

// ─── Core API ────────────────────────────────────────────────────────

/**
 * Start a named timer.
 *
 * If a timer with the same label is already running it is silently
 * overwritten (useful inside hot loops).
 *
 * @param label Unique identifier for the timed operation.
 */
function startTimer(label: string): void {
  activeTimers.set(label, { startTime: performance.now() });
}

function record(label: string, ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) {
    return;
  }

  let history = durationsMap.get(label);
  if (!history) {
    history = [];
    durationsMap.set(label, history);
  }
  if (history.length >= MAX_HISTORY) {
    history.splice(0, Math.ceil(MAX_HISTORY * 0.1));
  }
  history.push(ms);
}

/**
 * Stop a previously-started timer and record its duration.
 *
 * @param label Must match a prior `startTimer` call.
 * @returns Duration in milliseconds, or `-1` if no matching timer.
 */
function endTimer(label: string): number {
  const entry = activeTimers.get(label);
  if (!entry) {
    if (__DEV__) {
      console.warn(`[Benchmark] endTimer called for unknown label: "${label}"`);
    }
    return -1;
  }

  const duration = performance.now() - entry.startTime;
  activeTimers.delete(label);

  record(label, duration);

  return duration;
}

/**
 * Convenience wrapper that executes an async function and records its
 * wall-clock duration under the given label.
 *
 * @param label Timer label.
 * @param fn    Async function to measure.
 * @returns     The return value of `fn`.
 */
async function measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
  startTimer(label);
  try {
    return await fn();
  } finally {
    endTimer(label);
  }
}

/**
 * Convenience wrapper for synchronous functions.
 */
function measureSync<T>(label: string, fn: () => T): T {
  startTimer(label);
  try {
    return fn();
  } finally {
    endTimer(label);
  }
}

// ─── Metrics ─────────────────────────────────────────────────────────

/**
 * Compute the 95th-percentile value from a **sorted** array.
 */
function percentile95(sorted: number[]): number {
  if (sorted.length === 0) {
    return 0;
  }
  const idx = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.min(idx, sorted.length - 1)];
}

/**
 * Retrieve aggregate metrics for a single label.
 *
 * @param label Timer label.
 * @returns Metrics object, or `null` if no data recorded.
 */
function getMetrics(label: string): BenchmarkMetrics | null {
  const history = durationsMap.get(label);
  if (!history || history.length === 0) {
    return null;
  }

  const sorted = [...history].sort((a, b) => a - b);
  const total = sorted.reduce((sum, v) => sum + v, 0);

  return {
    label,
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: total / sorted.length,
    p95: percentile95(sorted),
    last: history[history.length - 1],
    total,
  };
}

/**
 * Retrieve metrics for **all** recorded labels.
 *
 * @returns Array of `BenchmarkMetrics` sorted by label name.
 */
function getAllMetrics(): BenchmarkMetrics[] {
  const results: BenchmarkMetrics[] = [];
  for (const label of [...durationsMap.keys()].sort()) {
    const m = getMetrics(label);
    if (m) {
      results.push(m);
    }
  }
  return results;
}

function getSummary(): BenchmarkSummary {
  const summary: BenchmarkSummary = {};
  for (const metric of getAllMetrics()) {
    summary[metric.label] = {
      label: metric.label,
      count: metric.count,
      mean: metric.avg,
      min: metric.min,
      max: metric.max,
      p95: metric.p95,
    };
  }
  return summary;
}

function exportCSV(): string {
  const rows = [
    ['Step', 'Count', 'Mean (ms)', 'Min (ms)', 'Max (ms)', 'P95 (ms)'],
    ...getAllMetrics().map((metric) => [
      metric.label,
      String(metric.count),
      metric.avg.toFixed(2),
      metric.min.toFixed(2),
      metric.max.toFixed(2),
      metric.p95.toFixed(2),
    ]),
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

// ─── Logging ─────────────────────────────────────────────────────────

/**
 * Pretty-print all metrics to the console.
 *
 * Intended for development builds and periodic diagnostic dumps.
 */
function logPerformance(): void {
  const all = getAllMetrics();
  if (all.length === 0) {
    console.log('[Benchmark] No metrics recorded yet.');
    return;
  }

  console.log('┌───────────────────────────────────────────────────────────────┐');
  console.log('│                   FaceGuard Performance Report                │');
  console.log('├────────────────────┬───────┬────────┬────────┬────────┬───────┤');
  console.log('│ Label              │ Count │ Avg ms │ P95 ms │ Max ms │ Total │');
  console.log('├────────────────────┼───────┼────────┼────────┼────────┼───────┤');

  for (const m of all) {
    const lbl = m.label.padEnd(18).slice(0, 18);
    const cnt = String(m.count).padStart(5);
    const avg = m.avg.toFixed(1).padStart(6);
    const p95 = m.p95.toFixed(1).padStart(6);
    const max = m.max.toFixed(1).padStart(6);
    const tot = m.total.toFixed(0).padStart(5);
    console.log(`│ ${lbl} │ ${cnt} │ ${avg} │ ${p95} │ ${max} │ ${tot} │`);
  }

  console.log('└────────────────────┴───────┴────────┴────────┴────────┴───────┘');
}

/**
 * Format all metrics as a serialisable plain object (for file / remote
 * logging).
 */
function toJSON(): Record<string, BenchmarkMetrics> {
  const result: Record<string, BenchmarkMetrics> = {};
  for (const m of getAllMetrics()) {
    result[m.label] = m;
  }
  return result;
}

// ─── Lifecycle ───────────────────────────────────────────────────────

/** Clear all recorded data and active timers for a specific label. */
function clearLabel(label: string): void {
  activeTimers.delete(label);
  durationsMap.delete(label);
}

/** Reset **all** benchmark data. */
function clearAll(): void {
  activeTimers.clear();
  durationsMap.clear();
}

function reset(): void {
  clearAll();
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Singleton benchmark utility.
 *
 * ```ts
 * Benchmark.startTimer('inference');
 * // … work …
 * const ms = Benchmark.endTimer('inference');
 * ```
 */
export const Benchmark = {
  record,
  startTimer,
  endTimer,
  measure,
  measureSync,
  getMetrics,
  getAllMetrics,
  getSummary,
  reset,
  exportCSV,
  logPerformance,
  toJSON,
  clearLabel,
  clearAll,
} as const;

export const BenchmarkStore = {
  record,
  getSummary,
  reset,
  exportCSV,
} as const;

export default Benchmark;

function escapeCsvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
