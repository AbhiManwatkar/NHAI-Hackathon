import TFLiteBridge from './NativeBridge';
import {
  CameraFrame,
  FaceDetection,
  FaceEmbedding,
  FaceEngineConfig,
  FaceEngineState,
} from './types';

export class MobileFaceNet {
  private state: FaceEngineState = FaceEngineState.UNINITIALIZED;

  constructor(_config: Partial<FaceEngineConfig> = {}) {}

  async initialize(): Promise<void> {
    if (this.state === FaceEngineState.READY) {
      return;
    }
    await TFLiteBridge.loadModel('mobilefacenet_int8.tflite');
    this.state = FaceEngineState.READY;
  }

  async extractEmbedding(
    frame: CameraFrame | string,
    detection?: FaceDetection,
  ): Promise<FaceEmbedding> {
    if (this.state !== FaceEngineState.READY) {
      await this.initialize();
    }
    if (typeof frame !== 'string') {
      throw new Error('MobileFaceNet native bridge expects a base64 JPEG face crop.');
    }

    const result = await TFLiteBridge.runMobileFaceNet(frame);
    return {
      vector: new Float32Array(result.embedding),
      timestamp: Date.now(),
      quality: 1,
      sourceDetectionId: detection?.id ?? 'native_bridge',
    };
  }

  computeDistance(embedding1: FaceEmbedding, embedding2: FaceEmbedding): number {
    return this.computeVectorDistance(embedding1.vector, embedding2.vector);
  }

  computeVectorDistance(vec1: Float32Array, vec2: Float32Array): number {
    return 1 - this.computeSimilarity(vec1, vec2);
  }

  computeSimilarity(vec1: Float32Array, vec2: Float32Array): number {
    const len = Math.min(vec1.length, vec2.length);
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < len; i += 1) {
      dot += vec1[i] * vec2[i];
      normA += vec1[i] * vec1[i];
      normB += vec2[i] * vec2[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator < 1e-10 ? 0 : dot / denominator;
  }

  isMatch(embedding1: FaceEmbedding, embedding2: FaceEmbedding): boolean {
    return this.computeDistance(embedding1, embedding2) < 0.6;
  }

  async release(): Promise<void> {
    this.state = FaceEngineState.RELEASED;
  }

  getState(): FaceEngineState {
    return this.state;
  }
}
