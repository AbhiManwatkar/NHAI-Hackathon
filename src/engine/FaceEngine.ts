/**
 * FaceGuard Offline – Root SDK Engine (Re-export)
 */

export {
  FaceEngine,
  cosineSimilarity,
  l2Normalise,
  matchEmbedding,
  averageEmbeddings,
  computeEAR,
  detectBlink,
  detectSpoofType,
  applyCLAHE,
  selectBestFace,
  cropFaceRegion,
} from '../../FaceGuardApp/src/engine/FaceEngine';

export type {
  ModelAdapter,
  RecognitionResult,
} from '../../FaceGuardApp/src/engine/FaceEngine';
