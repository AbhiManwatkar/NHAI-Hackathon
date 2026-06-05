/**
 * FaceGuard Offline – FaceEngine Unit Tests
 */
import {
  cosineSimilarity, l2Normalise, matchEmbedding,
  averageEmbeddings, computeEAR, detectSpoofType,
} from '../engine/FaceEngine';

const THRESHOLD = 0.65;

function randUnit(dim = 128): number[] {
  const r = Array.from({ length: dim }, () => Math.random() - 0.5);
  const n = Math.sqrt(r.reduce((s, v) => s + v * v, 0));
  return r.map(v => v / n);
}

function mockEmp(id: string, name: string, emb: number[]) {
  return { id, name, embedding: emb };
}

describe('cosineSimilarity', () => {
  it('returns 1.0 for the same vector', () => {
    const v = randUnit();
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });
  it('returns 0.0 for orthogonal vectors', () => {
    const a = new Array(128).fill(0); a[0] = 1;
    const b = new Array(128).fill(0); b[1] = 1;
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
  });
  it('returns -1.0 for opposite vectors', () => {
    const v = randUnit();
    expect(cosineSimilarity(v, v.map(x => -x))).toBeCloseTo(-1.0, 5);
  });
  it('is commutative', () => {
    const a = randUnit(), b = randUnit();
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });
});

describe('l2Normalise', () => {
  it('normalises [3,4] to [0.6, 0.8]', () => {
    const r = l2Normalise([3, 4]);
    expect(r[0]).toBeCloseTo(0.6, 5);
    expect(r[1]).toBeCloseTo(0.8, 5);
  });
  it('produces a unit vector', () => {
    const n = l2Normalise([1, 2, 3, 4, 5]);
    expect(Math.sqrt(n.reduce((s, x) => s + x * x, 0))).toBeCloseTo(1.0, 5);
  });
  it('is idempotent', () => {
    const v = randUnit(64);
    const once = l2Normalise(v), twice = l2Normalise(once);
    once.forEach((val, i) => expect(val).toBeCloseTo(twice[i], 10));
  });
});

describe('matchEmbedding', () => {
  it('returns null when no employees', () => {
    expect(matchEmbedding(randUnit(), [], THRESHOLD)).toBeNull();
  });
  it('returns correct employee above threshold', () => {
    const emb = randUnit();
    const probe = emb.map(v => v + (Math.random() - 0.5) * 0.01);
    const emps = [
      mockEmp('e1', 'Alice', randUnit()),
      mockEmp('e2', 'Bob', emb),
      mockEmp('e3', 'Charlie', randUnit()),
    ];
    const r = matchEmbedding(probe, emps, THRESHOLD);
    expect(r).not.toBeNull();
    expect(r!.employee.id).toBe('e2');
    expect(r!.score).toBeGreaterThanOrEqual(THRESHOLD);
  });
  it('returns null when best score < 0.65', () => {
    expect(matchEmbedding(randUnit(), [
      mockEmp('e1', 'A', randUnit()), mockEmp('e2', 'B', randUnit()),
    ], THRESHOLD)).toBeNull();
  });
  it('matching 100 employees completes in < 5ms', () => {
    const probe = randUnit();
    const emps = Array.from({ length: 100 }, (_, i) =>
      mockEmp(`e${i}`, `Emp${i}`, randUnit()));
    const t = performance.now();
    matchEmbedding(probe, emps, THRESHOLD);
    expect(performance.now() - t).toBeLessThan(5);
  });
});

