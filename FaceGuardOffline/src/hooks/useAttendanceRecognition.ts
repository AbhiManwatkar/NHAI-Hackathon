import { useState, useCallback, useRef } from 'react';
import { FaceEngine } from '../modules/FaceEngine';
import { VaultManager } from '../modules/BiometricVault';
import { matchEmbedding } from '../modules/FaceEngine/EmbeddingMatcher';

export type RecognitionState = 'idle' | 'detecting' | 'liveness' | 'processing' | 'success' | 'failure';

interface UseAttendanceRecognitionResult {
  state: RecognitionState;
  matchedEmployee: any | null;
  confidence: number;
  livenessScore: number;
  inferenceMs: number;
  qualityError: string | null;
  processCameraFrame: (base64Frame: string) => Promise<void>;
  logAttendanceAction: (type: 'CHECK_IN' | 'CHECK_OUT') => Promise<void>;
  resetState: () => void;
}

export const useAttendanceRecognition = (): UseAttendanceRecognitionResult => {
  const [state, setState] = useState<RecognitionState>('idle');
  const [matchedEmployee, setMatchedEmployee] = useState<any | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [livenessScore, setLivenessScore] = useState<number>(0);
  const [inferenceMs, setInferenceMs] = useState<number>(0);
  const [qualityError, setQualityError] = useState<string | null>(null);

  const frameCounter = useRef(0);
  const lastProcessedTime = useRef(0);
  const faceLockStartTime = useRef<number | null>(null);
  const isCooldown = useRef(false);

  const resetState = useCallback(() => {
    setState('idle');
    setMatchedEmployee(null);
    setConfidence(0);
    setLivenessScore(0);
    setInferenceMs(0);
    setQualityError(null);
    faceLockStartTime.current = null;
    isCooldown.current = false;
  }, []);

  const processCameraFrame = useCallback(async (base64Frame: string) => {
    if (isCooldown.current || state === 'success' || state === 'processing' || state === 'liveness') {
      return;
    }

    // 1. Throttle: process every 3rd frame
    frameCounter.current += 1;
    if (frameCounter.current % 3 !== 0) {
      return;
    }

    try {
      const now = Date.now();
      
      // 2. Detect face
      const faceResult = await FaceEngine.detectFace(base64Frame);
      if (!faceResult.detected || !faceResult.bbox) {
        faceLockStartTime.current = null;
        if (state !== 'idle') setState('idle');
        setQualityError(null);
        return;
      }

      // 3. Face lock: hold face in frame for 400ms
      if (!faceLockStartTime.current) {
        faceLockStartTime.current = now;
        setState('detecting');
        return;
      }

      if (now - faceLockStartTime.current < 400) {
        return; // Still holding lock
      }

      // 4. Trigger full pipeline
      setState('processing');
      const startInference = performance.now();
      
      const pipelineResult = await FaceEngine.runFullPipeline(base64Frame);
      const totalMs = performance.now() - startInference;
      setInferenceMs(totalMs);

      if (!pipelineResult.faceDetected || !pipelineResult.embedding || !pipelineResult.liveness) {
        setState('failure');
        isCooldown.current = true;
        setTimeout(() => { isCooldown.current = false; setState('idle'); }, 2000);
        return;
      }

      setLivenessScore(pipelineResult.liveness.realScore);

      // Validate Liveness threshold
      if (!pipelineResult.liveness.isReal) {
        setState('failure');
        setQualityError('Liveness check failed — no photo/screen');
        isCooldown.current = true;
        // Log spoof attempts to the database
        const vault = VaultManager.getInstance();
        await vault.logAttendance({
          employee_id: null,
          action: 'CHECK_IN',
          timestamp: Date.now(),
          liveness_passive_score: pipelineResult.liveness.realScore,
          liveness_active_passed: 0,
          recognition_confidence: 0,
          inference_ms: Math.round(totalMs),
          spoof_attempt: 1,
        });
        setTimeout(() => { isCooldown.current = false; setState('idle'); }, 2000);
        return;
      }

      // Match face embedding in cache/DB
      const vault = VaultManager.getInstance();
      const cachedEmbeddingsMap = vault.getCache();
      const candidates = Array.from(cachedEmbeddingsMap.entries()).map(([employeeId, embedding]) => ({
        employee: { id: employeeId, name: 'Employee', employee_code: employeeId } as any,
        embedding,
      }));

      // Cosine similarity lookup
      const match = matchEmbedding(pipelineResult.embedding, candidates);
      setConfidence(match.confidence);

      if (match.matched && match.employee) {
        // Fetch actual employee details from vault
        const employees = await vault.getAllEmployees();
        const fullEmployee = employees.find(e => e.id === match.employee?.id);
        
        setMatchedEmployee(fullEmployee || match.employee);
        setState('success');
      } else {
        setState('failure');
        setQualityError('Face not recognised');
        isCooldown.current = true;
        setTimeout(() => { isCooldown.current = false; setState('idle'); }, 2000);
      }

    } catch (err) {
      console.error(err);
      setState('idle');
    }
  }, [state]);

  const logAttendanceAction = useCallback(async (type: 'CHECK_IN' | 'CHECK_OUT') => {
    if (!matchedEmployee) return;

    try {
      const vault = VaultManager.getInstance();
      await vault.logAttendance({
        employee_id: matchedEmployee.id,
        action: type,
        timestamp: Date.now(),
        liveness_passive_score: livenessScore,
        liveness_active_passed: 1,
        recognition_confidence: confidence,
        inference_ms: Math.round(inferenceMs),
        gps_lat: 28.6139, // Static New Delhi coordinates or dynamic mock
        gps_lng: 77.2090,
      });

      // Cooldown after success
      isCooldown.current = true;
      setTimeout(() => {
        isCooldown.current = false;
        resetState();
      }, 3000);

    } catch (err) {
      console.error(err);
    }
  }, [matchedEmployee, livenessScore, confidence, inferenceMs, resetState]);

  return {
    state,
    matchedEmployee,
    confidence,
    livenessScore,
    inferenceMs,
    qualityError,
    processCameraFrame,
    logAttendanceAction,
    resetState,
  };
};

export default useAttendanceRecognition;
