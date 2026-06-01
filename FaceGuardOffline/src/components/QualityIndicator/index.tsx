import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  SlideInLeft,
} from 'react-native-reanimated';

export interface QualityIndicatorProps {
  label: string;
  passed: boolean;
  value?: number;
}

export const QualityIndicator: React.FC<QualityIndicatorProps> = ({
  label,
  passed,
  value,
}) => {
  const dotColor = useSharedValue(passed ? '#22C55E' : '#EF4444');

  useEffect(() => {
    dotColor.value = withTiming(passed ? '#22C55E' : '#EF4444', {
      duration: 300,
    });
  }, [passed, dotColor]);

  const animatedDotStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: dotColor.value,
    };
  });

  return (
    <Animated.View
      entering={SlideInLeft.duration(400)}
      style={styles.container}
    >
      <Animated.View style={[styles.dot, animatedDotStyle]} />
      <Text style={styles.labelText}>
        {passed ? '✓' : '⚠'} {label} {value !== undefined ? `(${value.toFixed(1)})` : ''}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 4,
    backgroundColor: 'rgba(26, 60, 94, 0.4)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  labelText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default QualityIndicator;
