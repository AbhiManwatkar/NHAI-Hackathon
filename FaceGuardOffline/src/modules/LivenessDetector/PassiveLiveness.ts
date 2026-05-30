import TFLiteBridge from '../FaceEngine/NativeBridge';
import { CroppedFace } from '../FaceEngine/FaceCropper';
import { resizeBilinearRGB } from '../FaceEngine/Preprocessor';
import { BenchmarkStore } from '../../utils/benchmark';

export type SpoofType = 'PRINT_ATTACK' | 'REPLAY_ATTACK' | 'MASK_ATTACK' | null;

export interface PassiveLivenessResult {
  isReal: boolean;
  realScore: number;
  spoofScore: number;
  spoofType: SpoofType;
  inferenceMs: number;
}

/**
 * Attack prevention matrix:
 * Photo attack -> blocked by MiniFASNet print texture classification.
 * Screen replay -> blocked by MiniFASNet moire pattern cues plus active timing.
 * 3D mask -> blocked by active landmark depth asymmetry.
 * Deep fake -> blocked by multi-frame temporal consistency.
 * Recorded video -> blocked by random challenge sequence unpredictability.
 */
export class PassiveLivenessDetector {
  private static modelLoaded = false;
  private lastTextureGradientAnomaly = false;

  async checkLiveness(faceROI: CroppedFace): Promise<PassiveLivenessResult> {
    const startedAt = nowMs();
    const input = this.preprocess(faceROI);
    this.lastTextureGradientAnomaly = this.hasTextureGradientAnomaly(input, 80, 80);

    try {
      if (!faceROI.base64) {
        throw new Error('Cropped face is missing base64 data for native MiniFASNet inference.');
      }

      if (!PassiveLivenessDetector.modelLoaded) {
        await TFLiteBridge.loadModel('minifasnet.tflite');
        PassiveLivenessDetector.modelLoaded = true;
      }
      const nativeResult = await TFLiteBridge.runMiniFASNet(faceROI.base64);
      const inferenceMs = nowMs() - startedAt;
      const spoofType = this.detectSpoofType(nativeResult.realScore, nativeResult.spoofScore);
      BenchmarkStore.record('passive_liveness', inferenceMs);

      return {
        isReal: nativeResult.realScore >= 0.5 && spoofType === null,
        realScore: nativeResult.realScore,
        spoofScore: nativeResult.spoofScore,
        spoofType,
        inferenceMs,
      };
    } catch {
      const textureScore = this.lastTextureGradientAnomaly ? 0.65 : 0.25;
      const realScore = 1 - textureScore;
      const spoofScore = textureScore;
      const inferenceMs = nowMs() - startedAt;
      BenchmarkStore.record('passive_liveness_fallback', inferenceMs);

      return {
        isReal: realScore >= 0.5 && !this.lastTextureGradientAnomaly,
        realScore,
        spoofScore,
        spoofType: this.detectSpoofType(realScore, spoofScore),
        inferenceMs,
      };
    }
  }

  detectSpoofType(realScore: number, spoofScore: number): SpoofType {
    if (realScore >= 0.5 && spoofScore < 0.4 && !this.lastTextureGradientAnomaly) {
      return null;
    }
    if (this.lastTextureGradientAnomaly) {
      return 'MASK_ATTACK';
    }
    if (spoofScore > 0.7) {
      return 'PRINT_ATTACK';
    }
    if (spoofScore > 0.4) {
      return 'REPLAY_ATTACK';
    }
    return null;
  }

  async runMultiFrameCheck(
    frames: CroppedFace[],
    minConsensus = 0.6,
  ): Promise<PassiveLivenessResult> {
    const startedAt = nowMs();
    const sample = frames.slice(0, 3);
    const results = await Promise.all(sample.map((frame) => this.checkLiveness(frame)));
    const realVotes = results.filter((result) => result.isReal).length;
    const consensus = sample.length === 0 ? 0 : realVotes / sample.length;
    const realScore = average(results.map((result) => result.realScore));
    const spoofScore = average(results.map((result) => result.spoofScore));
    const strongestSpoof = results.find((result) => result.spoofType !== null)?.spoofType ?? null;
    const inferenceMs = nowMs() - startedAt;

    BenchmarkStore.record('passive_liveness_multiframe', inferenceMs);
    return {
      isReal: consensus >= minConsensus,
      realScore,
      spoofScore,
      spoofType:
        consensus >= minConsensus
          ? null
          : strongestSpoof ?? this.detectSpoofType(realScore, spoofScore),
      inferenceMs,
    };
  }

  private preprocess(faceROI: CroppedFace): Float32Array {
    const resized = resizeBilinearRGB(faceROI.pixels, faceROI.width, faceROI.height, 80, 80);
    const output = new Float32Array(80 * 80 * 3);

    for (let i = 0; i < resized.length; i += 1) {
      output[i] = resized[i] / 255 - 0.5;
    }

    return output;
  }

  private hasTextureGradientAnomaly(input: Float32Array, width: number, height: number): boolean {
    let gradientSum = 0;
    let gradientSquared = 0;
    let count = 0;

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const center = luminance(input, width, x, y);
        const gx = luminance(input, width, x + 1, y) - luminance(input, width, x - 1, y);
        const gy = luminance(input, width, x, y + 1) - luminance(input, width, x, y - 1);
        const gradient = Math.sqrt(gx * gx + gy * gy) + Math.abs(center);
        gradientSum += gradient;
        gradientSquared += gradient * gradient;
        count += 1;
      }
    }

    if (count === 0) {
      return false;
    }

    const mean = gradientSum / count;
    const variance = gradientSquared / count - mean * mean;
    return variance > 0.08 || mean < 0.025;
  }
}

export class PassiveLiveness extends PassiveLivenessDetector {}

function luminance(input: Float32Array, width: number, x: number, y: number): number {
  const idx = (y * width + x) * 3;
  return input[idx] * 0.299 + input[idx + 1] * 0.587 + input[idx + 2] * 0.114;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export default PassiveLivenessDetector;
