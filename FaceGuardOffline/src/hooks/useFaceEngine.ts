/**
 * @fileoverview Custom hook wrapping the FaceEngine module.
 * Manages the initialization lifecycle of the on-device TFLite models (BlazeFace and MobileFaceNet)
 * and exposes methods for face detection, matching, and enrolment.
 *
 * @module hooks/useFaceEngine
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FaceEngine,
  CameraFrame,
  DetectionResult,
  RecognitionResult,
  FaceEmbedding,
  KnownEmbedding,
} from '../modules/FaceEngine';
import { Logger } from '../utils/logger';

export const useFaceEngine = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);

  // Maintain persistent engine reference in ref
  const engineRef = useRef<FaceEngine | null>(null);

  /**
   * Initializes the FaceEngine.
   */
  const initializeEngine = useCallback(async () => {
    if (isInitialized) {
      return;
    }
    setIsProcessing(true);
    setEngineError(null);

    try {
      if (!engineRef.current) {
        engineRef.current = new FaceEngine();
      }
      await engineRef.current.initialize();
      setIsInitialized(true);
      Logger.info('useFaceEngine', 'FaceEngine loaded successfully.');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown initialization error';
      setEngineError(errMsg);
      Logger.error('useFaceEngine', `FaceEngine initialization failed: ${errMsg}`);
    } finally {
      setIsProcessing(false);
    }
  }, [isInitialized]);

  // Clean up resources on unmount
  useEffect(() => {
    initializeEngine();

    return () => {
      if (engineRef.current) {
        engineRef.current.release().catch((err) => {
          Logger.error('useFaceEngine', 'Failed to release FaceEngine', { err });
        });
      }
    };
  }, [initializeEngine]);

  /**
   * Wrapper for single frame face detection.
   */
  const detect = useCallback(
    async (frame: CameraFrame): Promise<DetectionResult | null> => {
      if (!engineRef.current || !isInitialized) {
        Logger.warn('useFaceEngine', 'Cannot run detection. Engine not ready.');
        return null;
      }
      setIsProcessing(true);
      try {
        // Access internal detector
        const detector = (engineRef.current as any).detector;
        return await detector.detect(frame);
      } catch (err) {
        Logger.error('useFaceEngine', 'Face detection hook failed', { err });
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [isInitialized],
  );

  /**
   * Wrapper to detect and recognize faces against enrolled database.
   */
  const recognize = useCallback(
    async (frame: CameraFrame, knownEmbeddings: KnownEmbedding[]): Promise<RecognitionResult[]> => {
      if (!engineRef.current || !isInitialized) {
        Logger.warn('useFaceEngine', 'Cannot run recognition. Engine not ready.');
        return [];
      }
      setIsProcessing(true);
      try {
        return await engineRef.current.detectAndRecognize(frame, knownEmbeddings);
      } catch (err) {
        Logger.error('useFaceEngine', 'Face recognition hook failed', { err });
        return [];
      } finally {
        setIsProcessing(false);
      }
    },
    [isInitialized],
  );

  /**
   * Enrolls a face from the camera frame.
   */
  const enroll = useCallback(
    async (frame: CameraFrame): Promise<FaceEmbedding | null> => {
      if (!engineRef.current || !isInitialized) {
        Logger.warn('useFaceEngine', 'Cannot run enrollment. Engine not ready.');
        return null;
      }
      setIsProcessing(true);
      try {
        return await engineRef.current.enrollFace(frame);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Enrolment failed';
        Logger.error('useFaceEngine', 'Face enrolment hook failed', { err });
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    [isInitialized],
  );

  return {
    isInitialized,
    isProcessing,
    engineError,
    detect,
    recognize,
    enroll,
    initializeEngine,
  };
};

export default useFaceEngine;
