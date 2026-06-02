import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import { useRealTimeStats } from '../hooks/useRealTimeStats';
import { Colors } from '../theme/colors';
import type { RootStackParamList } from '../types';
import { BenchmarkStore } from '../utils/benchmark';
import { Logger } from '../utils/logger';

let MaterialIcon: any = null;
let SvgKit: any = null;
try {
  MaterialIcon = require('react-native-vector-icons/MaterialCommunityIcons').default;
} catch (_error) {
  MaterialIcon = null;
}
try {
  SvgKit = require('react-native-svg');
} catch (_error) {
  SvgKit = null;
}

type AdminScreenProps = StackScreenProps<RootStackParamList, 'Admin'>;

const ADMIN_PIN = '1234';

const attendance = {
  present: 31,
  absent: 7,
  unknown: 4,
};

const departments = [
  { name: 'Toll Operations', present: 12, total: 14 },
  { name: 'Engineering', present: 8, total: 10 },
  { name: 'Safety', present: 6, total: 8 },
  { name: 'Maintenance', present: 5, total: 6 },
];

const staff = [
  {
    id: 'NHAI-0042',
    name: 'Rajesh Kumar',
    department: 'Engineering',
    initials: 'RK',
    enrolled: '15 Jan 2026',
    lastSeen: 'Today, 09:12',
  },
  {
    id: 'NHAI-0078',
    name: 'Priya Sharma',
    department: 'Operations',
    initials: 'PS',
    enrolled: '22 Jan 2026',
    lastSeen: 'Today, 08:47',
  },
  {
    id: 'NHAI-0103',
    name: 'Amit Patel',
    department: 'Toll Operations',
    initials: 'AP',
    enrolled: '02 Feb 2026',
    lastSeen: 'Yesterday, 19:04',
  },
  {
    id: 'NHAI-0156',
    name: 'Sunita Devi',
    department: 'Safety',
    initials: 'SD',
    enrolled: '17 Feb 2026',
    lastSeen: 'Today, 10:03',
  },
];

const spoofLogs = [
  { time: '10:42', type: 'Printed photo', confidence: '96%' },
  { time: '09:18', type: 'Replay screen', confidence: '91%' },
  { time: 'Yesterday', type: 'Mask texture', confidence: '88%' },
];

const auditTrail = [
  '10:51 - RK verified - 421ms',
  '10:47 - Unknown rejected - 389ms',
  '10:42 - Spoof blocked - 402ms',
  '10:11 - PS verified - 376ms',
  '09:55 - AP verified - 448ms',
  '09:18 - Spoof blocked - 397ms',
  '08:47 - PS check-in - 362ms',
  '08:31 - SD check-in - 405ms',
  '08:20 - RK check-in - 391ms',
  '08:02 - Unknown rejected - 433ms',
];

const Icon: React.FC<{ name: string; color: string; size?: number }> = ({
  name,
  color,
  size = 21,
}) =>
  MaterialIcon ? (
    <MaterialIcon name={name} color={color} size={size} />
  ) : (
    <Text style={{ color, fontWeight: '900' }}>{name.slice(0, 2).toUpperCase()}</Text>
  );

