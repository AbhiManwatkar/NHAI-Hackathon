import { BenchmarkStore } from '../../utils/benchmark';
import { AttendanceRecord, Personnel } from '../../types';
import TFLiteBridge, { BBox } from './NativeBridge';
import {
  applyCLAHE,
  convertLABToRGB,
  convertRGBToLAB,
  gammaCorrection,
  normaliseRGBForModel,
  replaceLChannel,
} from './Preprocessor';
import { cropFaceROI, FrameData, validateFaceQuality } from './FaceCropper';
import { EmployeeEmbedding, MatchResult, matchEmbedding } from './EmbeddingMatcher';

export interface BiometricVault {
  getEmbeddings?: () => Promise<EmployeeEmbedding[]>;
  searchByEmbedding?: (
    embedding: number[],
    threshold: number,
  ) => Promise<{ personnel: Personnel; similarity: number } | null>;
  recordAttendance?: (
    personnelId: string | null,
    personnelName: string,
    confidence: number,
    livenessScore: number,
    method: 'face_recognition' | 'manual_override',
    location: { latitude: number; longitude: number; accuracy: number } | null,
    deviceId: string,
  ) => Promise<AttendanceRecord>;
  logAttendance?: (
    employee: Personnel,
    confidence: number,
    livenessScore: number,
  ) => Promise<unknown>;
}

export interface AttendancePipelineResult {
  success: boolean;
  employee: Personnel | null;
  confidence: number;
  livenessScore: number;
  inferenceMs: number;
  step: string;
  failReason: string | null;
  timings: Record<string, number>;
}

const MATCH_THRESHOLD = 0.65;
const MODEL_NAMES = ['blazeface.tflite', 'mobilefacenet_int8.tflite', 'minifasnet.tflite'] as const;

let modelsLoaded = false;

export async function runAttendancePipeline(
  frame: FrameData,
  db: BiometricVault,
): Promise<AttendancePipelineResult> {
  const pipelineStart = nowMs();
  const timings: Record<string, number> = {};

  try {
    await measureStepAsync(timings, 'loadModels', ensureModelsLoaded);

    const firstQuality = measureStep(timings, 'quality_initial', () =>
      validateFaceQuality({ x: 0.25, y: 0.2, width: 0.5, height: 0.6 }, frame),
    );

    if (!firstQuality.isWellLit || !firstQuality.isSharp) {
      return failure(
        'quality_initial',
        firstQuality.failReason ?? 'Improve lighting',
        timings,
        pipelineStart,
      );
    }

    const detection = await measureStepAsync(timings, 'detectFace', async () => {
      const input = requireBase64(frame);
      return TFLiteBridge.runBlazeFace(input);
    });

    if (!detection.detected || !detection.bbox) {
      return failure('detectFace', 'No face detected', timings, pipelineStart);
    }

    const faceQuality = measureStep(timings, 'validateFaceQuality', () =>
      validateFaceQuality(detection.bbox as BBox, frame),
    );
    if (!faceQuality.qualityPassed) {
      return failure(
        'validateFaceQuality',
        faceQuality.failReason ?? 'Face quality check failed',
        timings,
        pipelineStart,
      );
    }

    const crop = measureStep(timings, 'cropFaceROI', () =>
      cropFaceROI(frame, detection.bbox as BBox, 0.2),
    );

    const enhancedFace = measureStep(timings, 'applyCLAHE', () => {
      const gammaCorrected = gammaCorrection(crop.pixels, 0.8);
      const lab = convertRGBToLAB(gammaCorrected, crop.width, crop.height);
      const lChannel = extractLChannel(lab);
      const enhancedL = applyCLAHE(lChannel, crop.width, crop.height, 2.0, 8);
      return convertLABToRGB(replaceLChannel(lab, enhancedL), crop.width, crop.height);
    });

    measureStep(timings, 'normaliseForModel', () =>
      normaliseRGBForModel(enhancedFace, crop.width, crop.height, 112, 112),
    );

    const facePayload = crop.base64 ?? requireBase64(frame);
    const liveness = await measureStepAsync(timings, 'checkPassiveLiveness', () =>
      TFLiteBridge.runMiniFASNet(facePayload),
    );

    if (!liveness.isReal) {
      return failure(
        'checkPassiveLiveness',
        'Liveness failed',
        timings,
        pipelineStart,
        liveness.realScore,
      );
    }

    const embedding = await measureStepAsync(timings, 'getEmbedding', () =>
      TFLiteBridge.runMobileFaceNet(facePayload).then((result) => result.embedding),
    );

    const match = await measureStepAsync(timings, 'matchEmbedding', () =>
      resolveMatch(embedding, db),
    );

    if (!match.matched || !match.employee) {
      return failure(
        'matchEmbedding',
        'No enrolled match found',
        timings,
        pipelineStart,
        liveness.realScore,
      );
    }

    await measureStepAsync(timings, 'logAttendance', async () => {
      if (db.logAttendance) {
        await db.logAttendance(match.employee!, match.confidence, liveness.realScore);
        return;
      }
      if (db.recordAttendance) {
        await db.recordAttendance(
          match.employee!.id,
          match.employee!.name,
          match.confidence,
          liveness.realScore,
          'face_recognition',
          null,
          'offline-device',
        );
      }
    });

    const inferenceMs = nowMs() - pipelineStart;
    BenchmarkStore.record('pipeline_total', inferenceMs);
    return {
      success: true,
      employee: match.employee,
      confidence: match.confidence,
      livenessScore: liveness.realScore,
      inferenceMs,
      step: 'complete',
      failReason: null,
      timings,
    };
  } catch (error) {
    return failure(
      'error',
      error instanceof Error ? error.message : 'Pipeline failed',
      timings,
      pipelineStart,
    );
  }
}

