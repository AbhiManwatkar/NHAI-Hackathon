import { Personnel } from '../../types';

export type Employee = Personnel;

export interface EmployeeEmbedding {
  employee: Employee;
  embedding: number[];
}

export interface MatchResult {
  matched: boolean;
  employee: Employee | null;
  confidence: number;
  rank1Score: number;
}

const ACCEPT_THRESHOLD = 0.65;

export function cosineSimilarity(a: number[], b: number[]): number {
  const normA = l2Normalise(a);
  const normB = l2Normalise(b);
  const len = Math.min(normA.length, normB.length);
  let dot = 0;

  for (let i = 0; i < len; i += 1) {
    dot += normA[i] * normB[i];
  }

  return Math.max(-1, Math.min(1, dot));
}

export function l2Normalise(embedding: number[]): number[] {
  let sumSquared = 0;
  for (const value of embedding) {
    sumSquared += value * value;
  }

  const norm = Math.sqrt(sumSquared);
  if (norm < 1e-10) {
    return embedding.map(() => 0);
  }
  return embedding.map((value) => value / norm);
}

export function matchEmbedding(live: number[], database: EmployeeEmbedding[]): MatchResult {
  let best: EmployeeEmbedding | null = null;
  let rank1Score = -1;

  for (const candidate of database) {
    const score = cosineSimilarity(live, candidate.embedding);
    if (score > rank1Score) {
      rank1Score = score;
      best = candidate;
    }
  }

  const matched = best !== null && rank1Score >= ACCEPT_THRESHOLD;
  return {
    matched,
    employee: matched ? best!.employee : null,
    confidence: matched ? rank1Score : Math.max(0, rank1Score),
    rank1Score: Math.max(0, rank1Score),
  };
}

export function averageEmbeddings(embeddings: number[][]): number[] {
  if (embeddings.length === 0) {
    return [];
  }

  const dimensions = embeddings[0].length;
  const averaged = new Array<number>(dimensions).fill(0);
  for (const embedding of embeddings) {
    for (let i = 0; i < dimensions; i += 1) {
      averaged[i] += embedding[i] ?? 0;
    }
  }

  for (let i = 0; i < dimensions; i += 1) {
    averaged[i] /= embeddings.length;
  }
  return l2Normalise(averaged);
}

export function embeddingDistance(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let sumSquared = 0;

  for (let i = 0; i < len; i += 1) {
    const diff = a[i] - b[i];
    sumSquared += diff * diff;
  }

  return Math.sqrt(sumSquared);
}
