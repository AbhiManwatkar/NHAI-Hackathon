/**
 * FaceGuard Offline – HomeScreen
 * ================================
 * Main dashboard with system status, quick actions, and navigation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Animated, StatusBar, Dimensions,
} from 'react-native';
import { Colors, Spacing, Typography, Radii, Shadows } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { ActionButton } from '../components/ActionButton';
import { MetricBadge } from '../components/MetricBadge';
import { SyncStatusBar } from '../components/SyncStatusBar';

interface HomeScreenProps { navigation: any; }

export function HomeScreen({ navigation }: HomeScreenProps) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(30)).current;
  const [stats, setStats] = useState({
    totalEmployees: 47, todayCheckIns: 32, queueSize: 3,
    lastSync: new Date(Date.now() - 15 * 60000).toISOString(),
    avgLatency: 380, accuracy: 97.2, isOnline: false, isSyncing: false,
  });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleSync = useCallback(() => {
    setStats(s => ({ ...s, isSyncing: true }));
    setTimeout(() => {
      setStats(s => ({ ...s, isSyncing: false, queueSize: 0, lastSync: new Date().toISOString(), isOnline: true }));
    }, 2000);
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.primary} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.logoRow}>
            <View style={styles.logoBadge}><Text style={{ fontSize: 24 }}>🛡️</Text></View>
            <View>
              <Text style={[Typography.displaySmall, { color: Colors.text.primary }]}>FaceGuard</Text>
              <Text style={[Typography.bodySmall, { color: Colors.text.tertiary }]}>Offline Biometric System</Text>
            </View>
          </View>
          <View style={styles.siteBadge}><Text style={styles.siteText}>NH-044</Text></View>
        </Animated.View>

        <SyncStatusBar isOnline={stats.isOnline} queueSize={stats.queueSize} lastSyncTime={stats.lastSync} isSyncing={stats.isSyncing} />

        {/* Metrics */}
        <Animated.View style={[styles.metricsRow, { opacity: fadeAnim }]}>
          <MetricBadge label="Enrolled" value={stats.totalEmployees} color={Colors.primary[400]} />
          <MetricBadge label="Today" value={stats.todayCheckIns} color={Colors.accent[400]} />
          <MetricBadge label="Latency" value={stats.avgLatency} unit="ms" color={Colors.warning[400]} />
          <MetricBadge label="Accuracy" value={stats.accuracy + '%'} color={Colors.accent[400]} />
        </Animated.View>

        {/* Hero CTA */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <GlassCard variant="highlight" glowColor={Colors.accent[500]} onPress={() => navigation.navigate('Auth')} style={styles.heroCard}>
          <View style={styles.heroInner}>
            <View style={styles.heroIconBox}><Text style={{ fontSize: 28 }}>📸</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={[Typography.headingLarge, { color: Colors.text.primary }]}>Mark Attendance</Text>
              <Text style={[Typography.bodySmall, { color: Colors.text.secondary }]}>Face scan → Verify → Done in &lt;1s</Text>
            </View>
            <Text style={{ fontSize: 24, color: Colors.accent[400] }}>→</Text>
          </View>
        </GlassCard>

        <View style={styles.actionGrid}>
          <GlassCard variant="elevated" onPress={() => navigation.navigate('Enroll')} style={styles.actionCard}>
            <Text style={{ fontSize: 32 }}>👤</Text>
            <Text style={[Typography.headingSmall, { color: Colors.text.primary }]}>Enroll</Text>
            <Text style={[Typography.bodySmall, { color: Colors.text.tertiary }]}>Add employee</Text>
          </GlassCard>
          <GlassCard variant="elevated" onPress={() => navigation.navigate('Admin')} style={styles.actionCard}>
            <Text style={{ fontSize: 32 }}>⚙️</Text>
            <Text style={[Typography.headingSmall, { color: Colors.text.primary }]}>Admin</Text>
            <Text style={[Typography.bodySmall, { color: Colors.text.tertiary }]}>Settings & stats</Text>
          </GlassCard>
        </View>

        {/* System Health */}
        <Text style={styles.sectionTitle}>System Health</Text>
        <GlassCard variant="default" style={{ marginHorizontal: Spacing.lg }}>
          <View style={styles.statusRow}>
            {[
              { label: 'ML Engine', value: 'Ready', ok: true },
              { label: 'Vault', value: 'Encrypted', ok: true },
              { label: 'Network', value: stats.isOnline ? 'Connected' : 'Offline', ok: stats.isOnline },
            ].map(s => (
              <View key={s.label} style={styles.statusItem}>
                <View style={[styles.dot, { backgroundColor: s.ok ? Colors.accent[400] : Colors.warning[500] }]} />
                <Text style={[Typography.labelSmall, { color: Colors.text.tertiary }]}>{s.label}</Text>
                <Text style={[Typography.bodySmall, { color: Colors.text.secondary, fontWeight: '600' }]}>{s.value}</Text>
              </View>
            ))}
          </View>
        </GlassCard>

        {stats.queueSize > 0 && (
          <ActionButton title={`Sync ${stats.queueSize} Records`} onPress={handleSync} variant="primary" size="lg" loading={stats.isSyncing} style={{ marginHorizontal: Spacing.lg, marginTop: Spacing.lg }} />
        )}

        {/* AI Models */}
        <Text style={styles.sectionTitle}>AI Model Cascade</Text>
        <GlassCard variant="default" style={{ marginHorizontal: Spacing.lg }}>
          {[
            { name: 'BlazeFace', task: 'Detection', size: '0.1 MB', time: '<50ms' },
            { name: 'MobileFaceNet', task: 'Embedding', size: '2.3 MB', time: '<200ms' },
            { name: 'MiniFASNet', task: 'Liveness', size: '1.1 MB', time: '<150ms' },
          ].map((m, i) => (
            <View key={m.name} style={[styles.modelRow, i > 0 && { borderTopWidth: 1, borderTopColor: Colors.border.subtle }]}>
              <View style={{ flex: 1 }}>
                <Text style={[Typography.bodyMedium, { color: Colors.text.primary, fontWeight: '600' }]}>{m.name}</Text>
                <Text style={[Typography.bodySmall, { color: Colors.text.tertiary }]}>{m.task}</Text>
              </View>
              <Text style={[Typography.mono, { color: Colors.primary[300], fontSize: 12, marginRight: Spacing.lg }]}>{m.size}</Text>
              <Text style={[Typography.mono, { color: Colors.primary[300], fontSize: 12 }]}>{m.time}</Text>
            </View>
          ))}
          <View style={{ borderTopWidth: 1, borderTopColor: Colors.border.default, paddingTop: Spacing.md, marginTop: Spacing.sm, alignItems: 'center' }}>
            <Text style={[Typography.bodySmall, { color: Colors.accent[400], fontWeight: '700' }]}>Total: 3.5 MB · &lt;430ms</Text>
          </View>
        </GlassCard>

        <View style={styles.footer}>
          <Text style={[Typography.bodySmall, { color: Colors.text.tertiary, fontStyle: 'italic' }]}>Built for the field · Secured by design · Private by default</Text>
          <Text style={[Typography.labelSmall, { color: Colors.border.strong, marginTop: Spacing.xs }]}>v1.0.0 · NHAI Datalake 3.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg.primary },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.xxxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxxl + 16, paddingBottom: Spacing.lg },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  logoBadge: { width: 48, height: 48, borderRadius: Radii.md, backgroundColor: Colors.primary[500] + '20', justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md, borderWidth: 1, borderColor: Colors.primary[500] + '40' },
  siteBadge: { backgroundColor: Colors.primary[500] + '20', borderColor: Colors.primary[500] + '40', borderWidth: 1, borderRadius: Radii.sm, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  siteText: { ...Typography.labelSmall, color: Colors.primary[300] },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, marginTop: Spacing.lg, marginBottom: Spacing.lg, gap: Spacing.sm },
  sectionTitle: { ...Typography.labelLarge, color: Colors.text.tertiary, paddingHorizontal: Spacing.xl, marginTop: Spacing.xl, marginBottom: Spacing.md },
  heroCard: { marginHorizontal: Spacing.lg, borderColor: Colors.accent[500] + '30' },
  heroInner: { flexDirection: 'row', alignItems: 'center' },
  heroIconBox: { width: 56, height: 56, borderRadius: Radii.md, backgroundColor: Colors.accent[500] + '15', justifyContent: 'center', alignItems: 'center', marginRight: Spacing.lg },
  actionGrid: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.md, marginTop: Spacing.md },
  actionCard: { flex: 1, alignItems: 'center', paddingVertical: Spacing.xl },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statusItem: { alignItems: 'center', flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, marginBottom: Spacing.xs },
  modelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md },
  footer: { alignItems: 'center', paddingTop: Spacing.xxxl, paddingBottom: Spacing.lg },
});
