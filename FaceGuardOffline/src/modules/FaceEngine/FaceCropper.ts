import { BBox } from './NativeBridge';

export interface FrameData {
  pixels: Uint8Array;
  width: number;
  height: number;
  channels?: 3 | 4;
  base64?: string;
  timestamp?: number;
}

export interface CroppedFace {
  pixels: Uint8Array;
  width: number;
  height: number;
  bbox: BBox;
  base64?: string;
}

export interface FaceQualityReport {
  isCentred: boolean;
  faceAreaRatio: number;
  isSharp: boolean;
  sharpnessScore: number;
  isWellLit: boolean;
  brightnessScore: number;
  qualityPassed: boolean;
  failReason: string | null;
}

export function cropFaceROI(frame: FrameData, bbox: BBox, padding = 0.2): CroppedFace {
  const channels = frame.channels ?? 3;
  const left = bbox.x * frame.width;
  const top = bbox.y * frame.height;
  const faceW = bbox.width * frame.width;
  const faceH = bbox.height * frame.height;
  const padX = faceW * padding;
  const padY = faceH * padding;

  const cropX = clampInt(Math.floor(left - padX), 0, frame.width - 1);
  const cropY = clampInt(Math.floor(top - padY), 0, frame.height - 1);
  const cropRight = clampInt(Math.ceil(left + faceW + padX), cropX + 1, frame.width);
  const cropBottom = clampInt(Math.ceil(top + faceH + padY), cropY + 1, frame.height);
  const cropW = cropRight - cropX;
  const cropH = cropBottom - cropY;
  const pixels = new Uint8Array(cropW * cropH * 3);

  let dst = 0;
  for (let y = cropY; y < cropBottom; y += 1) {
    for (let x = cropX; x < cropRight; x += 1) {
      const src = (y * frame.width + x) * channels;
      pixels[dst] = frame.pixels[src] ?? 0;
      pixels[dst + 1] = frame.pixels[src + 1] ?? 0;
      pixels[dst + 2] = frame.pixels[src + 2] ?? 0;
      dst += 3;
    }
  }

  return {
    pixels,
    width: cropW,
    height: cropH,
    bbox: {
      x: cropX / frame.width,
      y: cropY / frame.height,
      width: cropW / frame.width,
      height: cropH / frame.height,
    },
    base64: frame.base64,
  };
}

export function validateFaceQuality(bbox: BBox, frame: FrameData): FaceQualityReport {
  const crop = cropFaceROI(frame, bbox, 0);
  const faceAreaRatio = bbox.width * bbox.height;
  const faceCenterX = bbox.x + bbox.width / 2;
  const faceCenterY = bbox.y + bbox.height / 2;
  const isCentred = Math.abs(faceCenterX - 0.5) <= 0.2 && Math.abs(faceCenterY - 0.5) <= 0.2;
  const sharpnessScore = computeLaplacianVariance(crop.pixels, crop.width, crop.height);
  const brightnessScore = computeMeanBrightness(crop.pixels);
  const isSharp = sharpnessScore > 80;
  const isWellLit = brightnessScore >= 40 && brightnessScore <= 220;
  let failReason: string | null = null;

  if (faceAreaRatio <= 0.08) {
    failReason = 'Move closer';
  } else if (!isCentred) {
    failReason = 'Centre your face';
  } else if (!isSharp) {
    failReason = 'Hold still';
  } else if (brightnessScore < 40) {
    failReason = 'Too dark';
  } else if (brightnessScore > 220) {
    failReason = 'Too bright';
  }

  return {
    isCentred,
    faceAreaRatio,
    isSharp,
    sharpnessScore,
    isWellLit,
    brightnessScore,
    qualityPassed: failReason === null,
    failReason,
  };
}

export function computeLaplacianVariance(pixels: Uint8Array, w: number, h: number): number {
  if (w < 3 || h < 3) {
    return 0;
  }

  let sum = 0;
  let sumSquared = 0;
  let count = 0;

  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const center = grayscaleAt(pixels, w, x, y) * -4;
      const laplacian =
        grayscaleAt(pixels, w, x, y - 1) +
        grayscaleAt(pixels, w, x - 1, y) +
        grayscaleAt(pixels, w, x + 1, y) +
        grayscaleAt(pixels, w, x, y + 1) +
        center;
      sum += laplacian;
      sumSquared += laplacian * laplacian;
      count += 1;
    }
  }

  if (count === 0) {
    return 0;
  }
  const mean = sum / count;
  return Math.max(0, sumSquared / count - mean * mean);
}

function computeMeanBrightness(pixels: Uint8Array): number {
  const pixelCount = Math.floor(pixels.length / 3);
  if (pixelCount === 0) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < pixelCount; i += 1) {
    const src = i * 3;
    sum += pixels[src] * 0.299 + pixels[src + 1] * 0.587 + pixels[src + 2] * 0.114;
  }
  return sum / pixelCount;
}

function grayscaleAt(pixels: Uint8Array, width: number, x: number, y: number): number {
  const idx = (y * width + x) * 3;
  return pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114;
}

function clampInt(value: number, minValue: number, maxValue: number): number {
  return Math.max(minValue, Math.min(maxValue, value));
}
