import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Dimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { FaceQualityReport } from '../../modules/FaceEngine/FaceCropper';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CUTOUT_WIDTH = SCREEN_WIDTH * 0.75;
const CUTOUT_HEIGHT = CUTOUT_WIDTH * 1.3;
const CUTOUT_TOP = (SCREEN_HEIGHT - CUTOUT_HEIGHT) / 2.6;
const CUTOUT_LEFT = (SCREEN_WIDTH - CUTOUT_WIDTH) / 2;

export interface CameraOverlayProps {
  qualityReport: FaceQualityReport | null;
  livenessState?: {
    isReal: boolean;
    realScore: number;
  } | null;
  captureCount: number;
  maxCaptures: number;
}

export const CameraOverlay: React.FC<CameraOverlayProps> = ({
  qualityReport,
  captureCount,
  maxCaptures,
}) => {
  const scanLineY = useSharedValue(0);
  const borderScale = useSharedValue(1.0);
  
  // Sequential lighting for 4 corners
  const cornerOpacity1 = useSharedValue(0.4);
  const cornerOpacity2 = useSharedValue(0.4);
  const cornerOpacity3 = useSharedValue(0.4);
  const cornerOpacity4 = useSharedValue(0.4);

  const qualityPassed = qualityReport?.qualityPassed ?? false;

  useEffect(() => {
    // Laser scan animation
    scanLineY.value = withRepeat(
      withTiming(CUTOUT_HEIGHT - 4, {
        duration: 2200,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );

    // Pulse animation when locked
    if (qualityPassed) {
      borderScale.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 600 }),
          withTiming(1.0, { duration: 600 })
        ),
        -1,
        true
      );
    } else {
      borderScale.value = 1.0;
    }

    // Corner scan sequential lighting
    const animateCorners = async () => {
      while (true) {
        cornerOpacity1.value = withTiming(1.0, { duration: 400 });
        await new Promise((resolve) => setTimeout(resolve, 400));
        cornerOpacity1.value = withTiming(0.4, { duration: 400 });
        
        cornerOpacity2.value = withTiming(1.0, { duration: 400 });
        await new Promise((resolve) => setTimeout(resolve, 400));
        cornerOpacity2.value = withTiming(0.4, { duration: 400 });
        
        cornerOpacity3.value = withTiming(1.0, { duration: 400 });
        await new Promise((resolve) => setTimeout(resolve, 400));
        cornerOpacity3.value = withTiming(0.4, { duration: 400 });
        
        cornerOpacity4.value = withTiming(1.0, { duration: 400 });
        await new Promise((resolve) => setTimeout(resolve, 400));
        cornerOpacity4.value = withTiming(0.4, { duration: 400 });
      }
    };
    
    animateCorners();
  }, [scanLineY, borderScale, qualityPassed]);

  const animatedLaserStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLineY.value }],
  }));

  const animatedFrameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: borderScale.value }],
  }));

  const c1Style = useAnimatedStyle(() => ({ opacity: cornerOpacity1.value }));
  const c2Style = useAnimatedStyle(() => ({ opacity: cornerOpacity2.value }));
  const c3Style = useAnimatedStyle(() => ({ opacity: cornerOpacity3.value }));
  const c4Style = useAnimatedStyle(() => ({ opacity: cornerOpacity4.value }));

  const activeColor = qualityPassed ? '#22C55E' : qualityReport ? '#F59E0B' : '#FF6B00';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Mask sections */}
      <View style={[styles.mask, { top: 0, left: 0, right: 0, height: CUTOUT_TOP }]} />
      <View style={[styles.mask, { top: CUTOUT_TOP + CUTOUT_HEIGHT, left: 0, right: 0, bottom: 0 }]} />
      <View style={[styles.mask, { top: CUTOUT_TOP, left: 0, width: CUTOUT_LEFT, height: CUTOUT_HEIGHT }]} />
      <View style={[styles.mask, { top: CUTOUT_TOP, right: 0, left: CUTOUT_LEFT + CUTOUT_WIDTH, height: CUTOUT_HEIGHT }]} />

      {/* Oval guide border */}
      <Animated.View
        style={[
          styles.cutoutBorder,
          {
            top: CUTOUT_TOP,
            left: CUTOUT_LEFT,
            width: CUTOUT_WIDTH,
            height: CUTOUT_HEIGHT,
            borderColor: activeColor,
          },
          animatedFrameStyle,
        ]}
      >
        <Animated.View style={[styles.laserLine, { backgroundColor: activeColor }, animatedLaserStyle]} />
      </Animated.View>

      {/* Sequential scanning corners */}
      <Animated.View style={[styles.corner, styles.tl, { borderColor: activeColor }, c1Style]} />
      <Animated.View style={[styles.corner, styles.tr, { borderColor: activeColor }, c2Style]} />
      <Animated.View style={[styles.corner, styles.bl, { borderColor: activeColor }, c3Style]} />
      <Animated.View style={[styles.corner, styles.br, { borderColor: activeColor }, c4Style]} />

      {/* Header Info */}
      <View style={styles.headerBadge}>
        <Text style={styles.headerBadgeText}>
          CAPTURE PROGRESS: {captureCount} / {maxCaptures}
        </Text>
      </View>

      {/* Bottom Quality Status Badge */}
      <View style={styles.bottomBadgeContainer}>
        <View style={[styles.statusBadge, { borderColor: activeColor }]}>
          <Text style={styles.statusText}>
            {qualityReport?.failReason || (qualityPassed ? 'QUALIFIED - STEADY' : 'ALIGN FACE IN OVAL')}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mask: {
    position: 'absolute',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  cutoutBorder: {
    position: 'absolute',
    borderRadius: CUTOUT_WIDTH / 2,
    borderWidth: 2,
    overflow: 'hidden',
  },
  laserLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.8,
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderWidth: 4,
  },
  tl: {
    top: CUTOUT_TOP - 6,
    left: CUTOUT_LEFT - 6,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 16,
  },
  tr: {
    top: CUTOUT_TOP - 6,
    right: CUTOUT_LEFT - 6,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 16,
  },
  bl: {
    bottom: SCREEN_HEIGHT - (CUTOUT_TOP + CUTOUT_HEIGHT) - 6,
    left: CUTOUT_LEFT - 6,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 16,
  },
  br: {
    bottom: SCREEN_HEIGHT - (CUTOUT_TOP + CUTOUT_HEIGHT) - 6,
    right: CUTOUT_LEFT - 6,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 16,
  },
  headerBadge: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 30,
    left: 40,
    right: 40,
    paddingVertical: 10,
    backgroundColor: '#1A3C5E',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF6B00',
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  bottomBadgeContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 150 : 110,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  statusBadge: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default CameraOverlay;
