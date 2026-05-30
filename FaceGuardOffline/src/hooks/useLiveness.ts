/**
 * @fileoverview Custom hook wrapping the LivenessDetector facade.
 * Coordinates active gesture challenges, tracks frame-by-frame progress,
 * and maintains the state machine of the dual-layer liveness detection process.
 *
 * @module hooks/useLiveness
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { LivenessDetector } from '../modules/LivenessDetector';
import { CameraFrame, FaceDetection } from '../modules/FaceEngine';
import { LivenessChallenge, LivenessResult } from '../types';
import { Logger } from '../utils/logger';

const CHALLENGES_LIST: LivenessChallenge[] = [
  LivenessChallenge.BLINK,
  LivenessChallenge.SMILE,
  LivenessChallenge.NOD,
];

export const useLiveness = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [currentChallenge, setCurrentChallenge] = useState<LivenessChallenge | null>(null);
  const [challengeProgress, setChallengeProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);
  const [completedCount, setCompletedCount] = useState(0);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const livenessDetectorRef = useRef<LivenessDetector | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const challengesList = CHALLENGES_LIST;

  // Initialize Liveness Detector
  useEffect(() => {
    livenessDetectorRef.current = new LivenessDetector();
    livenessDetectorRef.current.initialize().catch((err) => {
      Logger.error('useLiveness', 'Failed to initialize liveness detector', { err });
    });

    return () => {
      if (livenessDetectorRef.current) {
        livenessDetectorRef.current.release();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Timer logic for active challenges
  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setTimeLeft(10);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setFeedbackMessage('Timeout. Gesture challenge failed.');
          setIsChecking(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  /**
   * Starts a dual-layer liveness check sequence.
   * Runs texture-based passive check first. If uncertain, activates landmark challenges.
   */
  const startCheck = useCallback(
    async (frame: CameraFrame, detection: FaceDetection): Promise<LivenessResult | null> => {
      if (!livenessDetectorRef.current) {
        return null;
      }

      setIsChecking(true);
      setCompletedCount(0);
      setChallengeProgress(0);

      try {
        // Step 1: Run passive liveness check
        const passiveResult = await livenessDetectorRef.current.performPassiveCheck(
          frame,
          detection,
        );

        // If passive check is highly confident (e.g. score >= 0.8), skip active challenges entirely
        if (passiveResult.score >= 0.8) {
          setIsChecking(false);
          Logger.info(
            'useLiveness',
            `Passive anti-spoofing passed (score: ${passiveResult.score})`,
          );
          return passiveResult;
        }

        // Step 2: Trigger active landmark challenges
        Logger.info(
          'useLiveness',
          'Passive check uncertain. Initializing active challenge stepper.',
        );
        const firstChallenge = challengesList[0];
        setCurrentChallenge(firstChallenge);
        livenessDetectorRef.current.startActiveChallenge(firstChallenge);
        startTimer();

        return null; // Return null to indicate active check is pending
      } catch (err) {
        Logger.error('useLiveness', 'Liveness analysis failed', { err });
        setIsChecking(false);
        return {
          isLive: false,
          score: 0,
          challengesAttempted: [],
          challengesPassed: [],
          failureReason: 'Liveness check error occurred',
          checkedAt: new Date().toISOString(),
        };
      }
    },
    [challengesList, startTimer],
  );

  /**
   * Evaluates camera frame against the current active challenge.
   */
  const processActiveFrame = useCallback(
    (detection: FaceDetection): LivenessResult | null => {
      if (!livenessDetectorRef.current || !currentChallenge || !isChecking) {
        return null;
      }

      const progressResult = livenessDetectorRef.current.getActiveProgress(detection);
      setChallengeProgress(progressResult.progress);
      setFeedbackMessage(progressResult.feedbackMessage);

      if (progressResult.completed) {
        const nextIndex = completedCount + 1;
        setCompletedCount(nextIndex);

        if (nextIndex >= challengesList.length) {
          // All active challenges completed successfully!
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          setIsChecking(false);
          setCurrentChallenge(null);

          Logger.info('useLiveness', 'All active liveness challenges passed.');

          return {
            isLive: true,
            score: 0.95, // Combined certainty score
            challengesAttempted: [LivenessChallenge.PASSIVE_TEXTURE, ...challengesList],
            challengesPassed: [LivenessChallenge.PASSIVE_TEXTURE, ...challengesList],
            failureReason: null,
            checkedAt: new Date().toISOString(),
          };
        } else {
          // Transition to next active challenge
          const nextChallenge = challengesList[nextIndex];
          setCurrentChallenge(nextChallenge);
          livenessDetectorRef.current.startActiveChallenge(nextChallenge);
          startTimer();
        }
      }

      return null;
    },
    [challengesList, currentChallenge, isChecking, completedCount, startTimer],
  );

  /**
   * Resets the entire liveness checking state machine.
   */
  const resetCheck = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsChecking(false);
    setCurrentChallenge(null);
    setChallengeProgress(0);
    setCompletedCount(0);
    setFeedbackMessage('');
    if (livenessDetectorRef.current) {
      livenessDetectorRef.current.resetActiveChallenge();
    }
  }, []);

  return {
    isChecking,
    currentChallenge,
    challengeProgress,
    timeLeft,
    completedCount,
    totalCount: challengesList.length,
    feedbackMessage,
    startCheck,
    processActiveFrame,
    resetCheck,
  };
};

export default useLiveness;
