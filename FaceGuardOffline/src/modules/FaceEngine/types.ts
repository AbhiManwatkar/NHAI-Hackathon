/**
 * @fileoverview Core type definitions for the FaceEngine module.
 * Defines interfaces for face detection, embedding extraction,
 * recognition results, and engine configuration.
 *
 * @module FaceEngine/types
 * @version 1.0.0
 */

// ─── Geometry & Landmarks ────────────────────────────────────────────────────

/**
 * Bounding box for a detected face region.
 * Coordinates are normalized to [0, 1] relative to the source frame.
 */
export interface BoundingBox {
  /** Left edge (x-min), normalized [0, 1] */
  x: number;
  /** Top edge (y-min), normalized [0, 1] */
  y: number;
  /** Width of the box, normalized [0, 1] */
  width: number;
  /** Height of the box, normalized [0, 1] */
  height: number;
}

/**
 * A single facial landmark point.
 * Coordinates are normalized to [0, 1] relative to the source frame.
 */
export interface LandmarkPoint {
  /** Horizontal position, normalized [0, 1] */
  x: number;
  /** Vertical position, normalized [0, 1] */
  y: number;
}

/**
 * Standard set of facial landmarks detected by BlazeFace.
 * Provides key anchor points for face alignment and liveness checks.
 */
export interface FaceLandmarks {
  /** Right eye center (from subject's perspective) */
  rightEye: LandmarkPoint;
  /** Left eye center (from subject's perspective) */
  leftEye: LandmarkPoint;
  /** Nose tip */
  noseTip: LandmarkPoint;
  /** Mouth center */
  mouthCenter: LandmarkPoint;
  /** Right ear tragion */
  rightEar: LandmarkPoint;
  /** Left ear tragion */
  leftEar: LandmarkPoint;
}

// ─── Face Detection ──────────────────────────────────────────────────────────

/**
 * Result of a single face detection within a frame.
 * Contains spatial information, landmarks, and confidence score.
 */
export interface FaceDetection {
  /** Unique identifier for this detection instance */
  id: string;
  /** Bounding box of the detected face, normalized coordinates */
  bbox: BoundingBox;
  /** Facial landmark positions */
  landmarks: FaceLandmarks;
  /** Detection confidence score [0, 1] */
  confidence: number;
  /** Timestamp when this detection was produced (epoch ms) */
  timestamp: number;
}

/**
 * Aggregated result from the face detection pipeline.
 * Contains all detected faces and processing metadata.
 */
export interface DetectionResult {
  /** Array of all detected faces in the frame */
  detections: FaceDetection[];
  /** Number of faces detected */
  faceCount: number;
  /** Time taken for detection inference (milliseconds) */
  inferenceTimeMs: number;
  /** Width of the input frame in pixels */
  frameWidth: number;
  /** Height of the input frame in pixels */
  frameHeight: number;
  /** Timestamp of the frame capture (epoch ms) */
  timestamp: number;
}

// ─── Face Embedding ──────────────────────────────────────────────────────────

/**
 * A face embedding vector produced by MobileFaceNet.
 * Represents a face as a compact numerical descriptor for comparison.
 */
export interface FaceEmbedding {
  /** 128-dimensional embedding vector */
  vector: Float32Array;
  /** Timestamp when embedding was extracted (epoch ms) */
  timestamp: number;
  /** Quality score of the source face image [0, 1] */
  quality: number;
  /** ID of the source face detection, for traceability */
  sourceDetectionId: string;
}

/**
 * A stored embedding associated with a known identity.
 * Used for matching incoming faces against enrolled personnel.
 */
export interface KnownEmbedding {
  /** Unique identifier for this stored embedding */
  id: string;
  /** Personnel ID this embedding belongs to */
  personnelId: string;
  /** Personnel display name */
  personnelName: string;
  /** The embedding vector */
  vector: Float32Array;
  /** Quality score at enrollment time [0, 1] */
  quality: number;
  /** When this embedding was enrolled (epoch ms) */
  enrolledAt: number;
}

// ─── Recognition ─────────────────────────────────────────────────────────────

/**
 * Result of comparing a detected face against known embeddings.
 * Indicates whether a match was found and the matching identity.
 */
export interface RecognitionResult {
  /** Whether a match was found above the similarity threshold */
  match: boolean;
  /** Cosine distance to the closest known embedding (lower = more similar) */
  distance: number;
  /** Cosine similarity score [0, 1] (higher = more similar) */
  similarity: number;
  /** Identity information if a match was found */
  identity: MatchedIdentity | null;
  /** The face detection that was matched */
  detection: FaceDetection;
  /** The embedding extracted for this recognition attempt */
  embedding: FaceEmbedding;
  /** Time taken for the full recognition pipeline (ms) */
  processingTimeMs: number;
}

/**
 * Identity information for a matched face.
 */
export interface MatchedIdentity {
  /** Personnel ID from the database */
  personnelId: string;
  /** Display name of the matched person */
  name: string;
  /** Department of the matched person */
  department: string;
  /** Role of the matched person */
  role: string;
  /** ID of the matched stored embedding */
  embeddingId: string;
}

