/**
 * @fileoverview CameraOverlay Component
 * @description Renders a full-screen camera guide overlay featuring a semi-transparent dark mask
 * with a centered oval face cutout guide, instruction banners, and a glowing animated laser scanning line.
 *
 * @module components/CameraOverlay
 * @version 1.0.0
 */

import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Dimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Cutout dimensions (Oval shaped guide)
const CUTOUT_WIDTH = SCREEN_WIDTH * 0.7;
const CUTOUT_HEIGHT = CUTOUT_WIDTH * 1.3;
const CUTOUT_TOP = (SCREEN_HEIGHT - CUTOUT_HEIGHT) / 2.5;
const CUTOUT_LEFT = (SCREEN_WIDTH - CUTOUT_WIDTH) / 2;

export interface CameraOverlayProps {
  /** Dynamic user prompt message (e.g. 'Fit your face inside the frame') */
  instruction?: string;
  /** Custom warning/alert message if something is wrong (e.g. 'Too close') */
  warningMessage?: string;
}

export const CameraOverlay: React.FC<CameraOverlayProps> = ({
  instruction = 'Position your face within the guide frame',
  warningMessage,
}) => {
  const scanLineY = useSharedValue(0);
  const borderOpacity = useSharedValue(0.5);

  useEffect(() => {
    // Laser scan animation
    scanLineY.value = withRepeat(
      withTiming(CUTOUT_HEIGHT - 4, {
        duration: 2500,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );

    // Frame pulse animation
    borderOpacity.value = withRepeat(
      withSequence(withTiming(1.0, { duration: 1000 }), withTiming(0.4, { duration: 1000 })),
      -1,
      true,
    );
  }, [scanLineY, borderOpacity]);

  const animatedLaserStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLineY.value }],
  }));

  const animatedFrameStyle = useAnimatedStyle(() => ({
    opacity: borderOpacity.value,
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* ── Semi-transparent Mask with Cutout ── */}
      {/* Top Mask */}
      <View style={[styles.mask, { top: 0, left: 0, right: 0, height: CUTOUT_TOP }]} />
      {/* Bottom Mask */}
      <View
        style={[
          styles.mask,
          {
            top: CUTOUT_TOP + CUTOUT_HEIGHT,
            left: 0,
            right: 0,
            bottom: 0,
          },
        ]}
      />
      {/* Left Mask */}
      <View
        style={[
          styles.mask,
          {
            top: CUTOUT_TOP,
            left: 0,
            width: CUTOUT_LEFT,
            height: CUTOUT_HEIGHT,
          },
        ]}
      />
      {/* Right Mask */}
      <View
        style={[
          styles.mask,
          {
            top: CUTOUT_TOP,
            right: 0,
            left: CUTOUT_LEFT + CUTOUT_WIDTH,
            height: CUTOUT_HEIGHT,
          },
        ]}
      />

      {/* ── Active Border Guide (Oval Cutout border) ── */}
      <Animated.View
        style={[
          styles.cutoutBorder,
          {
            top: CUTOUT_TOP,
            left: CUTOUT_LEFT,
            width: CUTOUT_WIDTH,
            height: CUTOUT_HEIGHT,
          },
          animatedFrameStyle,
        ]}
      >
        {/* Animated Laser Scanning Line */}
        <Animated.View style={[styles.laserLine, animatedLaserStyle]} />
      </Animated.View>

      {/* ── Top Floating Instruction Bar ── */}
      <View style={[styles.floatingBar, styles.instructionBar]}>
        <Text style={styles.instructionText}>{instruction}</Text>
      </View>

      {/* ── Bottom Floating Warning Bar ── */}
      {warningMessage ? (
        <View style={[styles.floatingBar, styles.warningBar]}>
          <Text style={styles.warningText}>⚠️ {warningMessage}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  mask: {
    position: 'absolute',
    backgroundColor: 'rgba(13, 27, 42, 0.70)',
  },
  cutoutBorder: {
    position: 'absolute',
    borderRadius: CUTOUT_WIDTH / 2,
    borderWidth: 2,
    borderColor: '#FF6B00',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#FF6B00',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
      },
      android: {},
    }),
  },
  laserLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#FF6B00',
    opacity: 0.8,
    ...Platform.select({
      ios: {
        shadowColor: '#FF6B00',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 6,
      },
      android: {},
    }),
  },
  floatingBar: {
    position: 'absolute',
    left: 24,
    right: 24,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    ...Platform.select({
      android: { elevation: 4 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
  },
  instructionBar: {
    top: Platform.OS === 'ios' ? 70 : 40,
    backgroundColor: 'rgba(27, 40, 56, 0.90)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  warningBar: {
    bottom: Platform.OS === 'ios' ? 140 : 100,
    backgroundColor: 'rgba(255, 23, 68, 0.95)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  warningText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
});

export default CameraOverlay;
