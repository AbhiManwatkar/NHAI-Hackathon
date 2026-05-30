import {
  computeEAR,
  computeHeadPose,
  HeadPose,
  isBlinking,
  isNodding,
  isSmiling,
  isTurningLeft,
  isTurningRight,
  Landmark,
} from './LandmarkProcessor';
import { BenchmarkStore } from '../../utils/benchmark';
import { FaceDetection } from '../FaceEngine/types';

export type ActiveChallengeId = 'BLINK' | 'TURN_LEFT' | 'TURN_RIGHT' | 'SMILE' | 'NOD';

export interface ChallengeDefinition {
  id: ActiveChallengeId;
  instruction: string;
  timeoutMs: number;
}

export interface ActiveLivenessResult {
  passed: boolean;
  challengesCompleted: ActiveChallengeId[];
  challengesFailed: ActiveChallengeId[];
  totalMs: number;
  sequence: ChallengeDefinition[];
  failReason: 'TIMEOUT' | 'NO_LANDMARK_STREAM' | null;
}

export interface ActiveChallengeProgress {
  completed: boolean;
  progress: number;
  feedbackMessage: string;
}

export interface Observable<T> {
  subscribe(
    next: (value: T) => void,
    error?: (error: unknown) => void,
    complete?: () => void,
  ): { unsubscribe: () => void } | (() => void);
}

export const CHALLENGES: ChallengeDefinition[] = [
  { id: 'BLINK', instruction: 'Blink twice', timeoutMs: 4000 },
  { id: 'TURN_LEFT', instruction: 'Turn your head left', timeoutMs: 4000 },
  { id: 'TURN_RIGHT', instruction: 'Turn your head right', timeoutMs: 4000 },
  { id: 'SMILE', instruction: 'Give a smile', timeoutMs: 4000 },
  { id: 'NOD', instruction: 'Nod slowly', timeoutMs: 5000 },
];

export class ActiveLiveness {
  private landmarkStream: Observable<Landmark[]> | null;
  private currentChallenge: ActiveChallengeId | null = null;
  private challengeStartedAt = 0;
  private challengeTimeoutMs = 4000;
  private earHistory: number[] = [];
  private poseHistory: HeadPose[] = [];
  private smileFrames = 0;

  constructor(landmarkStream: Observable<Landmark[]> | null = null) {
    this.landmarkStream = landmarkStream;
  }

  setLandmarkStream(landmarkStream: Observable<Landmark[]>): void {
    this.landmarkStream = landmarkStream;
  }

  startChallenge(challenge: ActiveChallengeId | string, timeoutMs = 4000): void {
    this.currentChallenge = normalizeChallengeId(challenge);
    this.challengeStartedAt = Date.now();
    this.challengeTimeoutMs = timeoutMs;
    this.resetChallengeState();
  }

  resetChallengeState(): void {
    this.earHistory = [];
    this.poseHistory = [];
    this.smileFrames = 0;
  }

  processFrame(detection: FaceDetection): ActiveChallengeProgress {
    if (!this.currentChallenge) {
      return { completed: false, progress: 0, feedbackMessage: 'Waiting for challenge' };
    }
    if (Date.now() - this.challengeStartedAt > this.challengeTimeoutMs) {
      return { completed: false, progress: 0, feedbackMessage: 'Timeout. Please try again.' };
    }

    const landmarks = faceDetectionToLandmarks(detection);
    const pose = computeHeadPose(landmarks);
    this.poseHistory.push(pose);
    this.poseHistory = this.poseHistory.slice(-20);

    const ear = estimatedEARFromBlazeFace(detection);
    this.earHistory.push(ear);
    this.earHistory = this.earHistory.slice(-20);

    if (this.currentChallenge === 'SMILE' && isSmiling(landmarks)) {
      this.smileFrames += 1;
    }

    const completed =
      (this.currentChallenge === 'BLINK' && isBlinking(this.earHistory)) ||
      (this.currentChallenge === 'TURN_LEFT' && isTurningLeft(this.poseHistory)) ||
      (this.currentChallenge === 'TURN_RIGHT' && isTurningRight(this.poseHistory)) ||
      (this.currentChallenge === 'SMILE' && this.smileFrames >= 3) ||
      (this.currentChallenge === 'NOD' && isNodding(this.poseHistory));

    return {
      completed,
      progress: completed
        ? 1
        : estimateProgress(
            this.currentChallenge,
            this.earHistory,
            this.poseHistory,
            this.smileFrames,
          ),
      feedbackMessage: completed ? 'Verified' : challengeFeedback(this.currentChallenge),
    };
  }

