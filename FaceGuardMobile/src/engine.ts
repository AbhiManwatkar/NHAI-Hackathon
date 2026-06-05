/**
 * FaceGuard Offline – Face Engine (Pure TypeScript)
 * Cosine similarity, L2 normalisation, CLAHE, spoof detection.
 * No native dependencies — runs on any JS runtime.
 */

export interface EmployeeEmbedding { id: string; name: string; embedding: number[]; }
export interface MatchResult { employee: { id: string; name: string }; score: number; }
export interface SpoofScores { liveScore: number; depthScore: number; moireScore: number; }
export type SpoofType = 'live' | 'print_attack' | 'screen_replay' | 'unknown_spoof';

const EMBEDDING_DIM = 128;

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, nA = 0, nB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; nA += a[i]*a[i]; nB += b[i]*b[i]; }
  const d = Math.sqrt(nA) * Math.sqrt(nB);
  return d === 0 ? 0 : dot / d;
}

export function l2Normalise(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return n === 0 ? v : v.map(x => x / n);
}

export function matchEmbedding(probe: number[], gallery: EmployeeEmbedding[], threshold = 0.65): MatchResult | null {
  if (!gallery.length) return null;
  let best = -Infinity, bestE: EmployeeEmbedding | null = null;
  for (const e of gallery) {
    const s = cosineSimilarity(probe, e.embedding);
    if (s > best) { best = s; bestE = e; }
  }
  if (!bestE || best < threshold) return null;
  return { employee: { id: bestE.id, name: bestE.name }, score: best };
}

export function averageEmbeddings(embs: number[][]): number[] {
  if (!embs.length) return [];
  if (embs.length === 1) return [...embs[0]];
  const dim = embs[0].length, avg = new Array(dim).fill(0);
  for (const e of embs) for (let i = 0; i < dim; i++) avg[i] += e[i];
  for (let i = 0; i < dim; i++) avg[i] /= embs.length;
  return avg;
}

export function detectSpoofType(s: SpoofScores): SpoofType {
  if (s.liveScore > 0.8 && s.depthScore > 0.5) return 'live';
  if (s.liveScore < 0.3 && s.depthScore < 0.2) return 'print_attack';
  if (s.liveScore < 0.5 && s.moireScore > 0.6) return 'screen_replay';
  return 'unknown_spoof';
}

export function applyCLAHE(data: Uint8Array, w: number, h: number, clip = 2.0, tile = 8): Uint8Array {
  const out = new Uint8Array(data.length);
  const tX = Math.ceil(w/tile), tY = Math.ceil(h/tile);
  for (let ty = 0; ty < tY; ty++) {
    for (let tx = 0; tx < tX; tx++) {
      const x0 = tx*tile, y0 = ty*tile;
      const x1 = Math.min(x0+tile, w), y1 = Math.min(y0+tile, h);
      const hist = new Uint32Array(256);
      let pc = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { hist[data[y*w+x]]++; pc++; }
      const cc = Math.floor(clip * pc / 256);
      let ex = 0;
      for (let i = 0; i < 256; i++) { if (hist[i] > cc) { ex += hist[i]-cc; hist[i] = cc; } }
      const inc = Math.floor(ex/256);
      for (let i = 0; i < 256; i++) hist[i] += inc;
      const cdf = new Uint32Array(256); cdf[0] = hist[0];
      for (let i = 1; i < 256; i++) cdf[i] = cdf[i-1]+hist[i];
      const cMin = cdf[0], cR = pc - cMin, lut = new Uint8Array(256);
      for (let i = 0; i < 256; i++) lut[i] = cR === 0 ? i : Math.round(((cdf[i]-cMin)/cR)*255);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) out[y*w+x] = lut[data[y*w+x]];
    }
  }
  return out;
}

/** Generate a deterministic pseudo-random embedding for simulation */
export function generateTestEmbedding(seed: number): number[] {
  const emb = new Array(EMBEDDING_DIM);
  let s = seed;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    emb[i] = (s / 0x7fffffff) * 2 - 1;
  }
  return l2Normalise(emb);
}