async function ensureModelsLoaded(): Promise<void> {
  if (modelsLoaded) {
    return;
  }

  await Promise.all(MODEL_NAMES.map((modelName) => TFLiteBridge.loadModel(modelName)));
  modelsLoaded = true;
}

async function resolveMatch(embedding: number[], db: BiometricVault): Promise<MatchResult> {
  if (db.getEmbeddings) {
    return matchEmbedding(embedding, await db.getEmbeddings());
  }

  if (db.searchByEmbedding) {
    const result = await db.searchByEmbedding(embedding, MATCH_THRESHOLD);
    return {
      matched: result !== null,
      employee: result?.personnel ?? null,
      confidence: result?.similarity ?? 0,
      rank1Score: result?.similarity ?? 0,
    };
  }

  return {
    matched: false,
    employee: null,
    confidence: 0,
    rank1Score: 0,
  };
}

function extractLChannel(lab: Float32Array): Float32Array {
  const lChannel = new Float32Array(lab.length / 3);
  for (let i = 0; i < lChannel.length; i += 1) {
    lChannel[i] = lab[i * 3];
  }
  return lChannel;
}

function failure(
  step: string,
  failReason: string,
  timings: Record<string, number>,
  pipelineStart: number,
  livenessScore = 0,
): AttendancePipelineResult {
  const inferenceMs = nowMs() - pipelineStart;
  BenchmarkStore.record('pipeline_total', inferenceMs);
  return {
    success: false,
    employee: null,
    confidence: 0,
    livenessScore,
    inferenceMs,
    step,
    failReason,
    timings,
  };
}

function measureStep<T>(timings: Record<string, number>, label: string, fn: () => T): T {
  const started = nowMs();
  try {
    return fn();
  } finally {
    const ms = nowMs() - started;
    timings[label] = ms;
    BenchmarkStore.record(label, ms);
  }
}

async function measureStepAsync<T>(
  timings: Record<string, number>,
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  const started = nowMs();
  try {
    return await fn();
  } finally {
    const ms = nowMs() - started;
    timings[label] = ms;
    BenchmarkStore.record(label, ms);
  }
}

function requireBase64(frame: FrameData): string {
  if (!frame.base64) {
    throw new Error('Frame is missing base64 JPEG data required for native TFLite inference.');
  }
  return frame.base64;
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
