import { NativeModules, Platform } from 'react-native';
import Benchmark from '../../utils/benchmark';

const MAX_RETRIES = 3;

export type FrameBase64 = string;

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface FaceDetectionResult {
  detected: boolean;
  bbox: BBox | null;
  keypoints: Point[];
  confidence?: number;
  inferenceMs?: number;
  frameWidth?: number;
  frameHeight?: number;
}

export interface EmbeddingResult {
  embedding: number[];
  inferenceMs: number;
}

export interface LivenessResult {
  isReal: boolean;
  realScore: number;
  spoofScore: number;
  spoofType: string | null;
  inferenceMs?: number;
}

interface NativeTFLiteModule {
  loadModel(modelName: string): Promise<string>;
  runBlazeFace(base64Frame: string): Promise<string>;
  runMobileFaceNet(base64Face: string): Promise<string>;
  runMiniFASNet(base64Face: string): Promise<string>;
}

const nativeModule = NativeModules.TFLiteModule as NativeTFLiteModule | undefined;

function getNativeModule(): NativeTFLiteModule {
  if (!nativeModule) {
    throw new Error(
      `FaceGuard native TFLite bridge is not linked on ${Platform.OS}. Rebuild the native app.`,
    );
  }
  return nativeModule;
}

function friendlyError(error: unknown, action: string): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(
    `${action} failed. Please retry or reinstall the offline model pack. ${message}`,
  );
}

async function withRetry<T>(action: string, operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRIES) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 80));
    }
  }
  throw friendlyError(lastError, action);
}

async function timed<T>(label: string, operation: () => Promise<T>): Promise<T> {
  Benchmark.startTimer(label);
  try {
    return await operation();
  } finally {
    const inferenceMs = Benchmark.endTimer(label);
    console.log(`[FaceEngine] ${label}: ${inferenceMs.toFixed(1)}ms`);
  }
}

function parseJson<T>(payload: string, action: string): T {
  try {
    return JSON.parse(payload) as T;
  } catch (error) {
    throw friendlyError(error, `${action} response parsing`);
  }
}

export const TFLiteBridge = {
  async loadModel(modelName: string): Promise<string> {
    return timed(`tflite_load_${modelName}`, () =>
      withRetry(`Loading ${modelName}`, () => getNativeModule().loadModel(modelName)),
    );
  },

  async runBlazeFace(base64Frame: FrameBase64): Promise<FaceDetectionResult> {
    const payload = await timed('tflite_blazeface', () =>
      withRetry('Face detection', () => getNativeModule().runBlazeFace(base64Frame)),
    );
    return parseJson<FaceDetectionResult>(payload, 'Face detection');
  },

  async runMobileFaceNet(base64Face: FrameBase64): Promise<EmbeddingResult> {
    const payload = await timed('tflite_mobilefacenet', () =>
      withRetry('Face embedding', () => getNativeModule().runMobileFaceNet(base64Face)),
    );
    return parseJson<EmbeddingResult>(payload, 'Face embedding');
  },

  async runMiniFASNet(base64Face: FrameBase64): Promise<LivenessResult> {
    const payload = await timed('tflite_minifasnet', () =>
      withRetry('Passive liveness', () => getNativeModule().runMiniFASNet(base64Face)),
    );
    return parseJson<LivenessResult>(payload, 'Passive liveness');
  },
} as const;

export default TFLiteBridge;