  async runChallengeSequence(count = 2): Promise<ActiveLivenessResult> {
    const startedAt = nowMs();
    if (!this.landmarkStream) {
      return {
        passed: false,
        challengesCompleted: [],
        challengesFailed: [],
        totalMs: nowMs() - startedAt,
        sequence: [],
        failReason: 'NO_LANDMARK_STREAM',
      };
    }

    const sequence = pickRandomChallenges(Math.max(1, Math.min(count, CHALLENGES.length)));
    const challengesCompleted: ActiveChallengeId[] = [];
    const challengesFailed: ActiveChallengeId[] = [];

    for (const challenge of sequence) {
      const passed = await this.runSingleChallenge(challenge);
      if (!passed) {
        challengesFailed.push(challenge.id);
        const totalMs = nowMs() - startedAt;
        BenchmarkStore.record('active_liveness', totalMs);
        return {
          passed: false,
          challengesCompleted,
          challengesFailed,
          totalMs,
          sequence,
          failReason: 'TIMEOUT',
        };
      }
      challengesCompleted.push(challenge.id);
    }

    const totalMs = nowMs() - startedAt;
    BenchmarkStore.record('active_liveness', totalMs);
    return {
      passed: true,
      challengesCompleted,
      challengesFailed,
      totalMs,
      sequence,
      failReason: null,
    };
  }

  private runSingleChallenge(challenge: ChallengeDefinition): Promise<boolean> {
    return new Promise((resolve) => {
      const earHistory: number[] = [];
      const poseHistory: HeadPose[] = [];
      let blinkCount = 0;
      let blinkArmed = true;
      let cleanup = (): void => undefined;

      const timeout = setTimeout(() => {
        cleanup();
        resolve(false);
      }, challenge.timeoutMs);

      const subscription = this.landmarkStream!.subscribe((landmarks) => {
        const pose = computeHeadPose(landmarks);
        poseHistory.push(pose);
        if (poseHistory.length > 20) {
          poseHistory.shift();
        }

        const leftEAR = computeEAR(landmarks, [33, 160, 158, 133, 153, 144]);
        const rightEAR = computeEAR(landmarks, [263, 387, 385, 362, 380, 373]);
        const ear = (leftEAR + rightEAR) / 2;
        earHistory.push(ear);
        if (earHistory.length > 20) {
          earHistory.shift();
        }

        if (ear < 0.25 && blinkArmed) {
          blinkCount += 1;
          blinkArmed = false;
        }
        if (ear > 0.29) {
          blinkArmed = true;
        }

        const passed =
          (challenge.id === 'BLINK' && (blinkCount >= 2 || isBlinking(earHistory))) ||
          (challenge.id === 'TURN_LEFT' && isTurningLeft(poseHistory)) ||
          (challenge.id === 'TURN_RIGHT' && isTurningRight(poseHistory)) ||
          (challenge.id === 'SMILE' && isSmiling(landmarks)) ||
          (challenge.id === 'NOD' && isNodding(poseHistory));

        if (passed) {
          cleanup();
          resolve(true);
        }
      });

      cleanup = (): void => {
        clearTimeout(timeout);
        if (typeof subscription === 'function') {
          subscription();
        } else {
          subscription.unsubscribe();
        }
      };
    });
  }
}

