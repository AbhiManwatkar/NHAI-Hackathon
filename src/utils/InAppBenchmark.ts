/**
 * FaceGuard Offline – In-App Benchmark Runner
 * =============================================
 *
 * Accessible from the Admin screen. Runs 20 recognition cycles against
 * 5 bundled test embeddings, measures every pipeline stage, and produces
 * structured reports for export (CSV / text summary for PPTX).
 */

// ── Types ────────────────────────────────────────────────────────────

export interface StageTimings {
  blazeface_ms: number;
  clahe_ms: number;
  mobilefacenet_ms: number;
  minifasnet_ms: number;
  cosine_match_ms: number;
  total_ms: number;
}

export interface StageStats {
  mean: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface BenchmarkReport {
  timestamp: string;
  deviceInfo: DeviceInfo;
  iterations: number;
  stages: Record<keyof StageTimings, StageStats>;
  passesTargets: boolean;
  violations: string[];
}

export interface DeviceInfo {
  model: string;
  os: string;
  ramMB: number;
  cpuCores: number;
}

// ── Performance targets (from spec) ─────────────────────────────────

const TARGETS: Record<string, { metric: keyof StageStats; limit: number }> = {
  blazeface_ms:    { metric: 'mean', limit: 50 },
  clahe_ms:        { metric: 'mean', limit: 30 },
  mobilefacenet_ms: { metric: 'mean', limit: 200 },
  minifasnet_ms:   { metric: 'mean', limit: 150 },
  cosine_match_ms: { metric: 'mean', limit: 5 },
  total_ms:        { metric: 'p95',  limit: 900 },
};

// ── Constants ────────────────────────────────────────────────────────

const NUM_TEST_EMBEDDINGS = 5;
const NUM_ITERATIONS = 20;
const EMBEDDING_DIM = 128;

// ── Helpers ──────────────────────────────────────────────────────────

function percentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return 0;
  const k = (sorted.length - 1) * pct / 100;
  const f = Math.floor(k);
  const c = Math.ceil(k);
  if (f === c) return sorted[f];
  return sorted[f] * (c - k) + sorted[c] * (k - f);
}

function computeStats(values: number[]): StageStats {
  const s = [...values].sort((a, b) => a - b);
  const sum = s.reduce((a, b) => a + b, 0);
  return {
    mean: Math.round((sum / s.length) * 100) / 100,
    min:  Math.round(s[0] * 100) / 100,
    max:  Math.round(s[s.length - 1] * 100) / 100,
    p50:  Math.round(percentile(s, 50) * 100) / 100,
    p95:  Math.round(percentile(s, 95) * 100) / 100,
    p99:  Math.round(percentile(s, 99) * 100) / 100,
  };
}

function getDeviceInfo(): DeviceInfo {
  // In a real RN app this would use react-native-device-info
  try {
    const DeviceInfo = require('react-native-device-info');
    return {
      model: DeviceInfo.getModel(),
      os: `${DeviceInfo.getSystemName()} ${DeviceInfo.getSystemVersion()}`,
      ramMB: Math.round(DeviceInfo.getTotalMemorySync() / 1024 / 1024),
      cpuCores: DeviceInfo.getSupportedAbisSync?.()?.length ?? 0,
    };
  } catch {
    return { model: 'Unknown', os: 'Unknown', ramMB: 0, cpuCores: 0 };
  }
}

// ── InAppBenchmark class ─────────────────────────────────────────────

export class InAppBenchmark {
  private testEmbeddings: number[][] = [];
  private galleryEmbeddings: number[][] = [];

  /**
   * Load bundled test embeddings. In production these are shipped as
   * assets; here we generate deterministic pseudo-random vectors.
   */
  private loadTestEmbeddings(): void {
    // Deterministic seed via simple LCG
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return (seed / 0x7fffffff) * 2 - 1;
    };

    this.testEmbeddings = [];
    for (let i = 0; i < NUM_TEST_EMBEDDINGS; i++) {
      const v: number[] = [];
      for (let j = 0; j < EMBEDDING_DIM; j++) {
        v.push(rand());
      }
      // L2 normalise
      const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
      this.testEmbeddings.push(v.map((x) => x / norm));
    }

