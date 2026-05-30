/**
 * @fileoverview EnrolmentScreen - Multi-step Personnel Enrollment Flow
 * @description Guides field personnel through a 4-step enrollment process:
 * 1. Personal details entry (name, employee ID, department, role)
 * 2. Multi-angle face capture (front, left, right) with overlay guides
 * 3. Liveness verification challenge
 * 4. Confirmation with face preview and data summary
 *
 * All face data is processed and stored locally for offline operation.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  EnrollmentStep,
  FaceCapture,
  FaceCaptureAngle,
  LivenessChallenge,
  LivenessResult,
  NHAIDepartment,
  PersonnelRole,
  RootStackParamList,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const Colors = {
  primaryOrange: '#FF6B00',
  primaryBlue: '#1A3C5E',
  backgroundDark: '#0D1B2A',
  surface: '#1B2838',
  success: '#00C853',
  error: '#FF1744',
  warning: '#FFD600',
  textPrimary: '#FFFFFF',
  textSecondary: '#B0BEC5',
  inputBackground: 'rgba(27, 40, 56, 0.8)',
  inputBorder: 'rgba(255, 255, 255, 0.15)',
  inputBorderFocused: '#FF6B00',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  glassBackground: 'rgba(27, 40, 56, 0.65)',
} as const;

/** Ordered steps for the enrollment flow */
const ENROLLMENT_STEPS: {
  key: EnrollmentStep;
  label: string;
  shortLabel: string;
}[] = [
  { key: 'details', label: 'Personal Details', shortLabel: 'Details' },
  { key: 'capture_front', label: 'Front Face Capture', shortLabel: 'Front' },
  { key: 'capture_left', label: 'Left Profile', shortLabel: 'Left' },
  { key: 'capture_right', label: 'Right Profile', shortLabel: 'Right' },
  { key: 'liveness', label: 'Liveness Check', shortLabel: 'Liveness' },
  { key: 'confirmation', label: 'Confirmation', shortLabel: 'Confirm' },
];

/** Available NHAI departments for picker */
const DEPARTMENTS: NHAIDepartment[] = [
  'Engineering',
  'Operations',
  'Administration',
  'Finance',
  'IT',
  'HR',
  'Safety',
  'Toll Operations',
  'Maintenance',
  'Project Management',
  'Other',
];

/** Available roles for picker */
const ROLES: PersonnelRole[] = [
  'Field Engineer',
  'Site Supervisor',
  'Toll Operator',
  'Safety Inspector',
  'Project Manager',
  'Maintenance Worker',
  'Admin Staff',
  'Contractor',
  'Consultant',
  'Other',
];

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Typing
// ─────────────────────────────────────────────────────────────────────────────

type EnrolmentScreenProps = NativeStackScreenProps<RootStackParamList, 'Enrolment'>;

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Progress stepper showing current enrollment step
 */
const ProgressStepper: React.FC<{
  currentStepIndex: number;
  totalSteps: number;
}> = ({ currentStepIndex, totalSteps }) => {
  return (
    <View style={styles.stepperContainer}>
      <View style={styles.stepperTrack}>
        {Array.from({ length: totalSteps }, (_, i) => (
          <React.Fragment key={i}>
            {/* Step circle */}
            <View
              style={[
                styles.stepCircle,
                i < currentStepIndex && styles.stepCircleCompleted,
                i === currentStepIndex && styles.stepCircleActive,
              ]}
            >
              <Text
                style={[
                  styles.stepCircleText,
                  i <= currentStepIndex && styles.stepCircleTextActive,
                ]}
              >
                {i < currentStepIndex ? '✓' : `${i + 1}`}
              </Text>
            </View>
            {/* Connector line */}
            {i < totalSteps - 1 && (
              <View
                style={[
                  styles.stepConnector,
                  i < currentStepIndex && styles.stepConnectorCompleted,
                ]}
              />
            )}
          </React.Fragment>
        ))}
      </View>
      <Text style={styles.stepLabel}>{ENROLLMENT_STEPS[currentStepIndex]?.label ?? ''}</Text>
    </View>
  );
};

/**
 * Custom styled text input field for enrollment form
 */
const FormInput: React.FC<{
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
}> = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'words',
  error,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.formInputContainer}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={[
          styles.formInput,
          isFocused && styles.formInputFocused,
          error ? styles.formInputError : null,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(176, 190, 197, 0.4)"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        selectionColor={Colors.primaryOrange}
      />
      {error ? <Text style={styles.formError}>{error}</Text> : null}
    </View>
  );
};

