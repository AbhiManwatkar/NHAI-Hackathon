import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppNavigator from '../navigation/AppNavigator';
import { FaceEngine } from '../modules/FaceEngine';
import { SyncManager } from '../modules/SyncManager';
import { VaultManager } from '../modules/BiometricVault';
import { Colors } from '../theme/colors';
import { Logger } from '../utils/logger';
import { useAppStore } from '../store/useAppStore';

const bootSteps = [
  { label: 'Initialising secure vault...', duration: 500 },
  { label: 'Loading AI models offline...', duration: 1500 },
  { label: 'Syncing employee registry...', duration: 200 },
  { label: 'Ready - working offline', duration: 0 },
] as const;

export const AppBootstrap: React.FC = () => {
  const [ready, setReady] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const initApp = useAppStore((state) => state.initApp);

  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: Infinity,
            gcTime: 1000 * 60 * 60 * 24,
            retry: false,
            networkMode: 'always',
          },
        },
      }),
    [],
  );

  const runStepDelay = (duration: number) =>
    new Promise<void>((resolve) => {
      if (duration <= 0) {
        resolve();
        return;
      }
      setTimeout(resolve, duration);
    });

  const boot = useCallback(async () => {
    setReady(false);
    setError(null);
    progress.setValue(0);

    try {
      setActiveStep(0);
      await Promise.all([VaultManager.getInstance().init(), runStepDelay(bootSteps[0].duration)]);
      animateProgress(progress, 0.25);

      setActiveStep(1);
      await Promise.all([FaceEngine.initialize(), runStepDelay(bootSteps[1].duration)]);
      useAppStore.getState().setModelsReady(true);
      animateProgress(progress, 0.6);

      setActiveStep(2);
      SyncManager.getInstance().init();
      await runStepDelay(bootSteps[2].duration);
      animateProgress(progress, 0.82);

      setActiveStep(3);
      await initApp();
      animateProgress(progress, 1);
      Logger.info('AppBootstrap', 'Boot sequence complete');
      setReady(true);
    } catch (bootError) {
      const message = bootError instanceof Error ? bootError.message : String(bootError);
      Logger.error('AppBootstrap', 'Boot sequence failed', { error: message });
      setError(message);
    }
  }, [initApp, progress]);

  useEffect(() => {
    boot();
  }, [boot]);

  if (ready) {
    return (
      <QueryClientProvider client={queryClient}>
        <AppNavigator />
      </QueryClientProvider>
    );
  }

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <QueryClientProvider client={queryClient}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.ui.background} />
        <View style={styles.logo}>
          <Text style={styles.logoText}>NHAI</Text>
        </View>
        <Text style={styles.title}>FaceGuard Offline</Text>
        <Text style={styles.subtitle}>Secure attendance that starts before the network does.</Text>

        <View style={styles.stepPanel}>
          {bootSteps.map((step, index) => (
            <View key={step.label} style={styles.stepRow}>
              <View
                style={[
                  styles.stepDot,
                  index <= activeStep && styles.stepDotActive,
                  Boolean(error) && index === activeStep && styles.stepDotError,
                ]}
              />
              <Text
                style={[
                  styles.stepText,
                  index === activeStep && styles.stepTextActive,
                  index < activeStep && styles.stepTextDone,
                ]}
              >
                {step.label}
              </Text>
            </View>
          ))}
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
        </View>

        {error ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorTitle}>Startup needs attention</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={boot}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </QueryClientProvider>
  );
};

function animateProgress(progress: Animated.Value, value: number): void {
  Animated.timing(progress, {
    toValue: value,
    duration: 260,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: false,
  }).start();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Colors.ui.background,
  },
  logo: {
    width: 92,
    height: 92,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand.primary,
    marginBottom: 18,
  },
  logoText: {
    color: Colors.text.primary,
    fontSize: 22,
    fontWeight: '900',
  },
  title: {
    color: Colors.text.primary,
    fontSize: 26,
    fontWeight: '900',
  },
  subtitle: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  stepPanel: {
    width: '100%',
    marginTop: 32,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    backgroundColor: Colors.ui.surface,
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.ui.border,
  },
  stepDotActive: {
    backgroundColor: Colors.brand.primary,
  },
  stepDotError: {
    backgroundColor: Colors.status.error,
  },
  stepText: {
    color: Colors.text.muted,
    fontWeight: '700',
  },
  stepTextActive: {
    color: Colors.text.primary,
  },
  stepTextDone: {
    color: Colors.text.secondary,
  },
  progressTrack: {
    height: 6,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: Colors.ui.surfaceHigh,
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: Colors.brand.primary,
  },
  errorPanel: {
    width: '100%',
    marginTop: 18,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.status.error,
    backgroundColor: Colors.ui.surface,
  },
  errorTitle: {
    color: Colors.text.primary,
    fontWeight: '900',
    fontSize: 15,
  },
  errorText: {
    color: Colors.text.secondary,
    fontWeight: '700',
    marginTop: 6,
  },
  retryButton: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand.primary,
  },
  retryText: {
    color: Colors.text.primary,
    fontWeight: '900',
  },
});

export default AppBootstrap;
