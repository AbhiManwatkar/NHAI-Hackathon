import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated as RNAnimated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../../theme/colors';

let MaterialIcon: any = null;
try {
  MaterialIcon = require('react-native-vector-icons/MaterialCommunityIcons').default;
} catch (_error) {
  MaterialIcon = null;
}

export type StatCardVariant = 'blue' | 'green' | 'orange' | 'red';

export interface StatCardProps {
  title: string;
  value: number;
  icon: string;
  variant: StatCardVariant;
  subtitle?: string;
  pulse?: boolean;
  onPress?: () => void;
}

const variantColor: Record<StatCardVariant, string> = {
  blue: Colors.status.info,
  green: Colors.status.success,
  orange: Colors.status.warning,
  red: Colors.status.error,
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  variant,
  subtitle,
  pulse,
  onPress,
}) => {
  const animatedValue = useRef(new RNAnimated.Value(0)).current;
  const [counterText, setCounterText] = useState('0');
  const pulseScale = useSharedValue(1);
  const color = variantColor[variant];

  useEffect(() => {
    animatedValue.setValue(0);
    RNAnimated.timing(animatedValue, {
      toValue: value,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animatedValue, value]);

  useEffect(() => {
    const listenerId = animatedValue.addListener(({ value: nextValue }) => {
      setCounterText(Math.round(nextValue).toLocaleString('en-IN'));
    });
    return () => animatedValue.removeListener(listenerId);
  }, [animatedValue]);

  useEffect(() => {
    if (pulse && value > 0) {
      pulseScale.value = withRepeat(
        withSequence(withTiming(1.035, { duration: 650 }), withTiming(1, { duration: 650 })),
        -1,
        false,
      );
      return;
    }
    pulseScale.value = withTiming(1, { duration: 180 });
  }, [pulse, pulseScale, value]);

  const animatedPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const iconFallback = useMemo(() => icon.slice(0, 2).toUpperCase(), [icon]);

  return (
    <Animated.View style={[styles.pulseContainer, animatedPulseStyle]}>
      <TouchableOpacity
        activeOpacity={0.86}
        onPress={onPress}
        disabled={!onPress}
        style={[styles.card, { borderColor: color }]}
      >
        <View style={styles.topRow}>
          <View style={[styles.iconShell, { backgroundColor: `${color}24` }]}>
            {MaterialIcon ? (
              <MaterialIcon name={icon} size={22} color={color} />
            ) : (
              <Text style={[styles.fallbackIcon, { color }]}>{iconFallback}</Text>
            )}
          </View>
          <Text style={styles.titleText} numberOfLines={2}>
            {title}
          </Text>
        </View>
        <Text style={[styles.valueText, { color }]}>{counterText}</Text>
        {subtitle ? <Text style={styles.subtitleText}>{subtitle}</Text> : null}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  pulseContainer: {
    flex: 1,
    minWidth: '47%',
  },
  card: {
    minHeight: 126,
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    backgroundColor: Colors.ui.surface,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconShell: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackIcon: {
    fontSize: 12,
    fontWeight: '900',
  },
  titleText: {
    flex: 1,
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '800',
  },
  valueText: {
    fontSize: 31,
    fontWeight: '900',
    marginTop: 10,
  },
  subtitleText: {
    color: Colors.text.muted,
    fontSize: 11,
    fontWeight: '700',
  },
});

export default StatCard;