/**
 * Dropdown-style selector (simplified as scrollable chips)
 */
const ChipSelector: React.FC<{
  label: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}> = ({ label, options, selected, onSelect }) => {
  return (
    <View style={styles.chipSelectorContainer}>
      <Text style={styles.formLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipScrollContent}
      >
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            style={[styles.chip, selected === option && styles.chipSelected]}
            onPress={() => onSelect(option)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, selected === option && styles.chipTextSelected]}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

/**
 * Camera viewfinder with face frame overlay guide
 */
const CameraViewfinder: React.FC<{
  angle: FaceCaptureAngle;
  onCapture: () => void;
  isCapturing: boolean;
  capturedImage: string | null;
}> = ({ angle, onCapture, isCapturing, capturedImage }) => {
  const angleInstructions: Record<FaceCaptureAngle, string> = {
    front: 'Look straight at the camera',
    left: 'Turn your head slightly to the left',
    right: 'Turn your head slightly to the right',
  };

  const angleIcon: Record<FaceCaptureAngle, string> = {
    front: '😐',
    left: '👈 😐',
    right: '😐 👉',
  };

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.cameraContainer}>
      {capturedImage ? (
        <View style={styles.capturedPreview}>
          <View style={styles.cameraPlaceholder}>
            <Text style={styles.capturedCheckmark}>✅</Text>
            <Text style={styles.capturedText}>Captured Successfully</Text>
          </View>
        </View>
      ) : (
        <>
          {/* Camera placeholder - in production, this is the actual camera view */}
          <View style={styles.cameraPlaceholder}>
            <View style={styles.faceFrameOverlay}>
              {/* Corner markers for face frame */}
              <View style={[styles.frameCorner, styles.frameCornerTL]} />
              <View style={[styles.frameCorner, styles.frameCornerTR]} />
              <View style={[styles.frameCorner, styles.frameCornerBL]} />
              <View style={[styles.frameCorner, styles.frameCornerBR]} />
            </View>
            <Text style={styles.angleIcon}>{angleIcon[angle]}</Text>
            <Text style={styles.cameraPlaceholderText}>Camera Feed</Text>
          </View>

          <Text style={styles.captureInstruction}>{angleInstructions[angle]}</Text>

          <TouchableOpacity
            style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
            onPress={onCapture}
            disabled={isCapturing}
            activeOpacity={0.7}
          >
            {isCapturing ? (
              <ActivityIndicator size="small" color={Colors.textPrimary} />
            ) : (
              <View style={styles.captureButtonInner} />
            )}
          </TouchableOpacity>
        </>
      )}
    </Animated.View>
  );
};

/**
 * Liveness challenge screen component
 */
