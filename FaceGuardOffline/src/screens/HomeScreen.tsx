import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated as RNAnimated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import { StatCard } from '../components/StatCard';
import { Colors } from '../theme/colors';
import type { RootStackParamList } from '../types';

let MaterialIcon: any = null;
try {
  MaterialIcon = require('react-native-vector-icons/MaterialCommunityIcons').default;
} catch (_error) {
  MaterialIcon = null;
}

type HomeScreenProps = StackScreenProps<RootStackParamList, 'Home'>;

const appConfig = {
  siteName: 'NH-48 Toll Plaza, Jaipur Corridor',
};

const dashboard = {
  enrolledStaff: 42,
  todayCheckIns: 31,
  pendingSync: 5,
  spoofAttempts: 2,
  vaultRecords: 23,
  vaultSize: '1.2 MB',
  lastSyncAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
};

const Icon: React.FC<{ name: string; color: string; size?: number }> = ({
  name,
  color,
  size = 24,
}) =>
  MaterialIcon ? (
    <MaterialIcon name={name} color={color} size={size} />
  ) : (
    <Text style={{ color, fontSize: Math.max(12, size - 9), fontWeight: '900' }}>
      {name.slice(0, 2).toUpperCase()}
    </Text>
  );

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const [now, setNow] = useState(new Date());
  const [isOnline, setIsOnline] = useState(false);
  const [showSyncBanner, setShowSyncBanner] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const bannerTranslate = useMemo(() => new RNAnimated.Value(-90), []);

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline((previous) => {
        if (!previous && connected && dashboard.pendingSync > 0) {
          setShowSyncBanner(true);
          setSyncProgress(0);
        }
        return connected;
      });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!showSyncBanner) {
      return;
    }

    RNAnimated.timing(bannerTranslate, {
      toValue: 0,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const progressTimer = setInterval(() => {
      setSyncProgress((previous) => {
        const next = Math.min(previous + 0.14, 1);
        if (next >= 1) {
          clearInterval(progressTimer);
          setTimeout(() => {
            RNAnimated.timing(bannerTranslate, {
              toValue: -90,
              duration: 260,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            }).start(() => setShowSyncBanner(false));
          }, 650);
        }
        return next;
      });
    }, 260);

    return () => clearInterval(progressTimer);
  }, [bannerTranslate, showSyncBanner]);

  const formattedDate = now.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const formattedTime = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const lastSyncText = dashboard.lastSyncAt ? 'Last sync: 2h ago' : 'Never synced';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.ui.background} />

      {showSyncBanner ? (
        <RNAnimated.View
          style={[styles.syncBanner, { transform: [{ translateY: bannerTranslate }] }]}
        >
          <View style={styles.syncBannerTop}>
            <Icon name="cloud-sync" color={Colors.text.primary} size={20} />
            <Text style={styles.syncBannerText}>
              Connected - syncing {dashboard.pendingSync} records...
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${syncProgress * 100}%` }]} />
          </View>
        </RNAnimated.View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.brandRow}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>NHAI</Text>
            </View>
            <View style={styles.wordmark}>
              <Text style={styles.title}>FaceGuard Offline</Text>
              <Text style={styles.siteName}>{appConfig.siteName}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View>
              <Text style={styles.date}>{formattedDate}</Text>
              <Text style={styles.time}>{formattedTime}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('SyncStatus')}
              style={[
                styles.networkChip,
                { backgroundColor: isOnline ? Colors.status.success : Colors.status.warning },
              ]}
            >
              <View style={styles.chipDot} />
              <Text style={styles.networkText}>{isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.statGrid}>
          <StatCard
            title="Enrolled Staff"
            value={dashboard.enrolledStaff}
            icon="account-group"
            variant="blue"
            subtitle="Active face profiles"
            onPress={() => navigation.navigate('Admin')}
          />
          <StatCard
            title="Today's Check-ins"
            value={dashboard.todayCheckIns}
            icon="check-circle"
            variant="green"
            subtitle="Verified locally"
            onPress={() => navigation.navigate('AttendanceLog')}
          />
          <StatCard
            title="Pending Sync"
            value={dashboard.pendingSync}
            icon="cloud-upload"
            variant="orange"
            subtitle="Queued for AWS"
            pulse
            onPress={() => navigation.navigate('SyncStatus')}
          />
          <StatCard
            title="Spoof Attempts"
            value={dashboard.spoofAttempts}
            icon="shield-alert"
            variant="red"
            subtitle="Blocked today"
            pulse
            onPress={() => navigation.navigate('Admin')}
          />
        </View>

        <View style={styles.actions}>
          <ActionButton
            label="Mark Attendance"
            icon="face-recognition"
            tone="primary"
            onPress={() => navigation.navigate('Recognition')}
          />
          <ActionButton
            label="Enrol New Staff"
            icon="account-plus"
            tone="secondary"
            onPress={() => navigation.navigate('Enrolment')}
          />
          <ActionButton
            label="Attendance Log"
            icon="format-list-bulleted"
            tone="surface"
            onPress={() => navigation.navigate('AttendanceLog')}
          />
          <ActionButton
            label="Admin Panel"
            icon="shield-account"
            tone="surface"
            onPress={() => navigation.navigate('Admin')}
          />
        </View>

        <View style={styles.statusBar}>
          <StatusItem icon="brain" text="AI Models: Ready (3/3)" />
          <StatusItem
            icon="database-lock"
            text={`Vault: ${dashboard.vaultRecords} records | ${dashboard.vaultSize}`}
          />
          <StatusItem icon="history" text={lastSyncText} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const ActionButton: React.FC<{
  label: string;
  icon: string;
  tone: 'primary' | 'secondary' | 'surface';
  onPress: () => void;
}> = ({ label, icon, tone, onPress }) => {
  const background =
    tone === 'primary'
      ? Colors.brand.primary
      : tone === 'secondary'
      ? Colors.brand.dark
      : Colors.ui.surfaceHigh;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      android_ripple={{ color: '#ffffff18' }}
      style={({ pressed }) => [
        styles.actionButton,
        { backgroundColor: background, opacity: pressed ? 0.86 : 1 },
      ]}
    >
      <View style={styles.actionIcon}>
        <Icon name={icon} color={Colors.text.primary} size={25} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Icon name="chevron-right" color={Colors.text.primary} size={21} />
    </Pressable>
  );
};

const StatusItem: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
  <View style={styles.statusItem}>
    <Icon name={icon} color={Colors.brand.light} size={17} />
    <Text style={styles.statusText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.background,
  },
  content: {
    padding: 16,
    paddingBottom: 34,
    gap: 18,
  },
  syncBanner: {
    position: 'absolute',
    zIndex: 10,
    top: Platform.OS === 'android' ? 10 : 4,
    left: 16,
    right: 16,
    padding: 14,
    borderRadius: 8,
    backgroundColor: Colors.brand.dark,
    borderWidth: 1,
    borderColor: Colors.brand.primary,
  },
  syncBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  syncBannerText: {
    color: Colors.text.primary,
    fontWeight: '800',
    fontSize: 14,
  },
  progressTrack: {
    height: 5,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#ffffff22',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.brand.primary,
  },
  hero: {
    padding: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    backgroundColor: Colors.ui.surface,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 58,
    height: 58,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand.primary,
  },
  logoText: {
    color: Colors.text.primary,
    fontWeight: '900',
    fontSize: 14,
  },
  wordmark: {
    flex: 1,
  },
  title: {
    color: Colors.text.primary,
    fontSize: 24,
    fontWeight: '900',
  },
  siteName: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  metaRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  date: {
    color: Colors.text.secondary,
    fontWeight: '700',
    fontSize: 13,
  },
  time: {
    color: Colors.text.primary,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 2,
  },
  networkChip: {
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.text.primary,
  },
  networkText: {
    color: Colors.text.primary,
    fontWeight: '900',
    fontSize: 12,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actions: {
    gap: 10,
  },
  actionButton: {
    minHeight: 64,
    borderRadius: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionIcon: {
    width: 34,
    alignItems: 'center',
  },
  actionLabel: {
    flex: 1,
    color: Colors.text.primary,
    fontWeight: '900',
    fontSize: 16,
  },
  statusBar: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    backgroundColor: Colors.ui.surface,
    padding: 14,
    gap: 10,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  statusText: {
    color: Colors.text.secondary,
    fontWeight: '800',
    fontSize: 12,
  },
});

export default HomeScreen;
