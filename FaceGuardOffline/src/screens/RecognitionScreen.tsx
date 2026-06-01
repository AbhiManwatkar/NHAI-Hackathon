import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Vibration,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { useAttendanceRecognition } from '../hooks/useAttendanceRecognition';
import { AttendanceCard } from '../components/AttendanceCard';

export const RecognitionScreen: React.FC<any> = ({ navigation }) => {
  const {
    state,
    matchedEmployee,
    confidence,
    livenessScore,
    inferenceMs,
    qualityError,
    processCameraFrame,
    logAttendanceAction,
    resetState,
  } = useAttendanceRecognition();

  const [simulatedQueueCount, setSimulatedQueueCount] = useState(3);
  const ringScale = useSharedValue(1.0);

  useEffect(() => {
    if (state === 'detecting') {
      ringScale.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 500 }),
          withTiming(1.0, { duration: 500 })
        ),
        -1,
        true
      );
    } else {
      ringScale.value = 1.0;
    }
  }, [state]);

  const animatedRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
  }));

  const handleSimulateFrame = () => {
    // Triggers detection of Rajesh Kumar
    processCameraFrame('dummy-frame-bytes');
  };

  const handleAction = async (type: 'CHECK_IN' | 'CHECK_OUT') => {
    Vibration.vibrate(100);
    await logAttendanceAction(type);
    setSimulatedQueueCount(prev => prev + 1);
  };

  const getBorderColor = () => {
    if (state === 'success') return '#22C55E';
    if (state === 'failure') return '#EF4444';
    if (state === 'detecting') return '#F59E0B';
    return '#FF6B00';
  };

  return (
    <View style={styles.container}>
      {/* Top Bar with NHAI Logo and Statuses */}
      <View style={styles.topBar}>
        <Text style={styles.logo}>NHAI FaceGuard</Text>
        <View style={styles.statusIcons}>
          <Text style={styles.statusIconText}>🔋 92%</Text>
          <Text style={styles.statusIconText}>📶 Strong</Text>
        </View>
      </View>

      {/* Main Viewfinder / Camera preview simulator */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleSimulateFrame}
        style={styles.viewfinderContainer}
      >
        <View style={styles.cameraPlaceholder}>
          <Text style={styles.camText}>Live Front Camera Viewfinder</Text>
          <Text style={styles.tapTip}>(Tap screen to simulate face locked check-in)</Text>
        </View>

        {/* Animated Oval Border */}
        <Animated.View
          style={[
            styles.faceOval,
            { borderColor: getBorderColor() },
            animatedRingStyle,
          ]}
        >
          {state === 'idle' && (
            <Text style={styles.ovalInstruction}>Position your face here</Text>
          )}

          {state === 'processing' && (
            <View style={styles.processingOverlay}>
              <Text style={styles.processingText}>Identifying...</Text>
              <Text style={styles.inferenceText}>Processing... {inferenceMs.toFixed(0)}ms</Text>
            </View>
          )}
        </Animated.View>

        {/* Airplane Mode Indicator */}
        <View style={styles.airplaneBadge}>
          <Text style={styles.airplaneText}>✈ Offline Mode</Text>
        </View>
      </TouchableOpacity>

      {/* Bottom Sheet Status view */}
      <View style={styles.bottomStatusSheet}>
        <View style={styles.statusRow}>
          <Text style={styles.timeText}>
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Text style={styles.locationText}>📍 Delhi Bypass Plaza</Text>
        </View>
        <View style={styles.networkStatus}>
          <Text style={styles.netText}>Datalake 3.0 Queue: {simulatedQueueCount} pending</Text>
        </View>
      </View>

      {/* Recognition Errors / Rejections Overlay */}
      {state === 'failure' && (
        <Animated.View entering={ZoomIn} exiting={FadeOut} style={styles.rejectionOverlay}>
          <Text style={styles.rejIcon}>⚠</Text>
          <Text style={styles.rejTitle}>
            {qualityError || 'Verification Failed'}
          </Text>
          <Text style={styles.rejSubtitle}>
            Please hold still, verify lighting, or contact supervisor
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={resetState}>
            <Text style={styles.retryText}>Retry Verification</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Bottom Sheet Attendance Card Popup on Success */}
      {state === 'success' && matchedEmployee && (
        <AttendanceCard
          employee={matchedEmployee}
          confidence={confidence}
          livenessScore={livenessScore}
          syncQueueCount={simulatedQueueCount}
          onAction={handleAction}
          onDismiss={resetState}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  topBar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: '#1A3C5E',
  },
  logo: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  statusIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  statusIconText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  viewfinderContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#020617',
  },
  cameraPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  camText: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: '600',
  },
  tapTip: {
    color: '#FF6B00',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '700',
  },
  faceOval: {
    width: 260,
    height: 340,
    borderRadius: 130,
    borderWidth: 3,
    position: 'absolute',
    top: '18%',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ovalInstruction: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  processingOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    ...StyleSheet.absoluteFillObject,
    borderRadius: 130,
  },
  processingText: {
    color: '#FF6B00',
    fontSize: 20,
    fontWeight: '900',
  },
  inferenceText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '700',
  },
  airplaneBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  airplaneText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '800',
  },
  bottomStatusSheet: {
    backgroundColor: '#0F172A',
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  locationText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '700',
  },
  networkStatus: {
    marginTop: 4,
  },
  netText: {
    color: '#F59E0B',
    fontSize: 15,
    fontWeight: '700',
  },
  rejectionOverlay: {
    position: 'absolute',
    top: '25%',
    left: 40,
    right: 40,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  rejIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  rejTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  rejSubtitle: {
    color: '#94A3B8',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
    minHeight: 48,
    justifyContent: 'center',
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});

export default RecognitionScreen;
