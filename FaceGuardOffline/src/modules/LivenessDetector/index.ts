import { CroppedFace } from '../FaceEngine/FaceCropper';
import PassiveLivenessDetector from './PassiveLiveness';
import ActiveLiveness, { ActiveChallengeProgress, Observable } from './ActiveLiveness';
import { Landmark } from './LandmarkProcessor';
import { BenchmarkStore } from '../../utils/benchmark';
import { CameraFrame, FaceDetection } from '../FaceEngine/types';
import { LivenessChallenge, LivenessResult } from '../../types';

export interface LivenessDecision {
  passed: boolean;
  passiveScore: number;
  activeChallengesComplete: number;
  blockedByLayer: 'PASSIVE' | 'ACTIVE' | null;
  totalMs: number;
}

export async function runDualLayerLiveness(
  faceROI: CroppedFace,
  landmarkStream: Observable<Landmark[]>,
): Promise<LivenessDecision> {
  const startedAt = nowMs();
  const passiveDetector = new PassiveLivenessDetector();
  const activeDetector = new ActiveLiveness(landmarkStream);

  const [passive, active] = await Promise.all([
    passiveDetector.checkLiveness(faceROI),
    activeDetector.runChallengeSequence(2),
  ]);

  const totalMs = nowMs() - startedAt;
  BenchmarkStore.record('dual_layer_liveness', totalMs);

  return {
    passed: passive.isReal && active.passed,
    passiveScore: passive.realScore,
    activeChallengesComplete: active.challengesCompleted.length,
    blockedByLayer: !passive.isReal ? 'PASSIVE' : !active.passed ? 'ACTIVE' : null,
    totalMs,
  };
}

export class LivenessDetector {
  private activeDetector = new ActiveLiveness();

  async initialize(): Promise<void> {
    await Promise.resolve();
  }

  async runDualLayerLiveness(
    faceROI: CroppedFace,
    landmarkStream: Observable<Landmark[]>,
  ): Promise<LivenessDecision> {
    return runDualLayerLiveness(faceROI, landmarkStream);
  }

  async performPassiveCheck(frame: CameraFrame, detection: FaceDetection): Promise<LivenessResult> {
    const passive = new PassiveLivenessDetector();
    const faceROI = faceDetectionToCroppedFace(frame, detection);
    const result = await passive.checkLiveness(faceROI);

    return {
      isLive: result.isReal,
      score: result.realScore,
      challengesAttempted: [LivenessChallenge.PASSIVE_TEXTURE],
      challengesPassed: result.isReal ? [LivenessChallenge.PASSIVE_TEXTURE] : [],
      failureReason: result.isReal
        ? null
        : `Blocked spoof attempt: ${result.spoofType ?? 'UNKNOWN'}`,
      checkedAt: new Date().toISOString(),
    };
  }

  getActiveProgress(detection: FaceDetection): ActiveChallengeProgress {
    return this.activeDetector.processFrame(detection);
  }

  startActiveChallenge(challenge: LivenessChallenge | string): void {
    this.activeDetector.startChallenge(String(challenge), 10000);
  }

  resetActiveChallenge(): void {
    this.activeDetector.resetChallengeState();
  }

  async release(): Promise<void> {
    this.resetActiveChallenge();
  }
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function faceDetectionToCroppedFace(frame: CameraFrame, detection: FaceDetection): CroppedFace {
  const channels = frame.channels ?? 3;
  const x0 = Math.max(0, Math.floor(detection.bbox.x * frame.width));
  const y0 = Math.max(0, Math.floor(detection.bbox.y * frame.height));
  const x1 = Math.min(
    frame.width,
    Math.ceil((detection.bbox.x + detection.bbox.width) * frame.width),
  );
  const y1 = Math.min(
    frame.height,
    Math.ceil((detection.bbox.y + detection.bbox.height) * frame.height),
  );
  const width = Math.max(1, x1 - x0);
  const height = Math.max(1, y1 - y0);
  const pixels = new Uint8Array(width * height * 3);
  let dst = 0;

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const src = (y * frame.width + x) * channels;
      pixels[dst] = frame.data[src] ?? 0;
      pixels[dst + 1] = frame.data[src + 1] ?? 0;
      pixels[dst + 2] = frame.data[src + 2] ?? 0;
      dst += 3;
    }
  }

  return {
    pixels,
    width,
    height,
    bbox: detection.bbox,
  };
}

export * from './PassiveLiveness';
export * from './LandmarkProcessor';
export * from './ActiveLiveness';