function pickRandomChallenges(count: number): ChallengeDefinition[] {
  const pool = [...CHALLENGES];
  const selected: ChallengeDefinition[] = [];
  const randomBytes = new Uint32Array(pool.length);
  const runtimeCrypto = (globalThis as { crypto?: CryptoLike }).crypto;

  if (runtimeCrypto?.getRandomValues) {
    runtimeCrypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < randomBytes.length; i += 1) {
      randomBytes[i] = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    }
  }

  while (selected.length < count && pool.length > 0) {
    const random = randomBytes[selected.length] ?? Math.floor(Math.random() * 100000);
    const index = random % pool.length;
    selected.push(pool.splice(index, 1)[0]);
  }

  return selected;
}

function normalizeChallengeId(challenge: string): ActiveChallengeId {
  if (
    challenge === 'BLINK' ||
    challenge === 'TURN_LEFT' ||
    challenge === 'TURN_RIGHT' ||
    challenge === 'SMILE' ||
    challenge === 'NOD'
  ) {
    return challenge;
  }
  return 'BLINK';
}

function faceDetectionToLandmarks(detection: FaceDetection): Landmark[] {
  const { landmarks } = detection;
  const output: Landmark[] = [];
  output[33] = landmarks.leftEye;
  output[263] = landmarks.rightEye;
  output[1] = landmarks.noseTip;
  output[13] = landmarks.mouthCenter;
  output[14] = { x: landmarks.mouthCenter.x, y: landmarks.mouthCenter.y + 0.02 };
  output[61] = { x: landmarks.mouthCenter.x - 0.05, y: landmarks.mouthCenter.y };
  output[291] = { x: landmarks.mouthCenter.x + 0.05, y: landmarks.mouthCenter.y };
  output[234] = landmarks.leftEar;
  output[454] = landmarks.rightEar;
  output[205] = {
    x: (landmarks.leftEye.x + landmarks.mouthCenter.x) / 2,
    y: (landmarks.leftEye.y + landmarks.mouthCenter.y) / 2,
  };
  output[425] = {
    x: (landmarks.rightEye.x + landmarks.mouthCenter.x) / 2,
    y: (landmarks.rightEye.y + landmarks.mouthCenter.y) / 2,
  };
  return output;
}

function estimatedEARFromBlazeFace(detection: FaceDetection): number {
  const { landmarks } = detection;
  const eyeDistance = Math.sqrt(
    (landmarks.leftEye.x - landmarks.rightEye.x) ** 2 +
      (landmarks.leftEye.y - landmarks.rightEye.y) ** 2,
  );
  const noseEyeDistance =
    (Math.sqrt(
      (landmarks.leftEye.x - landmarks.noseTip.x) ** 2 +
        (landmarks.leftEye.y - landmarks.noseTip.y) ** 2,
    ) +
      Math.sqrt(
        (landmarks.rightEye.x - landmarks.noseTip.x) ** 2 +
          (landmarks.rightEye.y - landmarks.noseTip.y) ** 2,
      )) /
    2;
  return eyeDistance <= 1e-6
    ? 0.3
    : Math.max(0.15, Math.min(0.4, noseEyeDistance / eyeDistance / 2.6));
}

function estimateProgress(
  challenge: ActiveChallengeId,
  earHistory: number[],
  poseHistory: HeadPose[],
  smileFrames: number,
): number {
  if (challenge === 'BLINK') {
    return earHistory.some((ear) => ear < 0.25) ? 0.5 : 0.1;
  }
  if (challenge === 'TURN_LEFT') {
    return Math.max(
      0,
      Math.min(1, Math.abs(Math.min(0, ...poseHistory.map((pose) => pose.yaw))) / 20),
    );
  }
  if (challenge === 'TURN_RIGHT') {
    return Math.max(0, Math.min(1, Math.max(0, ...poseHistory.map((pose) => pose.yaw)) / 20));
  }
  if (challenge === 'SMILE') {
    return Math.min(1, smileFrames / 3);
  }
  return Math.max(0, Math.min(1, Math.max(0, ...poseHistory.map((pose) => pose.pitch)) / 15));
}

function challengeFeedback(challenge: ActiveChallengeId): string {
  const challengeItem = CHALLENGES.find((item) => item.id === challenge);
  return challengeItem?.instruction ?? 'Follow the prompt';
}

interface CryptoLike {
  getRandomValues<T extends Uint32Array>(array: T): T;
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export default ActiveLiveness;
