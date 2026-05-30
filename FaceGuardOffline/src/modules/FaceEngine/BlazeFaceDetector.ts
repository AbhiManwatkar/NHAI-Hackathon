import TFLiteBridge from './NativeBridge';
import {
  CameraFrame,
  DetectionResult,
  FaceDetection,
  FaceEngineConfig,
  FaceEngineState,
} from './types';

export class BlazeFaceDetector {
  private state: FaceEngineState = FaceEngineState.UNINITIALIZED;

  constructor(_config: Partial<FaceEngineConfig> = {}) {}

  async initialize(): Promise<void> {
    if (this.state === FaceEngineState.READY) {
      return;
    }
    await TFLiteBridge.loadModel('blazeface.tflite');
    this.state = FaceEngineState.READY;
  }

  async detect(frame: CameraFrame | string): Promise<DetectionResult> {
    if (this.state !== FaceEngineState.READY) {
      await this.initialize();
    }

    if (typeof frame !== 'string') {
      return {
        detections: [],
        faceCount: 0,
        inferenceTimeMs: 0,
        frameWidth: frame.width,
        frameHeight: frame.height,
        timestamp: frame.timestamp,
      };
    }

    const result = await TFLiteBridge.runBlazeFace(frame);
    const timestamp = Date.now();
    const detection: FaceDetection[] =
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
        : [];

    return {
      detections: detection,
      faceCount: detection.length,
      inferenceTimeMs: result.inferenceMs ?? 0,
      frameWidth: result.frameWidth ?? 0,
      frameHeight: result.frameHeight ?? 0,
      timestamp,
    };
  }

  async release(): Promise<void> {
    this.state = FaceEngineState.RELEASED;
  }

  getState(): FaceEngineState {
    return this.state;
  }
}
