import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

export interface SyncBannerProps {
  status: 'OFFLINE' | 'SYNCING' | 'SYNCED';
  queueCount: number;
  syncProgress?: number; // 0 to 100
  onPress?: () => void;
}

export const SyncBanner: React.FC<SyncBannerProps> = ({
  status,
  queueCount,
  syncProgress = 0,
  onPress,
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    if (status === 'SYNCED') {
      const timer = setTimeout(() => {
        setVisible(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (!visible) return null;

  let backgroundColor = '#F59E0B'; // Offline orange
  let textColor = '#FFFFFF';
  let message = `Offline — ${queueCount} records queued for sync`;

  if (status === 'SYNCING') {
    backgroundColor = '#1A3C5E'; // Syncing Navy/Blue
    message = `Syncing ${queueCount} records to AWS... (${syncProgress}%)`;
  } else if (status === 'SYNCED') {
    backgroundColor = '#22C55E'; // Synced Green
    message = 'All records synced and purged';
  }

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      exiting={FadeOut.duration(300)}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        style={[styles.banner, { backgroundColor }]}
      >
        <Text style={[styles.text, { color: textColor }]}>
          {status === 'OFFLINE' ? '💾 ' : status === 'SYNCING' ? '⏳ ' : '✓ '}
          {message}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  text: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
});

export default SyncBanner;