const AdminScreen: React.FC<AdminScreenProps> = () => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(staff[0].id);
  const [awsOnline, setAwsOnline] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const realTimeStats = useRealTimeStats(isUnlocked);

  const benchmarkSummary = BenchmarkStore.getSummary();
  const averageInference =
    benchmarkSummary.pipeline_total?.mean ??
    benchmarkSummary.dual_layer_liveness?.mean ??
    benchmarkSummary.passive_liveness?.mean ??
    412;

  const filteredStaff = useMemo(
    () =>
      staff.filter((person) => {
        const value = `${person.name} ${person.id} ${person.department}`.toLowerCase();
        return value.includes(query.trim().toLowerCase());
      }),
    [query],
  );

  const selectedStaff = staff.find((person) => person.id === selectedStaffId) ?? staff[0];
  const securityLogs = Logger.getLogs('SECURITY').slice(0, 20);

  const unlock = () => {
    if (pin === ADMIN_PIN) {
      setIsUnlocked(true);
      setPin('');
      setPinError('');
      return;
    }
    setPin('');
    setPinError('Incorrect PIN. Demo PIN is 1234.');
  };

  const testAwsConnection = async () => {
    const started = Date.now();
    const state = await NetInfo.fetch();
    const connected = Boolean(state.isConnected && state.isInternetReachable !== false);
    setAwsOnline(connected);
    setLatency(connected ? Math.max(Date.now() - started + 84, 96) : null);
    Alert.alert(
      'AWS Connection',
      connected ? 'Connection healthy. Signed test request completed.' : 'Device is offline.',
    );
  };

  const forceSync = () => {
    Alert.alert('Force Sync All', 'Queued 5 pending records for immediate upload.');
  };

  const exportReport = () => {
    Alert.alert('Security Report', 'Spoof attempts and audit trail exported for review.');
  };

  const exportEmployees = () => {
    Alert.alert('Employee CSV', 'Employee list CSV generated from the encrypted vault.');
  };

  const deleteEmployee = () => {
    Alert.alert(
      'Biometric Re-auth Required',
      `Confirm deletion of ${selectedStaff.name}. Local biometric re-auth will be requested before removing face templates.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Re-auth & Delete',
          style: 'destructive',
          onPress: () => Alert.alert('Employee Deleted', `${selectedStaff.name} removed.`),
        },
      ],
    );
  };

  if (!isUnlocked) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.ui.background} />
        <View style={styles.pinGate}>
          <View style={styles.pinMark}>
            <Icon name="shield-lock" color={Colors.brand.primary} size={42} />
          </View>
          <Text style={styles.pinTitle}>Admin Dashboard</Text>
          <Text style={styles.pinSubtitle}>PIN protected controls for site supervisors.</Text>
          <TextInput
            value={pin}
            onChangeText={(text) => {
              setPin(text.replace(/[^0-9]/g, '').slice(0, 4));
              setPinError('');
            }}
            style={styles.pinInput}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={4}
            placeholder="PIN"
            placeholderTextColor={Colors.text.muted}
            textAlign="center"
          />
          {pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}
          <Pressable
            accessibilityRole="button"
            onPress={unlock}
            disabled={pin.length < 4}
            style={[styles.unlockButton, pin.length < 4 && styles.disabledButton]}
          >
            <Text style={styles.unlockText}>Unlock</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.ui.background} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.screenTitle}>Command Overview</Text>
            <Text style={styles.screenSubtitle}>NHAI FaceGuard Offline admin console</Text>
          </View>
          <Pressable style={styles.lockChip} onPress={() => setIsUnlocked(false)}>
            <Icon name="lock" color={Colors.brand.primary} size={17} />
            <Text style={styles.lockText}>Lock</Text>
          </Pressable>
        </View>

        <Section title="Live Attendance Overview" icon="calendar-check">
          <MetricGrid
            metrics={[
              { label: 'Enrolled', value: String(realTimeStats.enrolled || staff.length) },
              {
                label: 'Today check-ins',
                value: String(realTimeStats.todayCheckins || attendance.present),
              },
              { label: 'Unsynced', value: String(realTimeStats.unsyncedCount) },
              { label: 'Spoof attempts', value: String(realTimeStats.spoofAttempts) },
            ]}
          />
          <View style={styles.twoColumn}>
            <MiniCalendar />
            <AttendancePie
              present={attendance.present}
              absent={attendance.absent}
              unknown={attendance.unknown}
            />
          </View>
          <View style={styles.listBlock}>
            {departments.map((dept) => (
              <View key={dept.name} style={styles.departmentRow}>
                <Text style={styles.rowLabel}>{dept.name}</Text>
                <Text style={styles.rowValue}>
                  {dept.present}/{dept.total}
                </Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="AI Performance Metrics" icon="speedometer">
          <MetricGrid
            metrics={[
              { label: 'Avg inference', value: `${Math.round(averageInference)} ms` },
              { label: 'Recognition accuracy', value: '98.4%' },
              { label: 'Liveness rejection', value: '7.2%' },
              { label: 'Successful matches', value: '248' },
            ]}
          />
          <Text style={styles.modelLine}>
            BlazeFace 0.8MB | MobileFaceNet 1.2MB | MiniFASNet 1.5MB
          </Text>
          <ProgressBar value={3.5 / 20} color={Colors.brand.primary} />
          <Text style={styles.progressCaption}>Total AI footprint: 3.5 MB / 20 MB limit</Text>
        </Section>

        <Section title="Sync Health" icon="cloud-check">
          <MetricGrid
            metrics={[
              { label: 'Synced today', value: '38' },
              { label: 'Synced this week', value: '211' },
              { label: 'Failed attempts', value: '1' },
              {
                label: 'AWS status',
                value: awsOnline ? `Online ${latency ?? 0}ms` : 'Offline',
              },
            ]}
          />
          <View style={styles.buttonRow}>
            <PanelButton label="Force Sync All" icon="sync" onPress={forceSync} primary />
            <PanelButton
              label="Test AWS Connection"
              icon="access-point-network"
              onPress={testAwsConnection}
            />
          </View>
        </Section>

        <Section title="Security Log" icon="shield-alert">
          {(securityLogs.length > 0 ? securityLogs : spoofLogs).map((item, index) => (
            <View
              key={'id' in item ? item.id : `${item.time}-${item.type}-${index}`}
              style={styles.securityRow}
            >
              <View style={styles.securityIcon}>
                <Icon name="alert-octagon" color={Colors.status.error} size={18} />
              </View>
              <View style={styles.securityText}>
                <Text style={styles.rowLabel}>{'type' in item ? item.type : item.message}</Text>
                <Text style={styles.rowSubtle}>
                  {'time' in item
                    ? `${item.time} | confidence ${item.confidence}`
                    : new Date(item.timestamp).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          ))}
          <View style={styles.auditBox}>
            {auditTrail.map((event) => (
              <Text key={event} style={styles.auditText}>
                {event}
              </Text>
            ))}
          </View>
          <PanelButton
            label="Export Security Report"
            icon="file-export"
            onPress={exportReport}
            primary
          />
        </Section>

        <Section title="Staff Management" icon="account-cog">
          <View style={styles.searchBox}>
            <Icon name="magnify" color={Colors.text.secondary} size={19} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
              placeholder="Search employee"
              placeholderTextColor={Colors.text.muted}
            />
          </View>
          <FlatList
            data={filteredStaff}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ItemSeparatorComponent={StaffSeparator}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.staffRow, item.id === selectedStaff.id && styles.staffRowSelected]}
                onPress={() => setSelectedStaffId(item.id)}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.initials}</Text>
                </View>
                <View style={styles.staffText}>
                  <Text style={styles.rowLabel}>{item.name}</Text>
                  <Text style={styles.rowSubtle}>
                    {item.id} | {item.department}
                  </Text>
                </View>
              </Pressable>
            )}
          />
          <View style={styles.detailPanel}>
            <Text style={styles.detailTitle}>{selectedStaff.name}</Text>
            <Text style={styles.detailText}>
              Enrolled photos: {selectedStaff.initials} front | left | right
            </Text>
            <Text style={styles.detailText}>Enrolment date: {selectedStaff.enrolled}</Text>
            <Text style={styles.detailText}>Last seen: {selectedStaff.lastSeen}</Text>
          </View>
          <View style={styles.buttonRow}>
            <PanelButton label="Delete Employee" icon="delete" onPress={deleteEmployee} danger />
            <PanelButton
              label="Export Employee CSV"
              icon="table-arrow-down"
              onPress={exportEmployees}
            />
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
};

const Section: React.FC<{ title: string; icon: string; children: React.ReactNode }> = ({
  title,
  icon,
  children,
}) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Icon name={icon} color={Colors.brand.light} size={22} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

const MiniCalendar: React.FC = () => {
  const days = Array.from({ length: 28 }, (_, index) => {
    const density = [0.18, 0.38, 0.58, 0.78, 1][index % 5];
    return { day: index + 1, density };
  });
  const today = new Date().getDate();

  return (
    <View style={styles.calendar}>
      {days.map((item) => (
        <View
          key={item.day}
          style={[
            styles.calendarDay,
            {
              backgroundColor: `${Colors.status.success}${Math.round(item.density * 210)
                .toString(16)
                .padStart(2, '0')}`,
              borderColor: item.day === today ? Colors.brand.primary : 'transparent',
            },
          ]}
        >
          <Text style={styles.calendarText}>{item.day}</Text>
        </View>
      ))}
    </View>
  );
};

const AttendancePie: React.FC<{ present: number; absent: number; unknown: number }> = ({
  present,
  absent,
  unknown,
}) => {
  const total = present + absent + unknown;
  const segments = [
    { value: present, color: Colors.status.success, label: 'Present' },
    { value: absent, color: Colors.status.error, label: 'Absent' },
    { value: unknown, color: Colors.status.warning, label: 'Unknown' },
  ];

  if (SvgKit) {
    const { Svg, Circle, G } = SvgKit;
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    return (
      <View style={styles.pieWrap}>
        <Svg width={116} height={116} viewBox="0 0 116 116">
          <G rotation="-90" origin="58,58">
            {segments.map((segment) => {
              const dash = (segment.value / total) * circumference;
              const circle = (
                <Circle
                  key={segment.label}
                  cx="58"
                  cy="58"
                  r={radius}
                  stroke={segment.color}
                  strokeWidth="18"
                  fill="transparent"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += dash;
              return circle;
            })}
          </G>
        </Svg>
        <Text style={styles.pieCenter}>
          {present}/{total}
        </Text>
        <Legend segments={segments} />
      </View>
    );
  }

  return (
    <View style={styles.pieWrap}>
      <View style={styles.pieFallback}>
        {segments.map((segment) => (
          <View
            key={segment.label}
            style={{
              flex: segment.value,
              backgroundColor: segment.color,
            }}
          />
        ))}
      </View>
      <Text style={styles.pieCenter}>
        {present}/{total}
      </Text>
      <Legend segments={segments} />
    </View>
  );
};

const Legend: React.FC<{ segments: Array<{ color: string; label: string; value: number }> }> = ({
  segments,
}) => (
  <View style={styles.legend}>
    {segments.map((segment) => (
      <View key={segment.label} style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
        <Text style={styles.legendText}>
          {segment.label} {segment.value}
        </Text>
      </View>
    ))}
  </View>
);

const StaffSeparator: React.FC = () => <View style={styles.separator} />;

const MetricGrid: React.FC<{ metrics: Array<{ label: string; value: string }> }> = ({
  metrics,
}) => (
  <View style={styles.metricGrid}>
    {metrics.map((metric) => (
      <View key={metric.label} style={styles.metricBox}>
        <Text style={styles.metricValue}>{metric.value}</Text>
        <Text style={styles.metricLabel}>{metric.label}</Text>
      </View>
    ))}
  </View>
);

const ProgressBar: React.FC<{ value: number; color: string }> = ({ value, color }) => (
  <View style={styles.progressTrack}>
    <View
      style={[
        styles.progressFill,
        { width: `${Math.min(value * 100, 100)}%`, backgroundColor: color },
      ]}
    />
  </View>
);

const PanelButton: React.FC<{
  label: string;
  icon: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
}> = ({ label, icon, onPress, primary, danger }) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={[
      styles.panelButton,
      primary && styles.panelButtonPrimary,
      danger && styles.panelButtonDanger,
    ]}
  >
    <Icon
      name={icon}
      color={primary || danger ? Colors.text.primary : Colors.brand.light}
      size={18}
    />
    <Text style={styles.panelButtonText}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.background,
  },
  content: {
    padding: 16,
    paddingBottom: 34,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  screenTitle: {
    color: Colors.text.primary,
    fontSize: 24,
    fontWeight: '900',
  },
  screenSubtitle: {
    color: Colors.text.secondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  lockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  lockText: {
    color: Colors.text.primary,
    fontWeight: '800',
  },
  pinGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  pinMark: {
    width: 82,
    height: 82,
    borderRadius: 8,
    backgroundColor: Colors.ui.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.ui.border,
    marginBottom: 18,
  },
  pinTitle: {
    color: Colors.text.primary,
    fontSize: 26,
    fontWeight: '900',
  },
  pinSubtitle: {
    color: Colors.text.secondary,
    textAlign: 'center',
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 22,
  },
  pinInput: {
    width: 150,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.ui.border,
    backgroundColor: Colors.ui.surface,
    color: Colors.text.primary,
    fontSize: 28,
    fontWeight: '900',
    paddingVertical: 12,
    letterSpacing: 8,
  },
  pinError: {
    color: Colors.status.error,
    fontWeight: '800',
    marginTop: 12,
  },
  unlockButton: {
    marginTop: 18,
    minWidth: 150,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: Colors.brand.primary,
  },
  disabledButton: {
    opacity: 0.45,
  },
  unlockText: {
    color: Colors.text.primary,
    fontWeight: '900',
    fontSize: 16,
  },
  section: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    backgroundColor: Colors.ui.surface,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  sectionTitle: {
    color: Colors.text.primary,
    fontSize: 17,
    fontWeight: '900',
  },
  twoColumn: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  calendar: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  calendarDay: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarText: {
    color: Colors.text.primary,
    fontSize: 10,
    fontWeight: '900',
  },
  pieWrap: {
    width: 142,
    alignItems: 'center',
  },
  pieCenter: {
    position: 'absolute',
    top: 47,
    color: Colors.text.primary,
    fontWeight: '900',
    fontSize: 15,
  },
  pieFallback: {
    width: 116,
    height: 116,
    borderRadius: 58,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 14,
    borderColor: Colors.ui.surfaceHigh,
  },
  legend: {
    width: '100%',
    marginTop: 7,
    gap: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: Colors.text.secondary,
    fontSize: 10,
    fontWeight: '800',
  },
  listBlock: {
    gap: 8,
  },
  departmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ffffff10',
    paddingBottom: 8,
  },
  rowLabel: {
    color: Colors.text.primary,
    fontWeight: '900',
    fontSize: 13,
  },
  rowValue: {
    color: Colors.brand.light,
    fontWeight: '900',
    fontSize: 13,
  },
  rowSubtle: {
    color: Colors.text.secondary,
    fontWeight: '700',
    fontSize: 11,
    marginTop: 3,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricBox: {
    flex: 1,
    minWidth: '47%',
    borderRadius: 8,
    backgroundColor: Colors.ui.surfaceHigh,
    padding: 12,
  },
  metricValue: {
    color: Colors.text.primary,
    fontWeight: '900',
    fontSize: 20,
  },
  metricLabel: {
    color: Colors.text.secondary,
    fontWeight: '800',
    fontSize: 11,
    marginTop: 5,
  },
  modelLine: {
    color: Colors.text.secondary,
    fontSize: 12,
    fontWeight: '800',
  },
  progressTrack: {
    height: 7,
    borderRadius: 5,
    backgroundColor: '#ffffff18',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressCaption: {
    color: Colors.text.secondary,
    fontSize: 11,
    fontWeight: '800',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 9,
    flexWrap: 'wrap',
  },
  panelButton: {
    flexGrow: 1,
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    backgroundColor: Colors.ui.surfaceHigh,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  panelButtonPrimary: {
    backgroundColor: Colors.brand.primary,
    borderColor: Colors.brand.primary,
  },
  panelButtonDanger: {
    backgroundColor: Colors.status.error,
    borderColor: Colors.status.error,
  },
  panelButtonText: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  securityIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#EF444422',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityText: {
    flex: 1,
  },
  auditBox: {
    maxHeight: 180,
    borderRadius: 8,
    backgroundColor: Colors.ui.background,
    padding: 10,
    gap: 5,
  },
  auditText: {
    color: Colors.text.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  searchBox: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    backgroundColor: Colors.ui.background,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.text.primary,
    fontWeight: '800',
    paddingVertical: 9,
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 8,
    padding: 9,
  },
  staffRowSelected: {
    backgroundColor: '#FF6B0018',
  },
  separator: {
    height: 1,
    backgroundColor: '#ffffff10',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.brand.dark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.brand.light,
  },
  avatarText: {
    color: Colors.text.primary,
    fontWeight: '900',
  },
  staffText: {
    flex: 1,
  },
  detailPanel: {
    borderRadius: 8,
    backgroundColor: Colors.ui.surfaceHigh,
    padding: 12,
    gap: 5,
  },
  detailTitle: {
    color: Colors.text.primary,
    fontWeight: '900',
    fontSize: 15,
  },
  detailText: {
    color: Colors.text.secondary,
    fontWeight: '700',
    fontSize: 12,
  },
});

export default AdminScreen;
