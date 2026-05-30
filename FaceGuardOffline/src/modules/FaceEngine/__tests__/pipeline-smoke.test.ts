import { averageEmbeddings, cosineSimilarity, matchEmbedding } from '../EmbeddingMatcher';
import { computeLaplacianVariance, cropFaceROI } from '../FaceCropper';
import { gammaCorrection, normaliseRGBForModel, resizeBilinearRGB } from '../Preprocessor';

describe('FaceEngine CV utilities', () => {
  it('normalises and resizes RGB crops deterministically', () => {
    const pixels = new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]);

    const resized = resizeBilinearRGB(pixels, 2, 2, 3, 3);
    const normalised = normaliseRGBForModel(resized, 3, 3, 2, 2);

    expect(resized).toHaveLength(27);
    expect(normalised).toHaveLength(12);
    expect(Math.max(...normalised)).toBeLessThanOrEqual(1);
    expect(Math.min(...normalised)).toBeGreaterThanOrEqual(-1);
  });

  it('crops face ROI with bounded padding and computes sharpness', () => {
    const frame = {
      pixels: new Uint8Array(10 * 10 * 3).map((_, index) => (index % 2 === 0 ? 255 : 0)),
      width: 10,
      height: 10,
      channels: 3 as const,
    };

    const crop = cropFaceROI(frame, { x: 0.3, y: 0.3, width: 0.4, height: 0.4 }, 0.2);
    const sharpness = computeLaplacianVariance(crop.pixels, crop.width, crop.height);

    expect(crop.width).toBeGreaterThan(0);
    expect(crop.height).toBeGreaterThan(0);
    expect(sharpness).toBeGreaterThanOrEqual(0);
  });

  it('matches embeddings by cosine similarity', () => {
    const live = averageEmbeddings([
      [1, 0, 0],
      [0.9, 0.1, 0],
      [1, 0.05, 0],
    ]);
    const result = matchEmbedding(live, [
      {
        employee: {
          id: 'emp-1',
          name: 'Test User',
          employeeId: 'NHAI-1',
          department: 'Engineering',
          role: 'Field Engineer',
          photoThumbnail: '',
          isActive: true,
          enrolledAt: '',
          updatedAt: '',
          lastSyncedAt: null,
        },
        embedding: [1, 0, 0],
      },
    ]);

    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(result.matched).toBe(true);
    expect(result.employee?.employeeId).toBe('NHAI-1');
  });

  it('applies gamma correction without changing buffer shape', () => {
    const corrected = gammaCorrection(new Uint8Array([10, 128, 240]), 0.8);
    expect(corrected).toHaveLength(3);
  });
});