// ─── Engine Configuration ────────────────────────────────────────────────────

/**
 * Configuration for the FaceEngine pipeline.
 * Controls model paths, thresholds, and processing parameters.
 */
export interface FaceEngineConfig {
  /** Path to the BlazeFace TFLite model file */
  blazeFaceModelPath: string;
  /** Path to the MobileFaceNet TFLite model file */
  mobileFaceNetModelPath: string;
  /** Minimum confidence for face detection [0, 1]. Default: 0.75 */
  detectionConfidenceThreshold: number;
  /** Cosine distance threshold for face matching. Default: 0.6 */
  recognitionDistanceThreshold: number;
  /** Maximum number of faces to detect per frame. Default: 5 */
  maxFacesPerFrame: number;
  /** Input size for BlazeFace detector (pixels). Default: 128 */
  detectorInputSize: number;
  /** Input size for MobileFaceNet embedder (pixels). Default: 112 */
  embedderInputSize: number;
  /** Number of threads for TFLite inference. Default: 4 */
  numThreads: number;
  /** Whether to use GPU delegate if available. Default: false */
  useGPUDelegate: boolean;
  /** Whether to use NNAPI delegate on Android. Default: true */
  useNNAPI: boolean;
  /** IoU threshold for Non-Maximum Suppression. Default: 0.3 */
  nmsIoUThreshold: number;
  /** Minimum face size relative to frame (0-1). Default: 0.05 */
  minFaceSize: number;
}

/**
 * Default configuration values for FaceEngine.
 * Optimized for mobile inference on mid-range Android devices.
 */
export const DEFAULT_FACE_ENGINE_CONFIG: FaceEngineConfig = {
  blazeFaceModelPath: 'blazeface.tflite',
  mobileFaceNetModelPath: 'mobilefacenet_int8.tflite',
  detectionConfidenceThreshold: 0.75,
  recognitionDistanceThreshold: 0.6,
  maxFacesPerFrame: 5,
  detectorInputSize: 128,
  embedderInputSize: 112,
  numThreads: 4,
  useGPUDelegate: false,
  useNNAPI: true,
  nmsIoUThreshold: 0.3,
  minFaceSize: 0.05,
};

// ─── Camera Frame ────────────────────────────────────────────────────────────

/**
 * Represents a camera frame for processing.
 * Abstraction layer over platform-specific frame formats.
 */
export interface CameraFrame {
  /** Raw pixel data as Uint8Array (RGB or RGBA) */
  data: Uint8Array;
  /** Frame width in pixels */
  width: number;
  /** Frame height in pixels */
  height: number;
  /** Number of color channels (3 for RGB, 4 for RGBA) */
  channels: 3 | 4;
  /** Frame capture timestamp (epoch ms) */
  timestamp: number;
  /** Frame rotation in degrees (0, 90, 180, 270) */
  rotation: 0 | 90 | 180 | 270;
  /** Whether the frame is mirrored (front camera) */
  isMirrored: boolean;
}

// ─── Engine State ────────────────────────────────────────────────────────────

/**
 * Possible states of the FaceEngine.
 */
export enum FaceEngineState {
  /** Engine has not been initialized */
  UNINITIALIZED = 'UNINITIALIZED',
  /** Engine is currently loading models */
  INITIALIZING = 'INITIALIZING',
  /** Engine is ready for inference */
  READY = 'READY',
  /** Engine encountered an error */
  ERROR = 'ERROR',
  /** Engine resources have been released */
  RELEASED = 'RELEASED',
}

/**
 * Error types specific to the FaceEngine module.
 */
export enum FaceEngineErrorCode {
  MODEL_LOAD_FAILED = 'MODEL_LOAD_FAILED',
  INFERENCE_FAILED = 'INFERENCE_FAILED',
  INVALID_INPUT = 'INVALID_INPUT',
  ENGINE_NOT_INITIALIZED = 'ENGINE_NOT_INITIALIZED',
  ENGINE_ALREADY_INITIALIZED = 'ENGINE_ALREADY_INITIALIZED',
  PREPROCESSING_FAILED = 'PREPROCESSING_FAILED',
  POSTPROCESSING_FAILED = 'POSTPROCESSING_FAILED',
  EMBEDDING_EXTRACTION_FAILED = 'EMBEDDING_EXTRACTION_FAILED',
  NO_FACE_DETECTED = 'NO_FACE_DETECTED',
  MULTIPLE_FACES_DETECTED = 'MULTIPLE_FACES_DETECTED',
  LOW_QUALITY_FACE = 'LOW_QUALITY_FACE',
}

/**
 * Custom error class for FaceEngine-specific errors.
 */
export class FaceEngineError extends Error {
  /** Error code for programmatic handling */
  public readonly code: FaceEngineErrorCode;
  /** Additional context about the error */
  public readonly details?: Record<string, unknown>;

  constructor(code: FaceEngineErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'FaceEngineError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, FaceEngineError.prototype);
  }
}
