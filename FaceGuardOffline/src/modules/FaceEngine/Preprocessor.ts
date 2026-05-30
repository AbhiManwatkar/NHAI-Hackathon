export function convertRGBToLAB(pixels: Uint8Array, width: number, height: number): Float32Array {
  const lab = new Float32Array(width * height * 3);
  const pixelCount = width * height;

  for (let i = 0; i < pixelCount; i += 1) {
    const src = i * 3;
    const r = srgbToLinear(pixels[src] / 255);
    const g = srgbToLinear(pixels[src + 1] / 255);
    const b = srgbToLinear(pixels[src + 2] / 255);

    const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
    const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
    const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;

    const fx = xyzPivot(x);
    const fy = xyzPivot(y);
    const fz = xyzPivot(z);
    lab[src] = 116 * fy - 16;
    lab[src + 1] = 500 * (fx - fy);
    lab[src + 2] = 200 * (fy - fz);
  }

  return lab;
}

export function applyCLAHE(
  lChannel: Float32Array,
  width: number,
  height: number,
  clipLimit = 2.0,
  tileSize = 8,
): Float32Array {
  const safeTileSize = Math.max(2, Math.floor(tileSize));
  const tilesX = Math.ceil(width / safeTileSize);
  const tilesY = Math.ceil(height / safeTileSize);
  const maps: number[][] = [];

  for (let ty = 0; ty < tilesY; ty += 1) {
    for (let tx = 0; tx < tilesX; tx += 1) {
      maps.push(buildTileMap(lChannel, width, height, tx, ty, safeTileSize, clipLimit));
    }
  }

  const enhanced = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const gy = y / safeTileSize - 0.5;
    const y0 = clampInt(Math.floor(gy), 0, tilesY - 1);
    const y1 = clampInt(y0 + 1, 0, tilesY - 1);
    const wy = gy - Math.floor(gy);

    for (let x = 0; x < width; x += 1) {
      const gx = x / safeTileSize - 0.5;
      const x0 = clampInt(Math.floor(gx), 0, tilesX - 1);
      const x1 = clampInt(x0 + 1, 0, tilesX - 1);
      const wx = gx - Math.floor(gx);
      const bin = clampInt(Math.round((lChannel[y * width + x] / 100) * 255), 0, 255);

      const top = maps[y0 * tilesX + x0][bin] * (1 - wx) + maps[y0 * tilesX + x1][bin] * wx;
      const bottom = maps[y1 * tilesX + x0][bin] * (1 - wx) + maps[y1 * tilesX + x1][bin] * wx;
      enhanced[y * width + x] = top * (1 - wy) + bottom * wy;
    }
  }

  return enhanced;
}

export function convertLABToRGB(lab: Float32Array, width: number, height: number): Uint8Array {
  const rgb = new Uint8Array(width * height * 3);
  const pixelCount = width * height;

  for (let i = 0; i < pixelCount; i += 1) {
    const src = i * 3;
    const l = lab[src];
    const a = lab[src + 1];
    const b = lab[src + 2];

    const fy = (l + 16) / 116;
    const fx = a / 500 + fy;
    const fz = fy - b / 200;

    const x = 0.95047 * labPivotInverse(fx);
    const y = labPivotInverse(fy);
    const z = 1.08883 * labPivotInverse(fz);

    const linearR = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
    const linearG = x * -0.969266 + y * 1.8760108 + z * 0.041556;
    const linearB = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

    rgb[src] = toByte(linearToSrgb(linearR) * 255);
    rgb[src + 1] = toByte(linearToSrgb(linearG) * 255);
    rgb[src + 2] = toByte(linearToSrgb(linearB) * 255);
  }

  return rgb;
}

export function normaliseForModel(
  face: Uint8Array,
  targetW: number,
  targetH: number,
): Float32Array {
  const sourcePixels = Math.floor(face.length / 3);
  const sourceSide = Math.sqrt(sourcePixels);
  const sourceW = Number.isInteger(sourceSide) ? sourceSide : targetW;
  const sourceH = Math.max(1, Math.floor(sourcePixels / sourceW));
  return normaliseRGBForModel(face, sourceW, sourceH, targetW, targetH);
}

export function normaliseRGBForModel(
  face: Uint8Array,
  sourceW: number,
  sourceH: number,
  targetW: number,
  targetH: number,
): Float32Array {
  const resized = resizeBilinearRGB(face, sourceW, sourceH, targetW, targetH);
  const output = new Float32Array(targetW * targetH * 3);

  for (let i = 0; i < resized.length; i += 1) {
    output[i] = resized[i] / 127.5 - 1;
  }

  return output;
}

