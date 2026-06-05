/**
 * FaceGuard Offline – FaceOverlay Component
 * ============================================
 *
 * Animated face-detection overlay rendered on top of the camera preview.
 * Shows a scanning reticle, bounding box with confidence score, and
 * liveness challenge prompts with visual feedback.
 */

import React from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { Colors, Radii, Spacing, Typography } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const RETICLE_SIZE = SCREEN_W * 0.72;

interface FaceOverlayProps {
  /** Current pipeline stage for animated display */
  stage: 'scanning' | 'detected' | 'verifying' | 'success' | 'failed';
  /** Confidence score (0-1) when face is matched */
  confidence?: number;
  /** Liveness challenge text to display */
  challengeText?: string;
  /** Name of matched employee */
  matchName?: string;
}

export function FaceOverlay({
  stage,
  confidence,
  challengeText,
  matchName,
}: FaceOverlayProps) {
  const rotateAnim = React.useRef(new Animated.Value(0)).current;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    // Scanning rotation
    if (stage === 'scanning' || stage === 'verifying') {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      rotateAnim.setValue(0);
    }
  }, [stage, rotateAnim]);

  React.useEffect(() => {
    // Pulse on detection
    if (stage === 'detected' || stage === 'success') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [stage, pulseAnim]);

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [stage, fadeAnim]);

  const stageColors = {
    scanning: Colors.primary[400],
    detected: Colors.warning[400],
    verifying: Colors.primary[300],
    success: Colors.accent[400],
    failed: Colors.danger[400],
  };

  const stageLabels = {
    scanning: 'Scanning for face…',
    detected: 'Face detected',
    verifying: 'Verifying identity…',
    success: matchName ? `Welcome, ${matchName}` : 'Verified ✓',
    failed: 'Verification failed',
  };

  const color = stageColors[stage];
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      {/* Corner brackets */}
      <Animated.View
        style={[
          styles.reticle,
          {
            borderColor: color,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        {/* Top-left corner */}
        <View style={[styles.corner, styles.topLeft, { borderColor: color }]} />
        {/* Top-right corner */}
        <View style={[styles.corner, styles.topRight, { borderColor: color }]} />
        {/* Bottom-left corner */}
        <View style={[styles.corner, styles.bottomLeft, { borderColor: color }]} />
        {/* Bottom-right corner */}
        <View style={[styles.corner, styles.bottomRight, { borderColor: color }]} />

        {/* Rotating scan line */}
        {(stage === 'scanning' || stage === 'verifying') && (
          <Animated.View
            style={[
              styles.scanLine,
              {
                backgroundColor: color + '40',
                transform: [{ rotate: spin }],
              },
            ]}
          />
        )}
      </Animated.View>

      {/* Status label */}
      <Animated.View style={[styles.statusBadge, { opacity: fadeAnim }]}>
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <Text style={[styles.statusText, { color }]}>
          {stageLabels[stage]}
        </Text>
      </Animated.View>

      {/* Confidence score */}
      {confidence !== undefined && confidence > 0 && (
        <View style={styles.confidenceBadge}>
          <Text style={styles.confidenceLabel}>Confidence</Text>
          <Text style={[styles.confidenceValue, { color }]}>
            {Math.round(confidence * 100)}%
          </Text>
        </View>
      )}

      {/* Liveness challenge */}
      {challengeText && (
        <View style={styles.challengeContainer}>
          <Text style={styles.challengeText}>{challengeText}</Text>
        </View>
      )}
    </View>
  );
}

const CORNER_SIZE = 40;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: {
    ...(StyleSheet.absoluteFill as object),
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticle: {
    width: RETICLE_SIZE,
    height: RETICLE_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: Radii.sm,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: Radii.sm,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: Radii.sm,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: Radii.sm,
  },
  scanLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 2,
    marginTop: -1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.overlay,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
    marginTop: Spacing.xl,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  confidenceBadge: {
    position: 'absolute',
    bottom: 120,
    alignItems: 'center',
    backgroundColor: Colors.bg.overlay,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.md,
  },
  confidenceLabel: {
    ...Typography.labelSmall,
    color: Colors.text.tertiary,
  },
  confidenceValue: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  challengeContainer: {
    position: 'absolute',
    top: 80,
    backgroundColor: Colors.bg.overlay,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.warning[500] + '40',
  },
  challengeText: {
    ...Typography.headingMedium,
    color: Colors.warning[300],
    textAlign: 'center',
  },
});
