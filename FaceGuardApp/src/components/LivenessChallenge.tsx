/**
 * FaceGuard Offline – LivenessChallenge Component
 * ==================================================
 *
 * Implements the challenge-response liveness verification UI.
 * Displays random challenges (blink, smile, nod) with animated
 * progress indicators and countdown timer.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Colors, Radii, Spacing, Typography } from '../theme';

export type ChallengeType = 'blink' | 'smile' | 'turn_left' | 'turn_right' | 'nod';

interface LivenessChallengeProps {
  /** The challenge to display */
  challenge: ChallengeType;
  /** 0-1 progress towards completing the challenge */
  progress: number;
  /** Seconds remaining to complete */
  timeRemaining: number;
  /** Whether the challenge was passed */
  passed?: boolean;
}

const CHALLENGE_CONFIG: Record<ChallengeType, { icon: string; label: string }> = {
  blink:      { icon: '👁️', label: 'Please blink slowly' },
  smile:      { icon: '😊', label: 'Please smile' },
  turn_left:  { icon: '👈', label: 'Turn your head left' },
  turn_right: { icon: '👉', label: 'Turn your head right' },
  nod:        { icon: '↕️', label: 'Nod your head' },
};

export function LivenessChallenge({
  challenge,
  progress,
  timeRemaining,
  passed,
}: LivenessChallengeProps) {
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;
  const progressAnim = React.useRef(new Animated.Value(0)).current;
  const checkAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
    }).start();
  }, [challenge, scaleAnim]);

  React.useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  React.useEffect(() => {
    if (passed) {
      Animated.spring(checkAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 4,
      }).start();
    } else {
      checkAnim.setValue(0);
    }
  }, [passed, checkAnim]);

  const config = CHALLENGE_CONFIG[challenge];
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const isUrgent = timeRemaining <= 3;

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      {passed ? (
        // ── Success state ──
        <Animated.View
          style={[
            styles.successContainer,
            {
              transform: [{ scale: checkAnim }],
              opacity: checkAnim,
            },
          ]}
        >
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successText}>Liveness verified</Text>
        </Animated.View>
      ) : (
        // ── Challenge state ──
        <>
          <Text style={styles.icon}>{config.icon}</Text>
          <Text style={styles.label}>{config.label}</Text>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressWidth,
                  backgroundColor:
                    progress > 0.8
                      ? Colors.accent[400]
                      : Colors.primary[400],
                },
              ]}
            />
          </View>

          {/* Timer */}
          <Text
            style={[
              styles.timer,
              isUrgent && { color: Colors.danger[400] },
            ]}
          >
            {timeRemaining}s
          </Text>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: Colors.bg.overlay,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xxl,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Colors.warning[500] + '30',
    minWidth: 260,
  },
  icon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.headingMedium,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.border.subtle,
    borderRadius: Radii.full,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: Radii.full,
  },
  timer: {
    ...Typography.mono,
    color: Colors.text.tertiary,
    fontSize: 16,
  },
  successContainer: {
    alignItems: 'center',
  },
  successIcon: {
    fontSize: 56,
    marginBottom: Spacing.md,
  },
  successText: {
    ...Typography.headingMedium,
    color: Colors.accent[400],
  },
});