const LivenessCheckView: React.FC<{
  onComplete: (result: LivenessResult) => void;
  isProcessing: boolean;
}> = ({ onComplete, isProcessing }) => {
  const [currentChallenge, setCurrentChallenge] = useState<string>('Blink your eyes');
  const [challengeProgress, setChallengeProgress] = useState<number>(0);

  const handleSimulateLiveness = useCallback(() => {
    // TODO: Replace with actual liveness detection via FaceEngine hook
    setChallengeProgress(0.5);
    setCurrentChallenge('Processing...');

    setTimeout(() => {
      setChallengeProgress(1);
      onComplete({
        isLive: true,
        score: 0.95,
        challengesAttempted: [0, 4] as unknown as LivenessChallenge[],
        challengesPassed: [0, 4] as unknown as LivenessChallenge[],
        failureReason: null,
        checkedAt: new Date().toISOString(),
      });
    }, 2000);
  }, [onComplete]);

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.livenessContainer}>
      <View style={styles.cameraPlaceholder}>
        <View style={styles.faceFrameOverlay}>
          <View style={[styles.frameCorner, styles.frameCornerTL]} />
          <View style={[styles.frameCorner, styles.frameCornerTR]} />
          <View style={[styles.frameCorner, styles.frameCornerBL]} />
          <View style={[styles.frameCorner, styles.frameCornerBR]} />
        </View>
        <Text style={styles.livenessIcon}>🔐</Text>
        <Text style={styles.cameraPlaceholderText}>Liveness Detection</Text>
      </View>

      <View style={styles.livenessInstructions}>
        <Text style={styles.livenessTitle}>Liveness Verification</Text>
        <Text style={styles.livnessChallengeText}>{currentChallenge}</Text>

        {/* Progress bar */}
        <View style={styles.livenessProgressTrack}>
          <Animated.View
            style={[styles.livenessProgressFill, { width: `${challengeProgress * 100}%` }]}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.livenessStartButton, isProcessing && styles.captureButtonDisabled]}
        onPress={handleSimulateLiveness}
        disabled={isProcessing}
        activeOpacity={0.7}
      >
        {isProcessing ? (
          <ActivityIndicator size="small" color={Colors.textPrimary} />
        ) : (
          <Text style={styles.livenessStartText}>Start Liveness Check</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EnrolmentScreen - Multi-step enrollment wizard for field personnel
 *
 * Flow: Details → Front Capture → Left Capture → Right Capture → Liveness → Confirm
 *
 * Uses local face processing engine for embedding generation and liveness detection.
 * All data is stored in encrypted local storage.
 */
const EnrolmentScreen: React.FC<EnrolmentScreenProps> = ({ navigation, route }) => {
  // ── State ──────────────────────────────────────────────────────────────
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Form fields
  const [name, setName] = useState<string>('');
  const [employeeId, setEmployeeId] = useState<string>('');
  const [department, setDepartment] = useState<NHAIDepartment>('Engineering');
  const [role, setRole] = useState<PersonnelRole>('Field Engineer');

  // Face captures
  const [captures, setCaptures] = useState<Record<FaceCaptureAngle, FaceCapture | null>>({
    front: null,
    left: null,
    right: null,
  });

  // Liveness
  const [livenessResult, setLivenessResult] = useState<LivenessResult | null>(null);

  // Form validation
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ── Computed ───────────────────────────────────────────────────────────
  const currentStep = ENROLLMENT_STEPS[currentStepIndex];

  const isDetailsValid = useMemo(() => {
    return name.trim().length >= 2 && employeeId.trim().length >= 3;
  }, [name, employeeId]);

  // ── Handlers ───────────────────────────────────────────────────────────

  /**
   * Validates the details form and advances to next step
   */
  const validateAndAdvance = useCallback(() => {
    const errors: Record<string, string> = {};
    if (name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }
    if (employeeId.trim().length < 3) {
      errors.employeeId = 'Employee ID must be at least 3 characters';
    }
    setFormErrors(errors);

    if (Object.keys(errors).length === 0) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [name, employeeId]);

  /**
   * Handles face capture for the current angle
   */
  const handleCapture = useCallback((angle: FaceCaptureAngle) => {
    setIsProcessing(true);
    // TODO: Replace with actual camera capture + face engine processing
    setTimeout(() => {
      const capture: FaceCapture = {
        angle,
        imageData: '', // Base64 from camera
        embedding: new Array(128).fill(0), // From face engine
        qualityScore: 0.92,
        capturedAt: new Date().toISOString(),
      };
      setCaptures((prev) => ({ ...prev, [angle]: capture }));
      setIsProcessing(false);

      // Auto-advance after brief delay
      setTimeout(() => {
        setCurrentStepIndex((prev) => prev + 1);
      }, 800);
    }, 1500);
  }, []);

  /**
   * Handles liveness check completion
   */
  const handleLivenessComplete = useCallback((result: LivenessResult) => {
    setLivenessResult(result);
    if (result.isLive) {
      setTimeout(() => {
        setCurrentStepIndex((prev) => prev + 1);
      }, 1000);
    } else {
      Alert.alert(
        'Liveness Check Failed',
        'Please try again. Make sure you are in a well-lit area.',
        [{ text: 'Retry', style: 'default' }],
      );
    }
  }, []);

  /**
   * Confirms enrollment and saves to local storage
   */
  const handleConfirmEnrollment = useCallback(async () => {
    setIsProcessing(true);
    try {
      // TODO: Replace with actual data layer calls
      // const personnelId = await PersonnelDB.create({ name, employeeId, department, role });
      // await EnrollmentDB.create({ personnelId, captures, livenessResult });
      // await SyncQueue.enqueue({ type: 'enrollment', referenceId: personnelId });

      Alert.alert(
        'Enrollment Successful! ✅',
        `${name} has been enrolled successfully. Face data is stored locally and will sync when connected.`,
        [
          {
            text: 'Done',
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } catch (error) {
      console.error('[EnrolmentScreen] Enrollment failed:', error);
      Alert.alert(
        'Enrollment Failed',
        'An error occurred while saving enrollment data. Please try again.',
        [{ text: 'OK' }],
      );
    } finally {
      setIsProcessing(false);
    }
  }, [name, navigation]);

  /**
   * Navigates back one step or exits the screen
   */
  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    } else {
      navigation.goBack();
    }
  }, [currentStepIndex, navigation]);

  // ── Step Renderers ─────────────────────────────────────────────────────

  const renderDetailsStep = () => (
    <Animated.View entering={SlideInRight.duration(300)} key="details">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.formScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.stepTitle}>Personnel Details</Text>
          <Text style={styles.stepDescription}>
            Enter the personnel information for enrollment. All fields are required.
          </Text>

          <FormInput
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Rajesh Kumar"
            error={formErrors.name}
          />
          <FormInput
            label="Employee ID"
            value={employeeId}
            onChangeText={setEmployeeId}
            placeholder="e.g. NHAI-EMP-0042"
            autoCapitalize="characters"
            error={formErrors.employeeId}
          />

          <ChipSelector
            label="Department"
            options={DEPARTMENTS}
            selected={department}
            onSelect={(val) => setDepartment(val as NHAIDepartment)}
          />

          <ChipSelector
            label="Role"
            options={ROLES}
            selected={role}
            onSelect={(val) => setRole(val as PersonnelRole)}
          />

          <TouchableOpacity
            style={[styles.nextButton, !isDetailsValid && styles.nextButtonDisabled]}
            onPress={validateAndAdvance}
            disabled={!isDetailsValid}
            activeOpacity={0.8}
          >
            <Text style={styles.nextButtonText}>Continue to Face Capture</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );

  const renderCaptureStep = (angle: FaceCaptureAngle) => (
    <Animated.View entering={SlideInRight.duration(300)} key={`capture_${angle}`}>
      <CameraViewfinder
        angle={angle}
        onCapture={() => handleCapture(angle)}
        isCapturing={isProcessing}
        capturedImage={captures[angle]?.imageData ?? null}
      />
    </Animated.View>
  );

  const renderLivenessStep = () => (
    <Animated.View entering={SlideInRight.duration(300)} key="liveness">
      <LivenessCheckView onComplete={handleLivenessComplete} isProcessing={isProcessing} />
    </Animated.View>
  );

  const renderConfirmationStep = () => (
    <Animated.View
      entering={SlideInRight.duration(300)}
      key="confirmation"
      style={styles.confirmationContainer}
    >
      <ScrollView
        contentContainerStyle={styles.formScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.confirmIcon}>
          <Text style={styles.confirmIconText}>🎉</Text>
        </View>
        <Text style={styles.confirmTitle}>Ready to Enroll</Text>
        <Text style={styles.confirmSubtitle}>
          Please verify the information below before confirming.
        </Text>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Name</Text>
            <Text style={styles.summaryValue}>{name}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Employee ID</Text>
            <Text style={styles.summaryValue}>{employeeId}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Department</Text>
            <Text style={styles.summaryValue}>{department}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Role</Text>
            <Text style={styles.summaryValue}>{role}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Face Captures</Text>
            <Text style={styles.summaryValue}>
              {Object.values(captures).filter(Boolean).length}/3 ✅
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Liveness</Text>
            <Text
              style={[
                styles.summaryValue,
                {
                  color: livenessResult?.isLive ? Colors.success : Colors.error,
                },
              ]}
            >
              {livenessResult?.isLive ? 'Verified ✅' : 'Not Verified ❌'}
            </Text>
          </View>
        </View>

        {/* Face Capture Thumbnails */}
        <View style={styles.thumbnailRow}>
          {(['front', 'left', 'right'] as FaceCaptureAngle[]).map((angle) => (
            <View key={angle} style={styles.thumbnailCard}>
              <View style={styles.thumbnailPlaceholder}>
                <Text style={styles.thumbnailEmoji}>{captures[angle] ? '✅' : '❌'}</Text>
              </View>
              <Text style={styles.thumbnailLabel}>
                {angle.charAt(0).toUpperCase() + angle.slice(1)}
              </Text>
            </View>
          ))}
        </View>

        {/* Confirm Button */}
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirmEnrollment}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color={Colors.textPrimary} />
          ) : (
            <Text style={styles.confirmButtonText}>Confirm Enrollment</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </Animated.View>
  );

  /**
   * Renders the current step's content
   */
  const renderCurrentStep = () => {
    if (!currentStep) {
      return null;
    }

    switch (currentStep.key) {
      case 'details':
        return renderDetailsStep();
      case 'capture_front':
        return renderCaptureStep('front');
      case 'capture_left':
        return renderCaptureStep('left');
      case 'capture_right':
        return renderCaptureStep('right');
      case 'liveness':
        return renderLivenessStep();
      case 'confirmation':
        return renderConfirmationStep();
      default:
        return null;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.backgroundDark} />

      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Personnel Enrollment</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress Stepper */}
      <ProgressStepper currentStepIndex={currentStepIndex} totalSteps={ENROLLMENT_STEPS.length} />

      {/* Step Content */}
      <View style={styles.stepContent}>{renderCurrentStep()}</View>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: Colors.primaryOrange,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 60,
  },

  // Progress Stepper
  stepperContainer: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  stepperTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.inputBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    borderColor: Colors.primaryOrange,
    backgroundColor: 'rgba(255, 107, 0, 0.2)',
  },
  stepCircleCompleted: {
    borderColor: Colors.success,
    backgroundColor: Colors.success,
  },
  stepCircleText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  stepCircleTextActive: {
    color: Colors.textPrimary,
  },
  stepConnector: {
    width: 20,
    height: 2,
    backgroundColor: Colors.inputBorder,
  },
  stepConnectorCompleted: {
    backgroundColor: Colors.success,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primaryOrange,
    marginTop: 4,
  },

  // Step Content
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
  },

  // Form
  formScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  formInputContainer: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  formInput: {
    backgroundColor: Colors.inputBackground,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  formInputFocused: {
    borderColor: Colors.inputBorderFocused,
  },
  formInputError: {
    borderColor: Colors.error,
  },
  formError: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 4,
    marginLeft: 4,
  },

  // Chip Selector
  chipSelectorContainer: {
    marginBottom: 20,
  },
  chipScrollContent: {
    gap: 8,
    paddingRight: 20,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  chipSelected: {
    backgroundColor: 'rgba(255, 107, 0, 0.2)',
    borderColor: Colors.primaryOrange,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    color: Colors.primaryOrange,
    fontWeight: '600',
  },

  // Next Button
  nextButton: {
    backgroundColor: Colors.primaryOrange,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    ...Platform.select({
      android: { elevation: 4 },
      ios: {
        shadowColor: Colors.primaryOrange,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  // Camera Viewfinder
  cameraContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  cameraPlaceholder: {
    width: SCREEN_WIDTH - 80,
    height: SCREEN_WIDTH - 80,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  faceFrameOverlay: {
    position: 'absolute',
    width: '70%',
    height: '70%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: Colors.primaryOrange,
  },
  frameCornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  frameCornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  frameCornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  frameCornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  angleIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  cameraPlaceholderText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  captureInstruction: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 107, 0, 0.2)',
    borderWidth: 4,
    borderColor: Colors.primaryOrange,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primaryOrange,
  },

  // Captured Preview
  capturedPreview: {
    width: SCREEN_WIDTH - 80,
    height: SCREEN_WIDTH - 80,
    borderRadius: 20,
    overflow: 'hidden',
  },
  capturedCheckmark: {
    fontSize: 64,
    marginBottom: 12,
  },
  capturedText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.success,
  },

  // Liveness
  livenessContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  livenessIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  livenessInstructions: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 24,
  },
  livenessTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  livnessChallengeText: {
    fontSize: 16,
    color: Colors.primaryOrange,
    fontWeight: '600',
    marginBottom: 16,
  },
  livenessProgressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.surface,
    borderRadius: 2,
    overflow: 'hidden',
  },
  livenessProgressFill: {
    height: '100%',
    backgroundColor: Colors.success,
    borderRadius: 2,
  },
  livenessStartButton: {
    marginTop: 32,
    backgroundColor: Colors.primaryOrange,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 48,
    ...Platform.select({
      android: { elevation: 4 },
      ios: {
        shadowColor: Colors.primaryOrange,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
  },
  livenessStartText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  // Confirmation
  confirmationContainer: {
    flex: 1,
  },
  confirmIcon: {
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmIconText: {
    fontSize: 48,
  },
  confirmTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: Colors.glassBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: 16,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
    maxWidth: '55%',
    textAlign: 'right',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.glassBorder,
  },

  // Thumbnails
  thumbnailRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  thumbnailCard: {
    alignItems: 'center',
  },
  thumbnailPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  thumbnailEmoji: {
    fontSize: 24,
  },
  thumbnailLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
    textTransform: 'capitalize',
  },

  // Confirm Button
  confirmButton: {
    backgroundColor: Colors.success,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    ...Platform.select({
      android: { elevation: 4 },
      ios: {
        shadowColor: Colors.success,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
  },
  confirmButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});

export default EnrolmentScreen;
