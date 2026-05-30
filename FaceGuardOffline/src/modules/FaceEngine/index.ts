import Benchmark from '../../utils/benchmark';
import TFLiteBridge, {
  BBox,
  FaceDetectionResult,
  FrameBase64,
  LivenessResult,
} from './NativeBridge';
import {
  CameraFrame,
  DetectionResult,
  FaceEmbedding,
  KnownEmbedding,
  RecognitionResult,
} from './types';

export interface FullPipelineResult {
  faceDetected: boolean;
  bbox: BBox | null;
  embedding: number[] | null;
  liveness: LivenessResult | null;
  totalMs: number;
}

const MODEL_NAMES = ['blazeface.tflite', 'mobilefacenet_int8.tflite', 'minifasnet.tflite'] as const;

export class FaceEngine {
  private static initialized = false;

  readonly detector = {
    detect: async (frame: CameraFrame | FrameBase64): Promise<DetectionResult> => {
      if (typeof frame === 'string') {
        const result = await FaceEngine.detectFace(frame);
        return FaceEngine.toLegacyDetectionResult(result);
      }
      return FaceEngine.emptyLegacyDetectionResult(frame);
    },
  };

  static async initialize(): Promise<void> {
    if (FaceEngine.initialized) {
      return;
    }

    await Benchmark.measure('faceengine_initialize', async () => {
      try {
        await Promise.all(MODEL_NAMES.map((modelName) => TFLiteBridge.loadModel(modelName)));
        FaceEngine.initialized = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`FaceGuard offline AI could not start. ${message}`);
      }
    });
  }

  static async detectFace(frame: FrameBase64): Promise<FaceDetectionResult> {
    await FaceEngine.initialize();
    return TFLiteBridge.runBlazeFace(frame);
  }

  static async getEmbedding(croppedFace: FrameBase64): Promise<number[]> {
    await FaceEngine.initialize();
    const result = await TFLiteBridge.runMobileFaceNet(croppedFace);
    return result.embedding;
  }

  static async checkPassiveLiveness(face: FrameBase64): Promise<LivenessResult> {
    await FaceEngine.initialize();
    return TFLiteBridge.runMiniFASNet(face);
  }

  static async runFullPipeline(frame: FrameBase64): Promise<FullPipelineResult> {
    await FaceEngine.initialize();
    const startedAt = performance.now();

    return Benchmark.measure('faceengine_full_pipeline', async () => {
      const face = await FaceEngine.detectFace(frame);
      if (!face.detected) {
        return {
          faceDetected: false,
          bbox: null,
          embedding: null,
          liveness: null,
          totalMs: performance.now() - startedAt,
        };
      }

      const [embedding, liveness] = await Promise.all([
        FaceEngine.getEmbedding(frame),
        FaceEngine.checkPassiveLiveness(frame),
      ]);
      const totalMs = performance.now() - startedAt;

      if (totalMs > 900) {
        console.warn(`[FaceEngine] Full pipeline exceeded 900ms budget: ${totalMs.toFixed(1)}ms`);
      }

      return {
        faceDetected: true,
        bbox: face.bbox,
        embedding,
        liveness,
        totalMs,
      };
    });
  }

  private static toLegacyDetectionResult(result: FaceDetectionResult): DetectionResult {
    const timestamp = Date.now();
    return {
      detections:
        result.detected && result.bbox
          ? [
              {
                id: `native_${timestamp}`,
                bbox: result.bbox,
                landmarks: {
                  rightEye: result.keypoints[0] ?? { x: 0, y: 0 },
                  leftEye: result.keypoints[1] ?? { x: 0, y: 0 },
                  noseTip: result.keypoints[2] ?? { x: 0, y: 0 },
                  mouthCenter: result.keypoints[3] ?? { x: 0, y: 0 },
                  rightEar: result.keypoints[4] ?? { x: 0, y: 0 },
                  leftEar: result.keypoints[5] ?? { x: 0, y: 0 },
                },
                confidence: result.confidence ?? 0,
                timestamp,
              },
            ]
          : [],
      faceCount: result.detected ? 1 : 0,
      inferenceTimeMs: result.inferenceMs ?? 0,
      frameWidth: result.frameWidth ?? 0,
      frameHeight: result.frameHeight ?? 0,
      timestamp,
    };
  }

  private static emptyLegacyDetectionResult(frame: CameraFrame): DetectionResult {
    return {
      detections: [],
      faceCount: 0,
      inferenceTimeMs: 0,
      frameWidth: frame.width,
      frameHeight: frame.height,
      timestamp: frame.timestamp,
    };
  }

  async initialize(): Promise<void> {
    return FaceEngine.initialize();
  }

  async detectFace(frame: FrameBase64): Promise<FaceDetectionResult> {
    return FaceEngine.detectFace(frame);
  }

  async getEmbedding(croppedFace: FrameBase64): Promise<number[]> {
    return FaceEngine.getEmbedding(croppedFace);
  }

  async checkPassiveLiveness(face: FrameBase64): Promise<LivenessResult> {
    return FaceEngine.checkPassiveLiveness(face);
  }

  async runFullPipeline(frame: FrameBase64): Promise<FullPipelineResult> {
    return FaceEngine.runFullPipeline(frame);
  }

  async detectAndRecognize(
    frame: CameraFrame | FrameBase64,
    _knownEmbeddings: KnownEmbedding[],
  ): Promise<RecognitionResult[]> {
    if (typeof frame !== 'string') {
      return [];
    }

    const pipeline = await FaceEngine.runFullPipeline(frame);
    if (!pipeline.faceDetected || !pipeline.bbox || !pipeline.embedding) {
      return [];
    }

    return [];
  }

  async enrollFace(frame: CameraFrame | FrameBase64): Promise<FaceEmbedding> {
    if (typeof frame !== 'string') {
      throw new Error('Native FaceEngine enrollment expects a base64 JPEG face frame.');
    }

    const vector = new Float32Array(await FaceEngine.getEmbedding(frame));
    return {
      vector,
      timestamp: Date.now(),
      quality: 1,
      sourceDetectionId: 'native_enrollment',
    };
  }

  async release(): Promise<void> {
    FaceEngine.initialized = false;
  }
}

export * from './NativeBridge';
export * from './types';
export * from './Preprocessor';
export * from './FaceCropper';
export * from './EmbeddingMatcher';
export * from './FullPipeline';
export * from './BlazeFaceDetector';
export * from './MobileFaceNet';
