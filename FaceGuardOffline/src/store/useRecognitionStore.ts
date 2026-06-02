import { create } from 'zustand';
import { AttendanceEntry, Employee } from '../modules/BiometricVault';
import { LivenessChallenge } from '../types';
import { Logger } from '../utils/logger';
import { useAppStore } from './useAppStore';

export type RecognitionState =
  | 'IDLE'
  | 'DETECTING'
  | 'LIVENESS_CHALLENGE'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILURE';

export type FailureReason =
  | 'NO_FACE'
  | 'LOW_CONFIDENCE'
  | 'LIVENESS_FAILED'
  | 'SPOOF_DETECTED'
  | 'EMPLOYEE_NOT_FOUND'
  | 'PIPELINE_ERROR';

export interface RecognitionResultPayload {
  employee: Employee | null;
  confidence: number | null;
  pipelineMs: number;
  livenessPassed: boolean;
  failureReason?: FailureReason | null;
}

export interface RecognitionStoreState {
  state: RecognitionState;
  currentEmployee: Employee | null;
  confidence: number | null;
  failureReason: FailureReason | null;
  currentChallenge: LivenessChallenge | null;
  livenessProgress: number;
  pipelineMs: number;
  startDetecting: () => void;
  triggerLiveness: (challenge: LivenessChallenge) => void;
  setLivenessProgress: (progress: number) => void;
  processResult: (result: RecognitionResultPayload) => void;
  logSuccess: (entry?: Partial<AttendanceEntry>) => Promise<void>;
  logFailure: (reason: FailureReason, details?: Record<string, unknown>) => void;
  reset: () => void;
}

const initialState = {
  state: 'IDLE' as RecognitionState,
  currentEmployee: null,
  confidence: null,
  failureReason: null,
  currentChallenge: null,
  livenessProgress: 0,
  pipelineMs: 0,
};

export const useRecognitionStore = create<RecognitionStoreState>((set, get) => ({
  ...initialState,

  startDetecting: () =>
    set({
      ...initialState,
      state: 'DETECTING',
    }),

  triggerLiveness: (challenge) =>
    set({
      state: 'LIVENESS_CHALLENGE',
      currentChallenge: challenge,
      livenessProgress: 0,
      failureReason: null,
    }),

  setLivenessProgress: (progress) =>
    set({
      livenessProgress: Math.max(0, Math.min(progress, 1)),
    }),

  processResult: (result) => {
    if (result.employee && result.livenessPassed && result.confidence !== null) {
      set({
        state: 'SUCCESS',
        currentEmployee: result.employee,
        confidence: result.confidence,
        pipelineMs: result.pipelineMs,
        failureReason: null,
        livenessProgress: 1,
      });
      return;
    }

    set({
      state: 'FAILURE',
      currentEmployee: result.employee,
      confidence: result.confidence,
      pipelineMs: result.pipelineMs,
      failureReason: result.failureReason ?? 'EMPLOYEE_NOT_FOUND',
    });
  },

  logSuccess: async (entry) => {
    const { currentEmployee, confidence, pipelineMs } = get();
    if (!currentEmployee) {
      throw new Error('Cannot log attendance without a recognised employee.');
    }

    await useAppStore.getState().addAttendanceEntry({
      employee_id: currentEmployee.id,
      action: 'CHECK_IN',
      timestamp: Date.now(),
      liveness_passive_score: 1,
      liveness_active_passed: 1,
      recognition_confidence: confidence ?? 0,
      inference_ms: pipelineMs,
      spoof_attempt: 0,
      sync_status: 'LOCAL',
      ...entry,
    });

    Logger.info('RecognitionStore', 'Recognition success written to SQLite', {
      employeeId: currentEmployee.id,
      confidence,
      pipelineMs,
    });
  },

  logFailure: (reason, details) => {
    set({
      state: 'FAILURE',
      failureReason: reason,
    });

    if (reason === 'SPOOF_DETECTED' || reason === 'LIVENESS_FAILED') {
      useAppStore.getState().incrementSpoofAttempts();
      Logger.security('RecognitionStore', 'Spoof or liveness failure blocked', {
        reason,
        ...details,
      });
      return;
    }

    Logger.warn('RecognitionStore', 'Recognition failed', {
      reason,
      ...details,
    });
  },

  reset: () => set({ ...initialState }),
}));

export default useRecognitionStore;
