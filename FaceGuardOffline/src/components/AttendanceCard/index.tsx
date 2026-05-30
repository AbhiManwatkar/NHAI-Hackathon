/**
 * @fileoverview AttendanceCard Component
 * @description Renders a beautifully styled list item representing a personnel attendance record.
 * Displays avatar icons, timestamps, matching confidence indicators, liveness badges,
 * and visual synchronization indicators to show eventual upload progress.
 *
 * @module components/AttendanceCard
 * @version 1.0.0
 */

import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { AttendanceRecord } from '../../types';

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
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  glassBackground: 'rgba(27, 40, 56, 0.70)',
};

export interface AttendanceCardProps {
  /** The attendance item log */
  record: AttendanceRecord;
  /** Index for entrance animations */
  index: number;
}

export const AttendanceCard: React.FC<AttendanceCardProps> = ({ record, index }) => {
  // Format dates
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return '';
    }
  };

  const confidencePct = Math.round(record.confidence * 100);
  const livenessPct = Math.round(record.livenessScore * 100);

  return (
    <Animated.View entering={FadeInUp.delay(index * 80).duration(450)} style={styles.card}>
      <View style={styles.avatarContainer}>
        {/* Placeholder Avatar icon */}
        <Text style={styles.avatarIcon}>👤</Text>
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.row}>
          <Text style={styles.nameText} numberOfLines={1}>
            {record.personnelName}
          </Text>
          {/* Sync indicator */}
          <View style={styles.syncContainer}>
            <Text style={styles.syncIcon}>{record.isSynced ? '☁️ ✅' : '💾'}</Text>
            <Text style={[styles.syncText, record.isSynced && styles.syncedText]}>
              {record.isSynced ? 'Cloud' : 'Offline'}
            </Text>
          </View>
        </View>

        <View style={[styles.row, styles.metaRow]}>
          <Text style={styles.timeText}>⏱️ {formatTime(record.timestamp)}</Text>
          <Text style={styles.dateText}>📅 {formatDate(record.timestamp)}</Text>
        </View>

        {/* Scoring Indicators */}
        <View style={styles.scoresRow}>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>Match Match</Text>
            <View style={styles.scoreTrack}>
              <View
                style={[
                  styles.scoreBar,
                  { width: `${confidencePct}%`, backgroundColor: Colors.primaryOrange },
                ]}
              />
            </View>
            <Text style={styles.scoreValue}>{confidencePct}%</Text>
          </View>

          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>Liveness</Text>
            <View style={styles.scoreTrack}>
              <View
                style={[
                  styles.scoreBar,
                  { width: `${livenessPct}%`, backgroundColor: Colors.success },
                ]}
              />
            </View>
            <Text style={styles.scoreValue}>{livenessPct}%</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.glassBackground,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    ...Platform.select({
      android: { elevation: 2 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
    }),
  },
  avatarContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarIcon: {
    fontSize: 22,
  },
  infoContainer: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaRow: {
    marginTop: 4,
    marginBottom: 8,
  },
  nameText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  syncContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  syncIcon: {
    fontSize: 10,
    marginRight: 4,
  },
  syncText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  syncedText: {
    color: Colors.success,
  },
  timeText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  scoresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  scoreItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textSecondary,
    width: 44,
  },
  scoreTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginHorizontal: 6,
    overflow: 'hidden',
  },
  scoreBar: {
    height: '100%',
    borderRadius: 2,
  },
  scoreValue: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textPrimary,
    width: 24,
    textAlign: 'right',
  },
});

export default AttendanceCard;
