import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import Animated, {
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface AttendanceCardProps {
  employee: {
    name: string;
    employee_code: string;
    designation?: string | null;
    department?: string | null;
  } | null;
  confidence: number;
  livenessScore: number;
  syncQueueCount: number;
  onAction: (type: 'CHECK_IN' | 'CHECK_OUT') => void;
  onDismiss: () => void;
}

export const AttendanceCard: React.FC<AttendanceCardProps> = ({
  employee,
  confidence,
  livenessScore,
  syncQueueCount,
  onAction,
  onDismiss,
}) => {
  if (!employee) return null;

  const initials = employee.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <View style={styles.backdrop}>
      <TouchableOpacity style={styles.dismissOverlay} onPress={onDismiss} />
      <Animated.View
        entering={SlideInDown.duration(400)}
        exiting={SlideOutDown.duration(300)}
        style={styles.sheet}
      >
        <View style={styles.dragHandle} />

        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.employeeInfo}>
            <Text style={styles.nameText}>{employee.name}</Text>
            <Text style={styles.codeText}>{employee.employee_code}</Text>
            <Text style={styles.subtext}>
              {employee.designation || 'Field Agent'} • {employee.department || 'Operations'}
            </Text>
          </View>
        </View>

        <View style={styles.metricsContainer}>
          <Text style={styles.metricLabel}>
            Match Confidence: <Text style={styles.boldText}>{(confidence * 100).toFixed(1)}%</Text>
          </Text>
          <Text style={styles.metricLabel}>
            Liveness Score: <Text style={styles.boldText}>{(livenessScore * 100).toFixed(1)}%</Text>
          </Text>
        </View>

        <View style={styles.offlineBadge}>
          <Text style={styles.offlineBadgeText}>
            💾 Saved locally — {syncQueueCount} records pending sync
          </Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.checkInBtn]}
            onPress={() => onAction('CHECK_IN')}
          >
            <Text style={styles.btnText}>CHECK IN</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.checkOutBtn]}
            onPress={() => onAction('CHECK_OUT')}
          >
            <Text style={styles.btnText}>CHECK OUT</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
    zIndex: 999,
  },
  dismissOverlay: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF6B00',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  employeeInfo: {
    flex: 1,
  },
  nameText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  codeText: {
    color: '#FF6B00',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  subtext: {
    color: '#94A3B8',
    fontSize: 15,
    marginTop: 2,
  },
  metricsContainer: {
    backgroundColor: 'rgba(26, 60, 94, 0.3)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 15,
    marginVertical: 4,
  },
  boldText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  offlineBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  offlineBadgeText: {
    color: '#F59E0B',
    fontSize: 15,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 16,
  },
  actionBtn: {
    flex: 1,
    height: 56, // Gloved hand usability height
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInBtn: {
    backgroundColor: '#22C55E',
  },
  checkOutBtn: {
    backgroundColor: '#EF4444',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
});

export default AttendanceCard;
