export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface HeadPose {
  yaw: number;
  pitch: number;
  roll: number;
}

export function computeEAR(landmarks: Landmark[], eyeIndices: number[]): number {
  if (eyeIndices.length < 6) {
    return 0;
  }

  const [p1, p2, p3, p4, p5, p6] = eyeIndices.map((index) => landmarks[index]);
  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) {
    return 0;
  }

  const verticalA = distance2D(p2, p6);
  const verticalB = distance2D(p3, p5);
  const horizontal = distance2D(p1, p4);
  return horizontal < 1e-6 ? 0 : (verticalA + verticalB) / (2 * horizontal);
}

export function computeHeadPose(landmarks: Landmark[]): HeadPose {
  const leftEye = pick(landmarks, [33, leftFallback()]);
  const rightEye = pick(landmarks, [263, rightFallback()]);
  const nose = pick(landmarks, [1, 4, 168]);
  const mouth = pick(landmarks, [13, 14, 0]);
  const leftCheek = pick(landmarks, [234, 93]);
  const rightCheek = pick(landmarks, [454, 323]);

  if (!leftEye || !rightEye || !nose || !mouth) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }

  const eyeDx = rightEye.x - leftEye.x;
  const eyeDy = rightEye.y - leftEye.y;
  const roll = radiansToDegrees(Math.atan2(eyeDy, eyeDx));
  const eyeCenter = midpoint(leftEye, rightEye);
  const faceWidth =
    leftCheek && rightCheek
      ? distance2D(leftCheek, rightCheek)
      : distance2D(leftEye, rightEye) * 1.8;
  const yaw = clamp(((nose.x - eyeCenter.x) / Math.max(faceWidth, 1e-6)) * 95, -45, 45);
  const eyeToMouth = Math.max(distance2D(eyeCenter, mouth), 1e-6);
  const noseOffset = (nose.y - eyeCenter.y) / eyeToMouth;
  const pitch = clamp((noseOffset - 0.42) * 70, -35, 35);

  return { yaw, pitch, roll };
}

export function computeMAR(landmarks: Landmark[]): number {
  const leftMouth = landmarks[61] ?? landmarks[0];
  const rightMouth = landmarks[291] ?? landmarks[1];
  const upperLip = landmarks[13] ?? landmarks[2];
  const lowerLip = landmarks[14] ?? landmarks[3];

  if (!leftMouth || !rightMouth || !upperLip || !lowerLip) {
    return 0;
  }

  const vertical = distance2D(upperLip, lowerLip);
  const horizontal = distance2D(leftMouth, rightMouth);
  return horizontal < 1e-6 ? 0 : vertical / horizontal;
}

export function isBlinking(earHistory: number[]): boolean {
  let consecutiveClosed = 0;
  let reopened = false;

  for (const ear of earHistory) {
    if (ear < 0.25) {
      consecutiveClosed += 1;
    } else if (consecutiveClosed >= 2) {
      reopened = true;
    }
  }

  return consecutiveClosed >= 2 && reopened;
}

export function isTurningLeft(poseHistory: HeadPose[]): boolean {
  return poseHistory.some((pose) => pose.yaw < -20);
}

export function isTurningRight(poseHistory: HeadPose[]): boolean {
  return poseHistory.some((pose) => pose.yaw > 20);
}

export function isSmiling(landmarks: Landmark[]): boolean {
  const mar = computeMAR(landmarks);
  const leftMouth = landmarks[61];
  const rightMouth = landmarks[291];
  const leftCheek = landmarks[205] ?? landmarks[50];
  const rightCheek = landmarks[425] ?? landmarks[280];
  const nose = landmarks[1] ?? landmarks[4];

  if (!leftMouth || !rightMouth || !leftCheek || !rightCheek || !nose) {
    return mar > 0.3;
  }

  const mouthCornerLift = nose.y - (leftMouth.y + rightMouth.y) / 2 > -0.04;
  const cheekElevated = (leftCheek.y + rightCheek.y) / 2 < nose.y + 0.08;
  return mar > 0.3 && cheekElevated && mouthCornerLift;
}

export function isNodding(poseHistory: HeadPose[]): boolean {
  return poseHistory.some((pose) => pose.pitch > 15);
}

function distance2D(a: Landmark, b: Landmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function midpoint(a: Landmark, b: Landmark): Landmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z ?? 0) + (b.z ?? 0)) / 2,
  };
}

function pick(landmarks: Landmark[], indices: number[]): Landmark | undefined {
  return indices.map((index) => landmarks[index]).find(Boolean);
}

function leftFallback(): number {
  return 0;
}

function rightFallback(): number {
  return 1;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function clamp(value: number, minValue: number, maxValue: number): number {
  return Math.max(minValue, Math.min(maxValue, value));
}
