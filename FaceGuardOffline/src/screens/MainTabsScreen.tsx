/**
 * @fileoverview MainTabsScreen - Custom Premium Tab Container
 * @description Implements a high-end, animated glassmorphism custom bottom navigation tab bar,
 * rendering the correct sub-screen (Home, Recognition, Attendance Log, Admin) with micro-interactions
 * and smooth transitions. Fits the NHAI color palette.
 * @version 1.0.0
 */

import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

// Sub-screens
import HomeScreen from './HomeScreen';
import RecognitionScreen from './RecognitionScreen';
import AttendanceLogScreen from './AttendanceLogScreen';
import AdminScreen from './AdminScreen';

const { width } = Dimensions.get('window');
const TAB_WIDTH = (width - 40) / 4;

type MainTabsScreenProps = NativeStackScreenProps<RootStackParamList, 'MainTabs'>;

const Colors = {
  primaryOrange: '#FF6B00',
  primaryBlue: '#1A3C5E',
  backgroundDark: '#0D1B2A',
  surface: '#1B2838',
  textPrimary: '#FFFFFF',
  textSecondary: '#B0BEC5',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  glassBackground: 'rgba(27, 40, 56, 0.90)',
};

export const MainTabsScreen: React.FC<MainTabsScreenProps> = ({ navigation, route }) => {
  const [activeTab, setActiveTab] = useState<'Home' | 'Recognition' | 'AttendanceLog' | 'Admin'>(
    'Home',
  );

  // Animation values for tab change indicators
  const indicatorPosition = useSharedValue(0);

  const handleTabPress = (
    tab: 'Home' | 'Recognition' | 'AttendanceLog' | 'Admin',
    index: number,
  ) => {
    setActiveTab(tab);
    indicatorPosition.value = withSpring(index * TAB_WIDTH, {
      damping: 15,
      stiffness: 150,
    });
  };

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorPosition.value }],
  }));

  // Render the selected tab screen content
  const renderScreen = () => {
    const screenProps = { navigation, route } as any;

    switch (activeTab) {
      case 'Home':
        return <HomeScreen {...screenProps} />;
      case 'Recognition':
        return <RecognitionScreen {...screenProps} />;
      case 'AttendanceLog':
        return <AttendanceLogScreen {...screenProps} />;
      case 'Admin':
        return <AdminScreen {...screenProps} />;
      default:
        return <HomeScreen {...screenProps} />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Target screen */}
      <View style={styles.content}>{renderScreen()}</View>

      {/* ── Custom Glassmorphism Bottom Tab Bar ──────────────────────────────── */}
      <Animated.View entering={SlideInDown.delay(100).duration(600)} style={styles.tabBarContainer}>
        <View style={styles.tabBar}>
          {/* Active slide indicator */}
          <Animated.View style={[styles.activeIndicator, animatedIndicatorStyle]} />

          {/* Tab 1: Home */}
          <TouchableOpacity
            style={styles.tabItem}
            activeOpacity={0.7}
            onPress={() => handleTabPress('Home', 0)}
          >
            <Text style={[styles.tabIcon, activeTab === 'Home' && styles.activeTabIcon]}>🏠</Text>
            <Text style={[styles.tabLabel, activeTab === 'Home' && styles.activeTabLabel]}>
              Home
            </Text>
          </TouchableOpacity>

          {/* Tab 2: Recognition */}
          <TouchableOpacity
            style={styles.tabItem}
            activeOpacity={0.7}
            onPress={() => handleTabPress('Recognition', 1)}
          >
            <Text style={[styles.tabIcon, activeTab === 'Recognition' && styles.activeTabIcon]}>
              🔍
            </Text>
            <Text style={[styles.tabLabel, activeTab === 'Recognition' && styles.activeTabLabel]}>
              Verify
            </Text>
          </TouchableOpacity>

          {/* Tab 3: Attendance Log */}
          <TouchableOpacity
            style={styles.tabItem}
            activeOpacity={0.7}
            onPress={() => handleTabPress('AttendanceLog', 2)}
          >
            <Text style={[styles.tabIcon, activeTab === 'AttendanceLog' && styles.activeTabIcon]}>
              📋
            </Text>
            <Text style={[styles.tabLabel, activeTab === 'AttendanceLog' && styles.activeTabLabel]}>
              Logs
            </Text>
          </TouchableOpacity>

          {/* Tab 4: Admin */}
          <TouchableOpacity
            style={styles.tabItem}
            activeOpacity={0.7}
            onPress={() => handleTabPress('Admin', 3)}
          >
            <Text style={[styles.tabIcon, activeTab === 'Admin' && styles.activeTabIcon]}>⚙️</Text>
            <Text style={[styles.tabLabel, activeTab === 'Admin' && styles.activeTabLabel]}>
              Admin
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  content: {
    flex: 1,
  },
  tabBarContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 12,
    left: 20,
    right: 20,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.glassBackground,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    overflow: 'hidden',
    ...Platform.select({
      android: {
        elevation: 8,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
    }),
  },
  tabBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    position: 'relative',
  },
  tabItem: {
    width: TAB_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    top: 6,
    left: 10,
    width: TAB_WIDTH - 20,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 107, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 0, 0.25)',
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
    opacity: 0.7,
  },
  activeTabIcon: {
    opacity: 1.0,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.2,
  },
  activeTabLabel: {
    color: Colors.primaryOrange,
    fontWeight: '700',
  },
});

export default MainTabsScreen;
