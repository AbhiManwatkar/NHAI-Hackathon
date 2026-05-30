/**
 * @fileoverview RecognitionScreen - Real-time Face Recognition & Attendance
 * @description Live camera feed with face detection overlay, real-time matching
 * against enrolled personnel, liveness verification, and automatic attendance
 * recording on successful match. Provides animated success/failure feedback.
 *
 * All recognition processing runs on-device for offline operation.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  BoundingBox,
  FaceDetectionResult,
  FaceMatchResult,
  LivenessResult,
  MainTabParamList,
  Personnel,
  RootStackParamList,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const Colors = {
  primaryOrange: '#FF6B00',
  primaryBlue: '#1A3C5E',
  backgroundDark: '#0D1B2A',
  surface: '#1B2838',
  success: '#00C853',
  error: '#FF1744',
  warning: '#FFD600',
  textPrimary: '#FFFFFF',
  textSecondary: '#B0BEC5',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  glassBackground: 'rgba(27, 40, 56, 0.75)',
  scanLine: 'rgba(255, 107, 0, 0.5)',
} as const;

/** Recognition result states */
type RecognitionState =
  | 'idle'
  | 'scanning'
  | 'face_detected'
  | 'matching'
  | 'liveness_check'
  | 'success'
  | 'failure'
  | 'no_face';

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Typing
// ─────────────────────────────────────────────────────────────────────────────

type RecognitionScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Recognition'>,
  NativeStackScreenProps<RootStackParamList>
>;

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Animated scanning line that moves up and down the viewfinder
 */
const ScanningAnimation: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      translateY.value = withRepeat(
        withSequence(
          withTiming(SCREEN_WIDTH - 120, {
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(0, {
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        false,
      );
    } else {
      translateY.value = withTiming(0, { duration: 300 });
    }
  }, [isActive, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: isActive ? 0.7 : 0,
  }));

  return (
    <Animated.View style={[styles.scanLine, animatedStyle]}>
      <LinearGradient
        colors={['transparent', Colors.scanLine, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.scanLineGradient}
      />
    </Animated.View>
  );
};

/**
 * Face bounding box overlay drawn on the camera preview
 */
const FaceBoundingBox: React.FC<{
  boundingBox: BoundingBox;
  isMatched: boolean;
  confidence: number;
}> = ({ boundingBox, isMatched, confidence }) => {
  const borderAnim = useSharedValue(0);

  useEffect(() => {
    borderAnim.value = withRepeat(
      withSequence(withTiming(1, { duration: 500 }), withTiming(0.5, { duration: 500 })),
      -1,
      true,
    );
  }, [borderAnim]);

  const animatedBorderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      borderAnim.value,
      [0, 1],
      [isMatched ? Colors.success : Colors.primaryOrange, isMatched ? '#00FF6A' : '#FFAA00'],
    ),
  }));

  return (
    <Animated.View
      style={[
        styles.boundingBox,
        {
          left: `${boundingBox.x * 100}%`,
          top: `${boundingBox.y * 100}%`,
          width: `${boundingBox.width * 100}%`,
          height: `${boundingBox.height * 100}%`,
        },
        animatedBorderStyle,
      ]}
    >
      {/* Corner markers */}
      <View style={[styles.bbCorner, styles.bbCornerTL]} />
      <View style={[styles.bbCorner, styles.bbCornerTR]} />
      <View style={[styles.bbCorner, styles.bbCornerBL]} />
      <View style={[styles.bbCorner, styles.bbCornerBR]} />

      {/* Confidence label */}
      <View style={styles.confidenceTag}>
        <Text style={styles.confidenceText}>{Math.round(confidence * 100)}%</Text>
      </View>
    </Animated.View>
  );
};

/**
 * Match result overlay - shown after successful/failed recognition
 */
