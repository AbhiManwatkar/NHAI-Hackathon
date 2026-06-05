/**
 * FaceGuard Offline – AuthScreen
 * ================================
 * Face recognition authentication screen with camera simulation,
 * liveness challenge, and animated pipeline visualization.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Dimensions, Pressable,
} from 'react-native';
import { Colors, Spacing, Typography, Radii } from '../theme';
import { FaceOverlay } from '../components/FaceOverlay';
import { LivenessChallenge, ChallengeType } from '../components/LivenessChallenge';
import { ActionButton } from '../components/ActionButton';
import { GlassCard } from '../components/GlassCard';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CHALLENGES: ChallengeType[] = ['blink', 'smile', 'turn_left', 'turn_right'];

interface AuthScreenProps { navigation: any; }

type PipelineStage = 'idle' | 'scanning' | 'detected' | 'liveness' | 'verifying' | 'success' | 'failed';

export function AuthScreen({ navigation }: AuthScreenProps) {
  const [stage, setStage] = useState<PipelineStage>('idle');
  const [challenge, setChallenge] = useState<ChallengeType>('blink');
  const [challengeProgress, setChallengeProgress] = useState(0);
  const [challengeTime, setChallengeTime] = useState(5);
  const [livenessPassed, setLivenessPassed] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [latency, setLatency] = useState(0);
  const [matchName, setMatchName] = useState('');
  const bgAnim = useRef(new Animated.Value(0)).current;

  const runPipeline = () => {
    const startTime = Date.now();
    setStage('scanning');
    setConfidence(0);
    setLivenessPassed(false);
    setChallengeProgress(0);
    setChallengeTime(5);

    // Stage 1: Scanning → Detected (simulate BlazeFace ~300ms)
    setTimeout(() => setStage('detected'), 800);

    // Stage 2: Liveness challenge
    setTimeout(() => {
      const c = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
      setChallenge(c);
      setStage('liveness');
      // Simulate progressive liveness completion
      let prog = 0;
      const interval = setInterval(() => {
        prog += 0.15;
        setChallengeProgress(Math.min(prog, 1));
        setChallengeTime(t => Math.max(0, t - 0.3));
        if (prog >= 1) {
          clearInterval(interval);
          setLivenessPassed(true);
          setTimeout(() => setStage('verifying'), 600);
        }
      }, 300);
    }, 1500);

    // Stage 3: Verification
    setTimeout(() => {
      const conf = 0.93 + Math.random() * 0.05;
      setConfidence(conf);
      setMatchName('Sarthak Kale');
      setLatency(Date.now() - startTime);
      setStage('success');
      Animated.timing(bgAnim, { toValue: 1, duration: 500, useNativeDriver: false }).start();
    }, 4500);
  };

  const overlayStage = stage === 'liveness' ? 'verifying' : stage === 'idle' ? 'scanning' : stage as any;

  return (
    <View style={styles.screen}>
      {/* Simulated camera background */}
      <Animated.View style={[styles.cameraSimulation, {
        backgroundColor: bgAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [Colors.bg.secondary, Colors.accent[900] + '30'],
        }),
      }]}>
        <View style={styles.cameraBg}>
          <Text style={styles.cameraLabel}>📷 Camera Preview</Text>
          <Text style={[Typography.bodySmall, { color: Colors.text.tertiary }]}>
            {stage === 'idle' ? 'Tap Start to begin' : 'Processing…'}
          </Text>
        </View>
      </Animated.View>

      {/* Face overlay */}
      {stage !== 'idle' && (
        <FaceOverlay
          stage={overlayStage}
          confidence={confidence}
          matchName={stage === 'success' ? matchName : undefined}
        />
      )}

      {/* Liveness challenge overlay */}
      {stage === 'liveness' && (
        <View style={styles.livenessOverlay}>
          <LivenessChallenge
            challenge={challenge}
            progress={challengeProgress}
            timeRemaining={Math.ceil(challengeTime)}
            passed={livenessPassed}
          />
        </View>
      )}

      {/* Bottom panel */}
      <View style={styles.bottomPanel}>
        {stage === 'idle' && (
          <>
            <Text style={[Typography.displayMedium, { color: Colors.text.primary, textAlign: 'center' }]}>
              Face Authentication
            </Text>
            <Text style={[Typography.bodyMedium, { color: Colors.text.secondary, textAlign: 'center', marginTop: Spacing.sm }]}>
              Position your face within the frame
            </Text>
            <ActionButton title="Start Recognition" onPress={runPipeline} variant="accent" size="lg" style={{ marginTop: Spacing.xl }} />
          </>
        )}

        {stage === 'success' && (
          <GlassCard variant="highlight" glowColor={Colors.accent[500]}>
            <View style={styles.resultContainer}>
              <Text style={{ fontSize: 48, marginBottom: Spacing.md }}>✅</Text>
              <Text style={[Typography.displayMedium, { color: Colors.accent[400] }]}>Verified</Text>
              <Text style={[Typography.headingMedium, { color: Colors.text.primary, marginTop: Spacing.sm }]}>{matchName}</Text>
              <View style={styles.resultMetrics}>
                <View style={styles.resultMetric}>
                  <Text style={[Typography.labelSmall, { color: Colors.text.tertiary }]}>Confidence</Text>
                  <Text style={[Typography.monoLarge, { color: Colors.accent[400] }]}>{Math.round(confidence * 100)}%</Text>
                </View>
                <View style={styles.resultMetric}>
                  <Text style={[Typography.labelSmall, { color: Colors.text.tertiary }]}>Latency</Text>
                  <Text style={[Typography.monoLarge, { color: Colors.primary[400] }]}>{latency}ms</Text>
                </View>
              </View>
              <ActionButton title="Done" onPress={() => { bgAnim.setValue(0); setStage('idle'); navigation.goBack(); }} variant="ghost" size="md" style={{ marginTop: Spacing.lg }} />
            </View>
          </GlassCard>
        )}

        {(stage === 'scanning' || stage === 'detected' || stage === 'verifying') && (
          <View style={styles.pipelineStatus}>
            {['BlazeFace', 'CLAHE', 'MobileFaceNet', 'MiniFASNet', 'Match'].map((s, i) => {
              const activeIdx = stage === 'scanning' ? 0 : stage === 'detected' ? 1 : 3;
              const isActive = i === activeIdx;
              const isDone = i < activeIdx;
              return (
                <View key={s} style={styles.pipelineStep}>
                  <View style={[styles.pipelineDot, {
                    backgroundColor: isDone ? Colors.accent[400] : isActive ? Colors.primary[400] : Colors.border.default,
                  }]} />
                  <Text style={[Typography.labelSmall, {
                    color: isDone ? Colors.accent[400] : isActive ? Colors.primary[400] : Colors.text.tertiary, fontSize: 9,
                  }]}>{s}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Back button */}
      <Pressable style={styles.backButton} onPress={() => { bgAnim.setValue(0); setStage('idle'); navigation.goBack(); }}>
        <Text style={{ fontSize: 20, color: Colors.text.primary }}>←</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg.primary },
  cameraSimulation: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cameraBg: { alignItems: 'center' },
  cameraLabel: { fontSize: 48, marginBottom: Spacing.md },
  livenessOverlay: { position: 'absolute', top: SCREEN_H * 0.15, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  bottomPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.bg.overlay, paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: Spacing.xxxl + 16, borderTopLeftRadius: Radii.xl, borderTopRightRadius: Radii.xl, borderTopWidth: 1, borderColor: Colors.border.subtle },
  resultContainer: { alignItems: 'center' },
  resultMetrics: { flexDirection: 'row', gap: Spacing.xxl, marginTop: Spacing.lg },
  resultMetric: { alignItems: 'center' },
  pipelineStatus: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.md },
  pipelineStep: { alignItems: 'center', flex: 1 },
  pipelineDot: { width: 12, height: 12, borderRadius: 6, marginBottom: Spacing.xs },
  backButton: { position: 'absolute', top: Spacing.xxxl + 8, left: Spacing.lg, width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bg.overlay, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border.subtle },
});
