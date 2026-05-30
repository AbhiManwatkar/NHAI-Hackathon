import React, { useEffect, useMemo, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ActiveChallengeId, ChallengeDefinition } from '../../modules/LivenessDetector';

export interface LivenessChallengeProps {
  challenge: ChallengeDefinition | ActiveChallengeId | string;
  timeoutMs?: number;
  progress?: number;
  timeLeft?: number;
  completedCount?: number;
  totalCount?: number;
  feedbackMessage?: string;
  state?: 'active' | 'passed' | 'failed';
  onPass?: () => void;
  onFail?: () => void;
  onSkip?: () => void;
}

const CHALLENGE_TEXT: Record<ActiveChallengeId, string> = {
  BLINK: 'Blink twice',
  TURN_LEFT: 'Turn your head left',
  TURN_RIGHT: 'Turn your head right',
  SMILE: 'Give a smile',
  NOD: 'Nod slowly',
};

export const LivenessChallenge: React.FC<LivenessChallengeProps> = ({
  challenge,
  timeoutMs = typeof challenge === 'string' ? 4000 : challenge.timeoutMs,
  progress = 0,
  timeLeft,
  completedCount = 0,
  totalCount = 2,
  feedbackMessage,
  state = 'active',
  onPass,
  onFail,
  onSkip,
}) => {
  const slide = useRef(new Animated.Value(24)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const countdown = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  const meta = useMemo(() => normalizeChallenge(challenge), [challenge]);
  const secondsLeft = timeLeft ?? Math.max(0, Math.ceil(((1 - progress) * timeoutMs) / 1000));

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(meta.instruction);
    slide.setValue(24);
    opacity.setValue(0);
    countdown.setValue(1);

    Animated.parallel([
      Animated.timing(slide, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(countdown, {
        toValue: 0,
        duration: timeoutMs,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    ]).start();
  }, [challenge, countdown, meta.instruction, opacity, slide, timeoutMs]);

  useEffect(() => {
    if (state === 'passed') {
      pop.setValue(0);
      Animated.spring(pop, {
        toValue: 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true,
      }).start(() => onPass?.());
    }
    if (state === 'failed') {
      shake.setValue(0);
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start(() => onFail?.());
    }
  }, [onFail, onPass, pop, shake, state]);

  const sweepWidth = countdown.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  const shakeX = shake.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-10, 0, 10],
  });

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLabel={`Liveness challenge. ${meta.instruction}. ${secondsLeft} seconds remaining.`}
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY: slide }, { translateX: shakeX }],
        },
      ]}
    >
      <View style={styles.ring}>
        <Animated.View style={[styles.ringProgress, { width: sweepWidth }]} />
        <Animated.Text
          style={[
            styles.statusGlyph,
            {
              opacity: state === 'passed' ? 1 : 0,
              transform: [{ scale: pop }],
            },
          ]}
        >
          OK
        </Animated.Text>
      </View>

      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.counter}>
            {completedCount + 1}/{totalCount}
          </Text>
          <Text style={[styles.timer, secondsLeft <= 2 && styles.timerAlert]}>{secondsLeft}s</Text>
        </View>
        <Text style={styles.instruction}>{meta.instruction}</Text>
        <Text style={styles.feedback}>{feedbackMessage ?? 'Follow the prompt naturally'}</Text>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${Math.max(0, Math.min(1, progress)) * 100}%` }]}
          />
        </View>
        {onSkip ? (
          <Pressable accessibilityRole="button" onPress={onSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
};

function normalizeChallenge(
  challenge: ChallengeDefinition | ActiveChallengeId | string,
): ChallengeDefinition {
  if (typeof challenge === 'string') {
    const id = isActiveChallengeId(challenge) ? challenge : 'BLINK';
    return {
      id,
      instruction: CHALLENGE_TEXT[id],
      timeoutMs: id === 'NOD' ? 5000 : 4000,
    };
  }
  return challenge;
}

function isActiveChallengeId(value: string): value is ActiveChallengeId {
  return (
    value === 'BLINK' ||
    value === 'TURN_LEFT' ||
    value === 'TURN_RIGHT' ||
    value === 'SMILE' ||
    value === 'NOD'
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 72,
    alignItems: 'center',
  },
  ring: {
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 5,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  ringProgress: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 200, 83, 0.42)',
  },
  statusGlyph: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: '#08131F',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 8,
    padding: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  counter: {
    color: '#D7E3F0',
    fontSize: 16,
    fontWeight: '800',
  },
  timer: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  timerAlert: {
    color: '#FF5252',
  },
  instruction: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
  },
  feedback: {
    color: '#D7E3F0',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 8,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00C853',
  },
  skipButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
  },
  skipText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});

export default LivenessChallenge;