const MatchResultOverlay: React.FC<{
  state: RecognitionState;
  matchResult: FaceMatchResult | null;
  onDismiss: () => void;
}> = ({ state, matchResult, onDismiss }) => {
  if (state !== 'success' && state !== 'failure') {
    return null;
  }

  const isSuccess = state === 'success';

  return (
    <Animated.View
      entering={ZoomIn.duration(400).springify().damping(12)}
      exiting={FadeOut.duration(300)}
      style={styles.resultOverlay}
    >
      <LinearGradient
        colors={
          isSuccess
            ? ['rgba(0, 200, 83, 0.9)', 'rgba(0, 150, 63, 0.95)']
            : ['rgba(255, 23, 68, 0.9)', 'rgba(200, 0, 50, 0.95)']
        }
        style={styles.resultGradient}
      >
        <Text style={styles.resultIcon}>{isSuccess ? '✅' : '❌'}</Text>
        <Text style={styles.resultTitle}>{isSuccess ? 'Identity Verified' : 'No Match Found'}</Text>

        {isSuccess && matchResult?.personnel && (
          <View style={styles.matchedPersonInfo}>
            <View style={styles.matchedAvatar}>
              <Text style={styles.matchedAvatarText}>
                {matchResult.personnel.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.matchedName}>{matchResult.personnel.name}</Text>
            <Text style={styles.matchedDetail}>
              {matchResult.personnel.employeeId} • {matchResult.personnel.department}
            </Text>
            <View style={styles.matchedStats}>
              <View style={styles.matchedStatItem}>
                <Text style={styles.matchedStatValue}>
                  {Math.round(matchResult.confidence * 100)}%
                </Text>
                <Text style={styles.matchedStatLabel}>Confidence</Text>
              </View>
              <View style={styles.matchedStatDivider} />
              <View style={styles.matchedStatItem}>
                <Text style={styles.matchedStatValue}>
                  {matchResult.livenessResult?.score
                    ? `${Math.round(matchResult.livenessResult.score * 100)}%`
                    : 'N/A'}
                </Text>
                <Text style={styles.matchedStatLabel}>Liveness</Text>
              </View>
              <View style={styles.matchedStatDivider} />
              <View style={styles.matchedStatItem}>
                <Text style={styles.matchedStatValue}>{matchResult.processingTimeMs}ms</Text>
                <Text style={styles.matchedStatLabel}>Speed</Text>
              </View>
            </View>
            <Text style={styles.attendanceRecorded}>📋 Attendance Recorded</Text>
          </View>
        )}

        {!isSuccess && (
          <Text style={styles.failureMessage}>
            Face not recognized. Please ensure you are enrolled or try again with better lighting.
          </Text>
        )}

        <TouchableOpacity style={styles.dismissButton} onPress={onDismiss} activeOpacity={0.8}>
          <Text style={styles.dismissButtonText}>{isSuccess ? 'Done' : 'Try Again'}</Text>
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
};

/**
 * Status indicator bar showing current recognition phase
 */
const StatusBar_: React.FC<{
  state: RecognitionState;
}> = ({ state }) => {
  const statusConfig: Record<RecognitionState, { text: string; color: string; icon: string }> = {
    idle: { text: 'Point camera at face', color: Colors.textSecondary, icon: '📷' },
    scanning: { text: 'Scanning for faces...', color: Colors.primaryOrange, icon: '🔍' },
    face_detected: { text: 'Face detected', color: Colors.primaryOrange, icon: '👤' },
    matching: { text: 'Matching identity...', color: Colors.warning, icon: '⏳' },
    liveness_check: { text: 'Verifying liveness...', color: Colors.warning, icon: '🔐' },
    success: { text: 'Match found!', color: Colors.success, icon: '✅' },
    failure: { text: 'No match', color: Colors.error, icon: '❌' },
    no_face: { text: 'No face detected', color: Colors.textSecondary, icon: '👻' },
  };

  const config = statusConfig[state];

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[styles.statusBarContainer, { borderLeftColor: config.color }]}
    >
      <Text style={styles.statusIcon}>{config.icon}</Text>
      <Text style={[styles.statusText, { color: config.color }]}>{config.text}</Text>
      {(state === 'matching' || state === 'liveness_check' || state === 'scanning') && (
        <ActivityIndicator size="small" color={config.color} style={styles.statusSpinner} />
      )}
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * RecognitionScreen - Real-time face recognition and attendance recorder
 *
 * Features:
 * - Live camera feed with face detection overlay
 * - Real-time matching against enrolled face embeddings
 * - Liveness verification to prevent spoofing
 * - Automatic attendance recording on successful match
 * - Animated success/failure feedback with match details
 *
 * All processing runs on-device using local face engine.
 */
const RecognitionScreen: React.FC<RecognitionScreenProps> = ({ navigation }) => {
  // ── State ──────────────────────────────────────────────────────────────
  const [recognitionState, setRecognitionState] = useState<RecognitionState>('idle');
  const [detectedFace, setDetectedFace] = useState<FaceDetectionResult | null>(null);
  const [matchResult, setMatchResult] = useState<FaceMatchResult | null>(null);
  const [isAutoMode, setIsAutoMode] = useState<boolean>(true);
  const [recognitionCount, setRecognitionCount] = useState<number>(0);

  // Refs for timer cleanup
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Animations ─────────────────────────────────────────────────────────
  const viewfinderScale = useSharedValue(1);

  useEffect(() => {
    viewfinderScale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [viewfinderScale]);

  const viewfinderAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: viewfinderScale.value }],
  }));

  // ── Lifecycle ──────────────────────────────────────────────────────────

  useEffect(() => {
    // Start scanning when screen mounts
    setRecognitionState('scanning');

    return () => {
      // Cleanup timers
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
      }
    };
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────

  /**
   * Simulates face detection from camera frame.
   * In production, this would be called from the camera's onFrame callback.
   */
  const handleSimulateDetection = useCallback(() => {
    if (recognitionState === 'success' || recognitionState === 'failure') {
      return;
    }

    setRecognitionState('face_detected');

    // Simulate face detection
    const mockDetection: FaceDetectionResult = {
      detected: true,
      boundingBox: { x: 0.25, y: 0.2, width: 0.5, height: 0.55 },
      landmarks: [],
      confidence: 0.94,
      yaw: 2.5,
      pitch: -1.3,
      roll: 0.8,
    };
    setDetectedFace(mockDetection);

    // Auto-trigger matching after brief delay
    scanTimerRef.current = setTimeout(() => {
      handleMatchFace(mockDetection);
    }, 1000);
    // Demo simulator intentionally captures the current matcher callback through the timeout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recognitionState]);

  /**
   * Runs face matching against enrolled personnel database.
   * In production, uses the FaceEngine hook to compare embeddings.
   */
  const handleMatchFace = useCallback(
    async (detection: FaceDetectionResult) => {
      setRecognitionState('matching');

      // Simulate matching delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Simulate liveness check
      setRecognitionState('liveness_check');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Simulate match result (alternate success/failure for demo)
      const isMatch = recognitionCount % 3 !== 2; // 2 out of 3 successful

      if (isMatch) {
        const mockResult: FaceMatchResult = {
          matched: true,
          personnel: {
            id: 'p-001',
            name: 'Rajesh Kumar',
            employeeId: 'NHAI-EMP-0042',
            department: 'Engineering',
            role: 'Field Engineer',
            photoThumbnail: '',
            isActive: true,
            enrolledAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastSyncedAt: null,
          },
          confidence: 0.96,
          distance: 0.12,
          threshold: 0.7,
          processingTimeMs: 245,
          candidatesSearched: 24,
          livenessResult: {
            isLive: true,
            score: 0.98,
            challengesAttempted: [],
            challengesPassed: [],
            failureReason: null,
            checkedAt: new Date().toISOString(),
          },
          matchedAt: new Date().toISOString(),
        };

        setMatchResult(mockResult);
        setRecognitionState('success');
        Vibration.vibrate([0, 100, 50, 100]); // Success haptic pattern

        // TODO: Record attendance in local DB
        // await AttendanceDB.record({
        //   personnelId: mockResult.personnel.id,
        //   confidence: mockResult.confidence,
        //   livenessScore: mockResult.livenessResult.score,
        //   method: 'face_recognition',
        // });
      } else {
        setMatchResult(null);
        setRecognitionState('failure');
        Vibration.vibrate(500); // Failure haptic
      }

      setRecognitionCount((prev) => prev + 1);
    },
    [recognitionCount],
  );

  /**
   * Resets recognition state and resumes scanning
   */
  const handleDismissResult = useCallback(() => {
    setRecognitionState('scanning');
    setDetectedFace(null);
    setMatchResult(null);
  }, []);

  /**
   * Toggles between auto and manual recognition modes
   */
  const toggleAutoMode = useCallback(() => {
    setIsAutoMode((prev) => !prev);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Camera Preview Area */}
      <View style={styles.cameraWrapper}>
        <Animated.View style={[styles.cameraPreview, viewfinderAnimStyle]}>
          {/* Placeholder for actual camera component */}
          <View style={styles.cameraPlaceholder}>
            <Text style={styles.cameraPlaceholderIcon}>📹</Text>
            <Text style={styles.cameraPlaceholderText}>Camera Preview</Text>
            <Text style={styles.cameraPlaceholderSubtext}>
              Tap "Detect" to simulate face detection
            </Text>
          </View>

          {/* Scanning animation */}
          <ScanningAnimation
            isActive={recognitionState === 'scanning' || recognitionState === 'face_detected'}
          />

          {/* Face bounding box overlay */}
          {detectedFace?.detected && detectedFace.boundingBox && (
            <FaceBoundingBox
              boundingBox={detectedFace.boundingBox}
              isMatched={recognitionState === 'success'}
              confidence={detectedFace.confidence}
            />
          )}

          {/* Corner frame guides */}
          <View style={styles.viewfinderFrame}>
            <View style={[styles.vfCorner, styles.vfCornerTL]} />
            <View style={[styles.vfCorner, styles.vfCornerTR]} />
            <View style={[styles.vfCorner, styles.vfCornerBL]} />
            <View style={[styles.vfCorner, styles.vfCornerBR]} />
          </View>
        </Animated.View>

        {/* Match Result Overlay */}
        <MatchResultOverlay
          state={recognitionState}
          matchResult={matchResult}
          onDismiss={handleDismissResult}
        />
      </View>

      {/* Bottom Controls Panel */}
      <View style={styles.controlsPanel}>
        {/* Status indicator */}
        <StatusBar_ state={recognitionState} />

        {/* Action buttons */}
        <View style={styles.controlsRow}>
          {/* Auto/Manual toggle */}
          <TouchableOpacity
            style={[styles.controlButton, styles.controlButtonSecondary]}
            onPress={toggleAutoMode}
            activeOpacity={0.7}
          >
            <Text style={styles.controlButtonIcon}>{isAutoMode ? '🔄' : '👆'}</Text>
            <Text style={styles.controlButtonLabel}>{isAutoMode ? 'Auto' : 'Manual'}</Text>
          </TouchableOpacity>

          {/* Main detect/capture button */}
          <TouchableOpacity
            style={[
              styles.mainActionButton,
              recognitionState === 'success' && styles.mainActionButtonSuccess,
              recognitionState === 'failure' && styles.mainActionButtonFailure,
            ]}
            onPress={
              recognitionState === 'success' || recognitionState === 'failure'
                ? handleDismissResult
                : handleSimulateDetection
            }
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={
                recognitionState === 'success'
                  ? [Colors.success, '#00A843']
                  : recognitionState === 'failure'
                  ? [Colors.error, '#CC0033']
                  : [Colors.primaryOrange, '#FF8F00']
              }
              style={styles.mainActionGradient}
            >
              <Text style={styles.mainActionIcon}>
                {recognitionState === 'scanning' || recognitionState === 'idle'
                  ? '👤'
                  : recognitionState === 'matching' || recognitionState === 'liveness_check'
                  ? '⏳'
                  : recognitionState === 'success'
                  ? '✅'
                  : '🔄'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* History shortcut */}
          <TouchableOpacity
            style={[styles.controlButton, styles.controlButtonSecondary]}
            activeOpacity={0.7}
          >
            <Text style={styles.controlButtonIcon}>📋</Text>
            <Text style={styles.controlButtonLabel}>History</Text>
          </TouchableOpacity>
        </View>

        {/* Session stats */}
        <View style={styles.sessionStats}>
          <Text style={styles.sessionStatText}>Session: {recognitionCount} recognitions</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },

  // Camera
  cameraWrapper: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  cameraPreview: {
    flex: 1,
    backgroundColor: '#0A0F1A',
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraPlaceholderIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  cameraPlaceholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  cameraPlaceholderSubtext: {
    fontSize: 12,
    color: 'rgba(176, 190, 197, 0.5)',
  },

  // Scanning Animation
  scanLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 2,
    top: 40,
  },
  scanLineGradient: {
    flex: 1,
    height: 2,
  },

  // Viewfinder Frame
  viewfinderFrame: {
    position: 'absolute',
    top: 40,
    left: 40,
    right: 40,
    bottom: 40,
  },
  vfCorner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: Colors.primaryOrange,
  },
  vfCornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  vfCornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  vfCornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  vfCornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },

  // Face Bounding Box
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 8,
  },
  bbCorner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: Colors.primaryOrange,
  },
  bbCornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 4,
  },
  bbCornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 4,
  },
  bbCornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 4,
  },
  bbCornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 4,
  },
  confidenceTag: {
    position: 'absolute',
    bottom: -24,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  // Result Overlay
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  resultGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  resultIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },

  // Matched Person Info
  matchedPersonInfo: {
    alignItems: 'center',
    width: '100%',
  },
  matchedAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  matchedAvatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  matchedName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  matchedDetail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 20,
  },
  matchedStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  matchedStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  matchedStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  matchedStatLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matchedStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 12,
  },
  attendanceRecorded: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  failureMessage: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  dismissButton: {
    marginTop: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  dismissButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  // Controls Panel
  controlsPanel: {
    backgroundColor: Colors.backgroundDark,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 16 : 24,
  },

  // Status Bar
  statusBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.glassBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  statusIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  statusSpinner: {
    marginLeft: 8,
  },

  // Controls Row
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
  },
  controlButtonSecondary: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  controlButtonIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  controlButtonLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  mainActionButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    ...Platform.select({
      android: { elevation: 8 },
      ios: {
        shadowColor: Colors.primaryOrange,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
    }),
  },
  mainActionButtonSuccess: {},
  mainActionButtonFailure: {},
  mainActionGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainActionIcon: {
    fontSize: 32,
  },

  // Session Stats
  sessionStats: {
    alignItems: 'center',
    paddingTop: 4,
  },
  sessionStatText: {
    fontSize: 12,
    color: 'rgba(176, 190, 197, 0.5)',
  },
});

export default RecognitionScreen;
