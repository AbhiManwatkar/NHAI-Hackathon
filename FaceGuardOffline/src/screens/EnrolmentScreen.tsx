import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import Animated, {
  SlideInRight,
  SlideOutLeft,
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { CameraOverlay } from '../components/CameraOverlay';
import { QualityIndicator } from '../components/QualityIndicator';
import { useCameraEnrolment } from '../hooks/useCameraEnrolment';
import { NHAIDepartment } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const Colors = {
  orange: '#FF6B00',
  navy: '#1A3C5E',
  darkBg: '#0F172A',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  textSecondary: '#94A3B8',
};

export const EnrolmentScreen: React.FC<any> = ({ navigation }) => {
  const [step, setStep] = useState<number>(1);
  
  // Step 1 Details State
  const [fullName, setFullName] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState<NHAIDepartment>('Engineering');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reanimated shared values for animations
  const flashOpacity = useSharedValue(0);
  const successScale = useSharedValue(0);

  // Custom hook for camera enrolment
  const {
    capturedEmbeddings,
    qualityReport,
    captureFrame,
    isProcessing,
    finalise,
    reset,
  } = useCameraEnrolment();

  const isFormValid = useMemo(() => {
    return fullName.trim().length >= 3 && employeeCode.trim().length >= 3 && designation.trim().length >= 2;
  }, [fullName, employeeCode, designation]);

  const handleNextStep1 = () => {
    const errs: Record<string, string> = {};
    if (fullName.trim().length < 3) errs.fullName = 'Name must be at least 3 characters';
    if (employeeCode.trim().length < 3) errs.employeeCode = 'Code must be at least 3 characters';
    if (designation.trim().length < 2) errs.designation = 'Designation must be at least 2 characters';

    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      setStep(2);
    }
  };

  const handleSimulateCapture = async () => {
    // Flash animation
    flashOpacity.value = withSequence(
      withTiming(0.9, { duration: 100 }),
      withTiming(0, { duration: 250 })
    );

    // Run simulated frames to check quality and extract embedding
    const frameData = {
      pixels: new Uint8Array(112 * 112 * 3),
      width: 112,
      height: 112,
    };
    
    // Simulate capture
    const success = await captureFrame('dummy-base64-data', frameData);
    if (success || capturedEmbeddings.length < 3) {
      if (capturedEmbeddings.length + 1 >= 3) {
        // Advance to step 3 Processing
        setStep(3);
        triggerProcessingPipeline();
      }
    }
  };

  const triggerProcessingPipeline = async () => {
    // Simulate sequential pipeline delays
    setTimeout(async () => {
      try {
        await finalise({
          name: fullName,
          employee_code: employeeCode,
          designation,
          department,
        });
        setStep(4);
        successScale.value = withDelay(200, withTiming(1.0, { duration: 400 }));
      } catch (err) {
        console.error(err);
      }
    }, 3000);
  };

  const handleReset = () => {
    reset();
    setFullName('');
    setEmployeeCode('');
    setDesignation('');
    setStep(1);
  };

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const successAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Step 1: Form Details */}
      {step === 1 && (
        <Animated.View
          entering={SlideInRight}
          exiting={SlideOutLeft}
          style={styles.stepContainer}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.formScroll}>
              <Text style={styles.title}>NHAI Field Enrollment</Text>
              <Text style={styles.subtitle}>Step 1: Personnel Identity Profile</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Rajesh Kumar"
                  placeholderTextColor={Colors.textSecondary}
                  value={fullName}
                  onChangeText={setFullName}
                />
                {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Employee Code</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. NHAI-EMP-0042"
                  placeholderTextColor={Colors.textSecondary}
                  value={employeeCode}
                  onChangeText={setEmployeeCode}
                  autoCapitalize="characters"
                />
                {errors.employeeCode && <Text style={styles.errorText}>{errors.employeeCode}</Text>}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Designation</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Project Manager"
                  placeholderTextColor={Colors.textSecondary}
                  value={designation}
                  onChangeText={setDesignation}
                />
                {errors.designation && <Text style={styles.errorText}>{errors.designation}</Text>}
              </View>

              <TouchableOpacity
                style={[styles.btn, !isFormValid && styles.btnDisabled]}
                onPress={handleNextStep1}
                disabled={!isFormValid}
              >
                <Text style={styles.btnText}>Proceed to Capture Guide</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </Animated.View>
      )}

      {/* Step 2: Camera Feed Capture */}
      {step === 2 && (
        <Animated.View
          entering={SlideInRight}
          exiting={SlideOutLeft}
          style={styles.stepContainer}
        >
          {/* Simulated Camera Viewfinder */}
          <View style={styles.cameraViewfinder}>
            <View style={styles.placeholderCameraFeed}>
              <Text style={styles.cameraIcon}>📷</Text>
              <Text style={styles.cameraFeedText}>Front Facing Camera Feed</Text>
            </View>

            <CameraOverlay
              qualityReport={qualityReport}
              captureCount={capturedEmbeddings.length}
              maxCaptures={3}
            />

            {/* Flash Screen Brightness effect */}
            <Animated.View style={[styles.flashScreen, flashStyle]} />
          </View>

          {/* Quality Indicators overlay list */}
          <View style={styles.indicatorsList}>
            <QualityIndicator label="Good Lighting" passed={qualityReport?.isWellLit ?? true} />
            <QualityIndicator label="Face Centred" passed={qualityReport?.isCentred ?? true} />
            <QualityIndicator label="Sharp Image" passed={qualityReport?.isSharp ?? true} />
          </View>

          <View style={styles.captureControls}>
            <TouchableOpacity
              style={styles.captureBtn}
              onPress={handleSimulateCapture}
              disabled={isProcessing}
            >
              <View style={styles.captureInnerCircle} />
            </TouchableOpacity>
            <Text style={styles.captureCounterText}>
              Capture {capturedEmbeddings.length + 1} of 3
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Step 3: Processing */}
      {step === 3 && (
        <Animated.View
          entering={SlideInRight}
          exiting={SlideOutLeft}
          style={[styles.stepContainer, styles.centered]}
        >
          <Text style={styles.title}>Securing Biometrics</Text>
          <Text style={styles.subtitle}>Step 3: Storing Biometric Signature</Text>
          
          <View style={styles.loaderContainer}>
            <Animated.View style={styles.circularSpinner} />
            <Text style={styles.loaderStatusText}>Averaging & Encrypting Embeddings...</Text>
          </View>

          <View style={styles.substepsContainer}>
            <Text style={styles.substepText}>✓ Extracting facial features</Text>
            <Text style={styles.substepText}>✓ Averaging 3 captures</Text>
            <Text style={styles.substepText}>✓ Encrypting with device key</Text>
            <Text style={styles.substepText}>✓ Storing securely offline</Text>
          </View>
        </Animated.View>
      )}

      {/* Step 4: Success Screen */}
      {step === 4 && (
        <Animated.View
          entering={SlideInRight}
          style={[styles.stepContainer, styles.centered]}
        >
          <Animated.View style={[styles.checkmarkCircle, successAnimatedStyle]}>
            <Text style={styles.checkIcon}>✓</Text>
          </Animated.View>

          <Text style={styles.title}>Enrollment Complete</Text>
          <Text style={styles.successSub}>
            {fullName} ({employeeCode})
          </Text>
          <Text style={styles.successDesc}>
            Biometric signature encrypted and registered offline. You can now use offline attendance verification.
          </Text>

          <TouchableOpacity style={styles.btn} onPress={handleReset}>
            <Text style={styles.btnText}>Enroll Another Employee</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.secondaryBtn]}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={[styles.btnText, styles.secondaryBtnText]}>Go to Attendance</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.darkBg,
  },
  stepContainer: {
    flex: 1,
    padding: 20,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 30,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.orange,
    textAlign: 'center',
    marginBottom: 30,
    fontWeight: '700',
  },
  formScroll: {
    paddingBottom: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(26, 60, 94, 0.4)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 17,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    marginTop: 4,
    fontWeight: '600',
  },
  btn: {
    backgroundColor: Colors.orange,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 48,
  },
  btnDisabled: {
    backgroundColor: 'rgba(255, 107, 0, 0.3)',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  cameraViewfinder: {
    height: 380,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000000',
  },
  placeholderCameraFeed: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  cameraFeedText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  flashScreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
  },
  indicatorsList: {
    marginVertical: 20,
  },
  captureControls: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  captureBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: Colors.orange,
  },
  captureInnerCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.orange,
  },
  captureCounterText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
  },
  loaderContainer: {
    alignItems: 'center',
    marginVertical: 40,
  },
  circularSpinner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 6,
    borderColor: Colors.orange,
    borderTopColor: 'transparent',
  },
  loaderStatusText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 20,
  },
  substepsContainer: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(26, 60, 94, 0.4)',
    padding: 20,
    borderRadius: 12,
  },
  substepText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    marginVertical: 6,
  },
  checkmarkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  checkIcon: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '900',
  },
  successSub: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '800',
    marginBottom: 10,
  },
  successDesc: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: 20,
    marginBottom: 40,
    lineHeight: 22,
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    width: '100%',
  },
  secondaryBtnText: {
    color: '#FFFFFF',
  },
});

export default EnrolmentScreen;