export function gammaCorrection(pixels: Uint8Array, gamma = 0.8): Uint8Array {
  const corrected = new Uint8Array(pixels.length);
  const invGamma = 1 / Math.max(0.01, gamma);
  const lut = new Uint8Array(256);

  for (let i = 0; i < 256; i += 1) {
    lut[i] = toByte(255 * Math.pow(i / 255, invGamma));
  }
  for (let i = 0; i < pixels.length; i += 1) {
    corrected[i] = lut[pixels[i]];
  }

  return corrected;
}

export function resizeBilinearRGB(
  pixels: Uint8Array,
  sourceW: number,
  sourceH: number,
  targetW: number,
  targetH: number,
): Uint8Array {
  const resized = new Uint8Array(targetW * targetH * 3);
  const scaleX = targetW > 1 ? (sourceW - 1) / (targetW - 1) : 0;
  const scaleY = targetH > 1 ? (sourceH - 1) / (targetH - 1) : 0;

  for (let y = 0; y < targetH; y += 1) {
    const sy = y * scaleY;
    const y0 = Math.floor(sy);
    const y1 = Math.min(sourceH - 1, y0 + 1);
    const wy = sy - y0;

    for (let x = 0; x < targetW; x += 1) {
      const sx = x * scaleX;
      const x0 = Math.floor(sx);
      const x1 = Math.min(sourceW - 1, x0 + 1);
      const wx = sx - x0;
      const dst = (y * targetW + x) * 3;

      for (let c = 0; c < 3; c += 1) {
        const p00 = pixels[(y0 * sourceW + x0) * 3 + c] ?? 0;
        const p10 = pixels[(y0 * sourceW + x1) * 3 + c] ?? p00;
        const p01 = pixels[(y1 * sourceW + x0) * 3 + c] ?? p00;
        const p11 = pixels[(y1 * sourceW + x1) * 3 + c] ?? p00;
        const top = p00 * (1 - wx) + p10 * wx;
        const bottom = p01 * (1 - wx) + p11 * wx;
        resized[dst + c] = toByte(top * (1 - wy) + bottom * wy);
      }
    }
  }

  return resized;
}

export function replaceLChannel(lab: Float32Array, lChannel: Float32Array): Float32Array {
  const output = new Float32Array(lab);
  for (let i = 0; i < lChannel.length; i += 1) {
    output[i * 3] = lChannel[i];
  }
  return output;
}

function buildTileMap(
  lChannel: Float32Array,
  width: number,
  height: number,
  tileX: number,
  tileY: number,
  tileSize: number,
  clipLimit: number,
): number[] {
  const startX = tileX * tileSize;
  const startY = tileY * tileSize;
  const endX = Math.min(width, startX + tileSize);
  const endY = Math.min(height, startY + tileSize);
  const area = Math.max(1, (endX - startX) * (endY - startY));
  const histogram = new Array<number>(256).fill(0);

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const bin = clampInt(Math.round((lChannel[y * width + x] / 100) * 255), 0, 255);
      histogram[bin] += 1;
    }
  }

  const limit = Math.max(1, Math.floor((clipLimit * area) / 256));
  let excess = 0;
  for (let i = 0; i < histogram.length; i += 1) {
    if (histogram[i] > limit) {
      excess += histogram[i] - limit;
      histogram[i] = limit;
    }
  }

  const redistribute = Math.floor(excess / 256);
  const remainder = excess % 256;
  for (let i = 0; i < 256; i += 1) {
    histogram[i] += redistribute + (i < remainder ? 1 : 0);
  }

  const map = new Array<number>(256);
  let cdf = 0;
  for (let i = 0; i < 256; i += 1) {
    cdf += histogram[i];
    map[i] = (cdf / area) * 100;
  }
  return map;
}

function srgbToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

function linearToSrgb(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}

function xyzPivot(value: number): number {
  return value > 0.008856 ? Math.cbrt(value) : 7.787037 * value + 16 / 116;
}

function labPivotInverse(value: number): number {
  const cubed = value * value * value;
  return cubed > 0.008856 ? cubed : (value - 16 / 116) / 7.787037;
}

function clampInt(value: number, minValue: number, maxValue: number): number {
  return Math.max(minValue, Math.min(maxValue, value));
}

function toByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