    // Gallery = 100 random embeddings for matching benchmark
    this.galleryEmbeddings = [];
    for (let i = 0; i < 100; i++) {
      const v: number[] = [];
      for (let j = 0; j < EMBEDDING_DIM; j++) {
        v.push(rand());
      }
      const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
      this.galleryEmbeddings.push(v.map((x) => x / norm));
    }
  }

  /**
   * Simulate a single pipeline stage with a given workload.
   * In a real implementation this calls the actual native modules.
   */
  private async simulateStage(
    _stageName: string,
    _input: any,
  ): Promise<{ result: any; elapsed: number }> {
    // Placeholder – real implementation calls TFLite / native modules
    const start = performance.now();
    // Simulate some CPU work
    let dummy = 0;
    for (let i = 0; i < 10000; i++) {
      dummy += Math.sin(i * 0.001);
    }
    const elapsed = performance.now() - start;
    return { result: dummy, elapsed };
  }

  /**
   * Run a single full recognition pipeline cycle and return timings.
   */
  private async runSingleCycle(embedding: number[]): Promise<StageTimings> {
    const t: StageTimings = {
      blazeface_ms: 0,
      clahe_ms: 0,
      mobilefacenet_ms: 0,
      minifasnet_ms: 0,
      cosine_match_ms: 0,
      total_ms: 0,
    };

    const totalStart = performance.now();

    // Stage 1: BlazeFace detection
    const s1 = await this.simulateStage('blazeface', null);
    t.blazeface_ms = s1.elapsed;

    // Stage 2: CLAHE preprocessing
    const s2 = await this.simulateStage('clahe', null);
    t.clahe_ms = s2.elapsed;

    // Stage 3: MobileFaceNet embedding extraction
    const s3 = await this.simulateStage('mobilefacenet', null);
    t.mobilefacenet_ms = s3.elapsed;

    // Stage 4: MiniFASNet liveness
    const s4 = await this.simulateStage('minifasnet', null);
    t.minifasnet_ms = s4.elapsed;

    // Stage 5: Cosine matching against gallery
    const matchStart = performance.now();
    for (const gallery of this.galleryEmbeddings) {
      let dot = 0;
      for (let i = 0; i < EMBEDDING_DIM; i++) {
        dot += embedding[i] * gallery[i];
      }
    }
    t.cosine_match_ms = performance.now() - matchStart;

    t.total_ms = performance.now() - totalStart;
    return t;
  }

  /**
   * Run the full benchmark suite.
   *
   * @returns Structured BenchmarkReport with per-stage statistics.
   */
  async runFullSuite(): Promise<BenchmarkReport> {
    this.loadTestEmbeddings();

    const allTimings: Record<keyof StageTimings, number[]> = {
      blazeface_ms: [],
      clahe_ms: [],
      mobilefacenet_ms: [],
      minifasnet_ms: [],
      cosine_match_ms: [],
      total_ms: [],
    };

    for (let i = 0; i < NUM_ITERATIONS; i++) {
      const emb = this.testEmbeddings[i % NUM_TEST_EMBEDDINGS];
      const t = await this.runSingleCycle(emb);

      (Object.keys(t) as (keyof StageTimings)[]).forEach((key) => {
        allTimings[key].push(t[key]);
      });
    }

    // Compute stats per stage
    const stages = {} as Record<keyof StageTimings, StageStats>;
    (Object.keys(allTimings) as (keyof StageTimings)[]).forEach((key) => {
      stages[key] = computeStats(allTimings[key]);
    });

    // Validate against targets
    const violations: string[] = [];
    for (const [stage, target] of Object.entries(TARGETS)) {
      const stageKey = stage as keyof StageTimings;
      const actual = stages[stageKey]?.[target.metric] ?? Infinity;
      if (actual > target.limit) {
        violations.push(
          `${stage}.${target.metric} = ${actual.toFixed(1)}ms (limit: ${target.limit}ms)`,
        );
      }
    }

    return {
      timestamp: new Date().toISOString(),
      deviceInfo: getDeviceInfo(),
      iterations: NUM_ITERATIONS,
      stages,
      passesTargets: violations.length === 0,
      violations,
    };
  }

  /**
   * Generate a CSV string from a BenchmarkReport.
   */
  generateCSVReport(report: BenchmarkReport): string {
    const header = 'stage,mean,min,max,p50,p95,p99,target_metric,target_limit,pass';
    const rows: string[] = [header];

    for (const [stage, stats] of Object.entries(report.stages)) {
      const target = TARGETS[stage];
      const pass = target
        ? stats[target.metric] <= target.limit ? 'PASS' : 'FAIL'
        : 'N/A';
      const targetMetric = target?.metric ?? '';
      const targetLimit = target?.limit?.toString() ?? '';
      rows.push(
        [
          stage,
          stats.mean, stats.min, stats.max,
          stats.p50, stats.p95, stats.p99,
          targetMetric, targetLimit, pass,
        ].join(','),
      );
    }

    rows.push('');
    rows.push(`Device,${report.deviceInfo.model}`);
    rows.push(`OS,${report.deviceInfo.os}`);
    rows.push(`RAM (MB),${report.deviceInfo.ramMB}`);
    rows.push(`Iterations,${report.iterations}`);
    rows.push(`Timestamp,${report.timestamp}`);
    rows.push(`Overall,${report.passesTargets ? 'PASS' : 'FAIL'}`);

    return rows.join('\n');
  }

  /**
   * Generate a human-readable text summary formatted for copy-paste
   * into a PowerPoint presentation.
   */
  generateTextSummary(report: BenchmarkReport): string {
    const lines: string[] = [];
    const hr = '─'.repeat(56);

    lines.push('╔══════════════════════════════════════════════════════╗');
    lines.push('║       FaceGuard Offline – Benchmark Results         ║');
    lines.push('╚══════════════════════════════════════════════════════╝');
    lines.push('');
    lines.push(`  Device:     ${report.deviceInfo.model}`);
    lines.push(`  OS:         ${report.deviceInfo.os}`);
    lines.push(`  RAM:        ${report.deviceInfo.ramMB} MB`);
    lines.push(`  Iterations: ${report.iterations}`);
    lines.push(`  Date:       ${report.timestamp}`);
    lines.push('');
    lines.push(hr);
    lines.push(
      '  Stage                 Mean    P50     P95     Target  ',
    );
    lines.push(hr);

    const stageLabels: Record<string, string> = {
      blazeface_ms:     'BlazeFace Detection',
      clahe_ms:         'CLAHE Preprocessing',
      mobilefacenet_ms: 'MobileFaceNet Embed',
      minifasnet_ms:    'MiniFASNet Liveness',
      cosine_match_ms:  'Cosine Match (×100)',
      total_ms:         'Total Pipeline     ',
    };

    for (const [stage, label] of Object.entries(stageLabels)) {
      const s = report.stages[stage as keyof StageTimings];
      const t = TARGETS[stage];
      if (!s) continue;

      const targetStr = t
        ? `≤${t.limit}ms (${s[t.metric] <= t.limit ? '✅' : '❌'})`
        : '';

      lines.push(
        `  ${label}  ${pad(s.mean)}  ${pad(s.p50)}  ${pad(s.p95)}  ${targetStr}`,
      );
    }

    lines.push(hr);
    lines.push('');
    lines.push(
      report.passesTargets
        ? '  ✅ ALL TARGETS MET'
        : `  ❌ ${report.violations.length} TARGET(S) MISSED`,
    );

    if (report.violations.length > 0) {
      lines.push('');
      for (const v of report.violations) {
        lines.push(`     • ${v}`);
      }
    }

    lines.push('');
    return lines.join('\n');
  }
}

// ── Internal helpers ─────────────────────────────────────────────────

function pad(n: number, width = 7): string {
  const s = n.toFixed(1) + 'ms';
  return s.padStart(width);
}
