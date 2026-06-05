/**
 * FaceGuard Offline – EnrollScreen
 * ==================================
 * Employee enrollment screen with multi-angle capture simulation,
 * quality scoring, and enrollment confirmation.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Animated, Pressable,
} from 'react-native';
import { Colors, Spacing, Typography, Radii } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { ActionButton } from '../components/ActionButton';
import { MetricBadge } from '../components/MetricBadge';

interface EnrollScreenProps { navigation: any; }

type EnrollStage = 'form' | 'capturing' | 'processing' | 'complete';

const ANGLES = [
  { label: 'Front', icon: '🙂', instruction: 'Look straight at the camera' },
  { label: 'Left', icon: '👈', instruction: 'Turn your head slightly left' },
  { label: 'Right', icon: '👉', instruction: 'Turn your head slightly right' },
];

export function EnrollScreen({ navigation }: EnrollScreenProps) {
  const [stage, setStage] = useState<EnrollStage>('form');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [currentAngle, setCurrentAngle] = useState(0);
  const [angleCaptured, setAngleCaptured] = useState([false, false, false]);
  const [qualityScore, setQualityScore] = useState(0);
  const [enrollId, setEnrollId] = useState('');
  const progressAnim = React.useRef(new Animated.Value(0)).current;

  const startCapture = () => {
    if (!name.trim() || !department.trim()) return;
    setStage('capturing');
    setCurrentAngle(0);
    setAngleCaptured([false, false, false]);
  };

  const captureAngle = () => {
    const newCaptured = [...angleCaptured];
    newCaptured[currentAngle] = true;
    setAngleCaptured(newCaptured);

    if (currentAngle < 2) {
      setTimeout(() => setCurrentAngle(currentAngle + 1), 500);
    } else {
      // All angles captured → process
      setStage('processing');
      Animated.timing(progressAnim, { toValue: 1, duration: 2000, useNativeDriver: false }).start();
      setTimeout(() => {
        setQualityScore(0.94 + Math.random() * 0.04);
        setEnrollId('EMP-' + Math.random().toString(36).substring(2, 8).toUpperCase());
        setStage('complete');
      }, 2500);
    }
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ fontSize: 20, color: Colors.text.primary }}>←</Text>
        </Pressable>
        <Text style={[Typography.headingLarge, { color: Colors.text.primary }]}>Enroll Employee</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {stage === 'form' && (
          <>
            <GlassCard variant="elevated" style={styles.formCard}>
              <Text style={[Typography.labelMedium, { color: Colors.text.tertiary, marginBottom: Spacing.sm }]}>Employee Details</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Rajesh Kumar"
                  placeholderTextColor={Colors.text.tertiary}
                  value={name}
                  onChangeText={setName}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Department</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Site Operations"
                  placeholderTextColor={Colors.text.tertiary}
                  value={department}
                  onChangeText={setDepartment}
                />
              </View>
            </GlassCard>

            <GlassCard variant="default" style={styles.infoCard}>
              <Text style={[Typography.labelSmall, { color: Colors.text.tertiary }]}>Enrollment Process</Text>
              <Text style={[Typography.bodyMedium, { color: Colors.text.secondary, marginTop: Spacing.sm }]}>
                Three face captures (front, left, right) will be taken and averaged into a single 128-d embedding for robust matching.
              </Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoItem}>🔒 AES-256 encrypted</Text>
                <Text style={styles.infoItem}>📱 Stored on-device</Text>
              </View>
            </GlassCard>

            <ActionButton
              title="Start Face Capture"
              onPress={startCapture}
              variant="accent"
              size="lg"
              disabled={!name.trim() || !department.trim()}
              style={{ marginTop: Spacing.xl }}
            />
          </>
        )}

        {stage === 'capturing' && (
          <>
            {/* Angle progress */}
            <View style={styles.angleProgress}>
              {ANGLES.map((a, i) => (
                <View key={a.label} style={[styles.angleStep, i === currentAngle && styles.angleStepActive]}>
                  <View style={[styles.angleDot, {
                    backgroundColor: angleCaptured[i] ? Colors.accent[400] : i === currentAngle ? Colors.primary[400] : Colors.border.default,
                  }]}>
                    <Text style={{ fontSize: 16 }}>{angleCaptured[i] ? '✓' : a.icon}</Text>
                  </View>
                  <Text style={[Typography.labelSmall, {
                    color: i === currentAngle ? Colors.primary[400] : Colors.text.tertiary, marginTop: Spacing.xs,
                  }]}>{a.label}</Text>
                </View>
              ))}
            </View>

            {/* Camera simulation */}
            <View style={styles.cameraSim}>
              <Text style={{ fontSize: 64, marginBottom: Spacing.md }}>{ANGLES[currentAngle].icon}</Text>
              <Text style={[Typography.headingMedium, { color: Colors.text.primary }]}>{ANGLES[currentAngle].instruction}</Text>
              <Text style={[Typography.bodySmall, { color: Colors.text.tertiary, marginTop: Spacing.sm }]}>
                Capture {currentAngle + 1} of 3
              </Text>
            </View>

            <ActionButton title="Capture" onPress={captureAngle} variant="primary" size="lg" icon={<Text style={{ fontSize: 20 }}>📸</Text>} style={{ marginTop: Spacing.xl }} />
          </>
        )}

        {stage === 'processing' && (
          <View style={styles.processingContainer}>
            <Text style={{ fontSize: 64, marginBottom: Spacing.xl }}>⚙️</Text>
            <Text style={[Typography.headingLarge, { color: Colors.text.primary }]}>Processing Enrollment</Text>
            <Text style={[Typography.bodyMedium, { color: Colors.text.secondary, marginTop: Spacing.md, textAlign: 'center' }]}>
              Averaging multi-angle embeddings and encrypting with AES-256-CBC…
            </Text>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, {
                width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              }]} />
            </View>
          </View>
        )}

        {stage === 'complete' && (
          <View style={styles.completeContainer}>
            <GlassCard variant="highlight" glowColor={Colors.accent[500]}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 64, marginBottom: Spacing.lg }}>✅</Text>
                <Text style={[Typography.displayMedium, { color: Colors.accent[400] }]}>Enrolled!</Text>
                <Text style={[Typography.headingMedium, { color: Colors.text.primary, marginTop: Spacing.md }]}>{name}</Text>
                <Text style={[Typography.bodyMedium, { color: Colors.text.secondary }]}>{department}</Text>
                <View style={styles.enrollMetrics}>
                  <MetricBadge label="Quality" value={Math.round(qualityScore * 100) + '%'} color={Colors.accent[400]} />
                  <MetricBadge label="Embedding" value="128-d" color={Colors.primary[400]} />
                  <MetricBadge label="Encrypted" value="AES" color={Colors.warning[400]} />
                </View>
                <Text style={[Typography.mono, { color: Colors.text.tertiary, marginTop: Spacing.lg }]}>ID: {enrollId}</Text>
              </View>
            </GlassCard>
            <ActionButton title="Done" onPress={() => navigation.goBack()} variant="primary" size="lg" style={{ marginTop: Spacing.xl }} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.xxxl + 8, paddingBottom: Spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.glass.light, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border.subtle },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl },
  formCard: { marginTop: Spacing.lg },
  inputGroup: { marginTop: Spacing.md },
  inputLabel: { ...Typography.labelSmall, color: Colors.text.secondary, marginBottom: Spacing.xs },
  input: { backgroundColor: Colors.bg.tertiary, borderRadius: Radii.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, color: Colors.text.primary, fontSize: 16, borderWidth: 1, borderColor: Colors.border.subtle },
  infoCard: { marginTop: Spacing.md },
  infoRow: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.md },
  infoItem: { ...Typography.bodySmall, color: Colors.text.secondary },
  angleProgress: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xxl, marginTop: Spacing.xl },
  angleStep: { alignItems: 'center' },
  angleStepActive: { transform: [{ scale: 1.1 }] },
  angleDot: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.border.default },
  cameraSim: { alignItems: 'center', marginTop: Spacing.xxxl, paddingVertical: Spacing.xxxl, backgroundColor: Colors.bg.secondary, borderRadius: Radii.xl, borderWidth: 1, borderColor: Colors.border.subtle },
  processingContainer: { alignItems: 'center', paddingTop: Spacing.xxxl * 2 },
  progressTrack: { width: '80%', height: 6, backgroundColor: Colors.border.subtle, borderRadius: Radii.full, overflow: 'hidden', marginTop: Spacing.xl },
  progressFill: { height: '100%', backgroundColor: Colors.accent[400], borderRadius: Radii.full },
  completeContainer: { marginTop: Spacing.xl },
  enrollMetrics: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
});