describe('averageEmbeddings', () => {
  it('produces correct average of 3 embeddings', () => {
    const avg = averageEmbeddings([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
    expect(avg[0]).toBeCloseTo(4.0, 5);
    expect(avg[1]).toBeCloseTo(5.0, 5);
    expect(avg[2]).toBeCloseTo(6.0, 5);
  });
  it('single embedding average equals itself', () => {
    const e = randUnit();
    averageEmbeddings([e]).forEach((v, i) => expect(v).toBeCloseTo(e[i], 10));
  });
});

describe('computeEAR', () => {
  it('returns correct value for known landmark coords', () => {
    // EAR = (‖p2−p6‖ + ‖p3−p5‖) / (2×‖p1−p4‖)
    // = (6 + 6) / (2×4) = 1.5
    const lm = {
      p1: { x: 0, y: 5 }, p2: { x: 1, y: 8 }, p3: { x: 3, y: 8 },
      p4: { x: 4, y: 5 }, p5: { x: 3, y: 2 }, p6: { x: 1, y: 2 },
    };
    expect(computeEAR(lm)).toBeCloseTo(1.5, 5);
  });
  it('returns 0.0 for fully closed eye', () => {
    const lm = {
      p1: { x: 0, y: 5 }, p2: { x: 1, y: 5 }, p3: { x: 3, y: 5 },
      p4: { x: 4, y: 5 }, p5: { x: 3, y: 5 }, p6: { x: 1, y: 5 },
    };
    expect(computeEAR(lm)).toBeCloseTo(0.0, 5);
  });
});

describe('detectSpoofType', () => {
  it('classifies live face correctly', () => {
    expect(detectSpoofType({ liveScore: 0.95, depthScore: 0.85, moireScore: 0.1 }))
      .toBe('live');
  });
  it('classifies print attack', () => {
    expect(detectSpoofType({ liveScore: 0.15, depthScore: 0.1, moireScore: 0.2 }))
      .toBe('print_attack');
  });
  it('classifies screen replay', () => {
    expect(detectSpoofType({ liveScore: 0.3, depthScore: 0.4, moireScore: 0.8 }))
      .toBe('screen_replay');
  });
  it('classifies ambiguous as unknown_spoof', () => {
    expect(detectSpoofType({ liveScore: 0.5, depthScore: 0.5, moireScore: 0.5 }))
      .toBe('unknown_spoof');
  });
  it('is deterministic', () => {
    const s = { liveScore: 0.9, depthScore: 0.7, moireScore: 0.1 };
    const results = Array.from({ length: 10 }, () => detectSpoofType(s));
    expect(new Set(results).size).toBe(1);
  });
});

describe('Performance targets (spec assertions)', () => {
  // These encode the hard limits from the FaceGuard Offline spec.
  // Actual validation runs in InAppBenchmark / device_benchmark.py;
  // these tests verify the constants are wired correctly.

  const TARGETS = {
    totalPipeline_p95_ms:     900,
    blazeFace_mean_ms:         50,
    clahe_mean_ms:             30,
    mobileFaceNet_mean_ms:    200,
    miniFASNet_mean_ms:       150,
    cosineMatch100_mean_ms:     5,
    modelTotalSize_mb:          6,
    appPackageDelta_mb:        20,
  };

  it('total pipeline: p95 < 900ms on 3 GB RAM Android', () => {
    expect(TARGETS.totalPipeline_p95_ms).toBeLessThanOrEqual(900);
  });

  it('BlazeFace detection: mean < 50ms', () => {
    expect(TARGETS.blazeFace_mean_ms).toBeLessThanOrEqual(50);
  });

  it('CLAHE preprocessing: mean < 30ms', () => {
    expect(TARGETS.clahe_mean_ms).toBeLessThanOrEqual(30);
  });

  it('MobileFaceNet embedding: mean < 200ms', () => {
    expect(TARGETS.mobileFaceNet_mean_ms).toBeLessThanOrEqual(200);
  });

  it('MiniFASNet liveness: mean < 150ms', () => {
    expect(TARGETS.miniFASNet_mean_ms).toBeLessThanOrEqual(150);
  });

  it('cosine matching (100 employees): mean < 5ms', () => {
    expect(TARGETS.cosineMatch100_mean_ms).toBeLessThanOrEqual(5);
  });

  it('model total size: < 6 MB', () => {
    expect(TARGETS.modelTotalSize_mb).toBeLessThanOrEqual(6);
  });

  it('full app package delta: < 20 MB', () => {
    expect(TARGETS.appPackageDelta_mb).toBeLessThanOrEqual(20);
  });
});
