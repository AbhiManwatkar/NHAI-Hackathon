import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { BoundingBox } from '../../types';

export interface FaceFrameProps {
  bbox: BoundingBox;
  containerWidth: number;
  containerHeight: number;
  confidence: number;
  matchedName?: string | null;
  faceDetected?: boolean;
  qualityMessage?: string | null;
  qualityPassed?: boolean;
  processing?: boolean;
}

export const FaceFrame: React.FC<FaceFrameProps> = ({
  bbox,
  containerWidth,
  containerHeight,
  confidence,
  matchedName,
  faceDetected = true,
  qualityMessage = null,
  qualityPassed = confidence >= 0.85,
  processing = false,
}) => {
  const pulse = useRef(new Animated.Value(0)).current;
  const scan = useRef(new Animated.Value(0)).current;
  const left = bbox.x * containerWidth;
  const top = bbox.y * containerHeight;
  const width = bbox.width * containerWidth;
  const height = bbox.height * containerHeight;
  const activeColor = qualityPassed ? '#00C853' : faceDetected ? '#FFD600' : '#FF5252';

  useEffect(() => {
    if (!qualityPassed) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, qualityPassed]);

  useEffect(() => {
    if (!processing) {
      scan.stopAnimation();
      scan.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.timing(scan, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [processing, scan]);

  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.045],
  });
  const scanY = scan.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, height - 3)],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.frame,
        {
          left,
          top,
          width,
          height,
          borderColor: activeColor,
          transform: [{ scale: pulseScale }],
        },
      ]}
    >
      <View style={[styles.oval, { borderColor: activeColor }]} />
      <View
        style={[
          styles.corner,
          styles.topLeft,
          { borderColor: activeColor, opacity: faceDetected ? 1 : 0.35 },
        ]}
      />
      <View
        style={[
          styles.corner,
          styles.topRight,
          { borderColor: activeColor, opacity: faceDetected ? 1 : 0.35 },
        ]}
      />
      <View
        style={[
          styles.corner,
          styles.bottomLeft,
          { borderColor: activeColor, opacity: faceDetected ? 1 : 0.35 },
        ]}
      />
      <View
        style={[
          styles.corner,
          styles.bottomRight,
          { borderColor: activeColor, opacity: faceDetected ? 1 : 0.35 },
        ]}
      />

      {processing ? (
        <Animated.View
          style={[
            styles.scanLine,
            {
              backgroundColor: activeColor,
              transform: [{ translateY: scanY }],
            },
          ]}
        />
      ) : null}

      <View style={[styles.qualityBadge, { borderColor: activeColor }]}>
        <Text style={styles.qualityText} numberOfLines={1}>
          {qualityMessage ?? (qualityPassed ? 'Face locked' : 'Align face')}
        </Text>
        {matchedName ? (
          <Text style={styles.nameText} numberOfLines={1}>
            {matchedName}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  frame: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
  },
  oval: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 2,
    opacity: 0.8,
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderWidth: 4,
  },
  topLeft: {
    top: -4,
    left: -4,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 18,
  },
  topRight: {
    top: -4,
    right: -4,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 18,
  },
  bottomLeft: {
    bottom: -4,
    left: -4,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 18,
  },
  bottomRight: {
    bottom: -4,
    right: -4,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 18,
  },
  scanLine: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 0,
    height: 3,
    borderRadius: 2,
    opacity: 0.9,
  },
  qualityBadge: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    bottom: -44,
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#08131F',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  qualityText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  nameText: {
    color: '#D7E3F0',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
});

export default FaceFrame;
