import { useState, useCallback } from 'react';
import { FaceEngine } from '../modules/FaceEngine';
import { validateFaceQuality, FaceQualityReport, FrameData } from '../modules/FaceEngine/FaceCropper';
import { VaultManager, EnrolmentData, Employee } from '../modules/BiometricVault';

export interface UseCameraEnrolmentResult {
  capturedEmbeddings: number[][];
  qualityReport: FaceQualityReport | null;
  captureFrame: (base64Frame: string, frameData: FrameData) => Promise<boolean>;
  isProcessing: boolean;
  error: string | null;
  reset: () => void;
  finalise: (employeeData: EnrolmentData) => Promise<Employee>;
}

export const useCameraEnrolment = (): UseCameraEnrolmentResult => {
  const [capturedEmbeddings, setCapturedEmbeddings] = useState<number[][]>([]);
  const [qualityReport, setQualityReport] = useState<FaceQualityReport | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setCapturedEmbeddings([]);
    setQualityReport(null);
    setIsProcessing(false);
    setError(null);
  }, []);

  const captureFrame = useCallback(async (base64Frame: string, frameData: FrameData): Promise<boolean> => {
    setIsProcessing(true);
    setError(null);

    try {
      // 1. Run BlazeFace detection
      const detection = await FaceEngine.detectFace(base64Frame);
      if (!detection.detected || !detection.bbox) {
        setQualityReport({
          isCentred: false,
          faceAreaRatio: 0,
          isSharp: false,
          sharpnessScore: 0,
          isWellLit: false,
          brightnessScore: 0,
          qualityPassed: false,
          failReason: 'No face detected. Align inside frame.',
        });
        setIsProcessing(false);
        return false;
      }

      // 2. Validate quality criteria (sharpness, lighting, alignment)
      const report = validateFaceQuality(detection.bbox, frameData);
      setQualityReport(report);

      if (!report.qualityPassed) {
        setIsProcessing(false);
        return false;
      }

      // 3. Run MobileFaceNet to extract 128-dimensional embedding
      const embedding = await FaceEngine.getEmbedding(base64Frame);
      setCapturedEmbeddings((prev) => [...prev, embedding]);
      setIsProcessing(false);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Capture failed: ${msg}`);
      setIsProcessing(false);
      return false;
    }
  }, []);

  const finalise = useCallback(async (employeeData: EnrolmentData): Promise<Employee> => {
    if (capturedEmbeddings.length < 3) {
      throw new Error(`Enrollment requires 3 captures. Current: ${capturedEmbeddings.length}`);
    }

    setIsProcessing(true);
    try {
      const vault = VaultManager.getInstance();
      const employee = await vault.enrollEmployee(employeeData, capturedEmbeddings);
      setIsProcessing(false);
      return employee;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Finalisation failed: ${msg}`);
      setIsProcessing(false);
      throw err;
    }
  }, [capturedEmbeddings]);

  return {
    capturedEmbeddings,
    qualityReport,
    captureFrame,
    isProcessing,
    error,
    reset,
    finalise,
  };
};

export default useCameraEnrolment;
