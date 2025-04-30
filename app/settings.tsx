import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Pressable,
  Switch,
  ScrollView,
  Alert,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SettingsOption = {
  key: string;
  title: string;
  description: string;
  type: 'toggle' | 'action';
  icon: string;
  value?: boolean;
  action?: () => void;
};

export default function Settings() {
  const router = useRouter();
  const [settings, setSettings] = useState<SettingsOption[]>([
    {
      key: 'darkMode',
      title: 'Dark Mode',
      description: 'Use dark theme throughout the app',
      type: 'toggle',
      icon: 'moon-outline',
      value: false,
    },
    {
      key: 'notifications',
      title: 'Notifications',
      description: 'Receive activity reminders and updates',
      type: 'toggle',
      icon: 'notifications-outline',
      value: true,
    },
    {
      key: 'useMetric',
      title: 'Use Metric Units',
      description: 'Show distances in kilometers instead of miles',
      type: 'toggle',
      icon: 'speedometer-outline',
      value: true,
    },
    {
      key: 'hapticFeedback',
      title: 'Haptic Feedback',
      description: 'Enable vibration feedback for actions',
      type: 'toggle',
      icon: 'body-outline',
      value: true,
    },
    {
      key: 'allowGPS',
      title: 'Allow GPS Tracking',
      description: 'Track your location during activities',
      type: 'toggle',
      icon: 'location-outline',
      value: true,
    },
    {
      key: 'autoLock',
      title: 'Prevent Sleep During Activity',
      description: 'Keep screen on while recording an activity',
      type: 'toggle',
      icon: 'phone-portrait-outline',
      value: true,
    },
    {
      key: 'account',
      title: 'Account Settings',
      description: 'Manage your profile and preferences',
      type: 'action',
      icon: 'person-outline',
      action: () => router.push('/(tabs)/profile'),
    },
    {
      key: 'data',
      title: 'Export Activity Data',
      description: 'Download your activity history',
      type: 'action',
      icon: 'download-outline',
      action: () => Alert.alert('Export Data', 'This feature will be available soon.'),
    },
    {
      key: 'privacy',
      title: 'Privacy Settings',
      description: 'Manage data sharing and privacy options',
      type: 'action',
      icon: 'shield-checkmark-outline',
      action: () => Alert.alert('Privacy Settings', 'This feature will be available soon.'),
    },
    {
      key: 'about',
      title: 'About',
      description: 'App version and legal information',
      type: 'action',
      icon: 'information-circle-outline',
      action: () => Alert.alert('About Stryde', 'Version 1.0.0\n\nDeveloped with ❤️'),
    },
    {
      key: 'help',
      title: 'Help & Support',
      description: 'Get assistance with using the app',
      type: 'action',
      icon: 'help-circle-outline',
      action: () => Alert.alert('Help & Support', 'Contact support@stryde.com for assistance.'),
    },
    {
      key: 'logout',
      title: 'Logout',
      description: 'Sign out of your account',
      type: 'action',
      icon: 'log-out-outline',
      action: () => {
        Alert.alert(
          'Logout',
          'Are you sure you want to logout?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Logout', 
              style: 'destructive',
              onPress: () => {
                // Perform logout actions
                Alert.alert('Logged out successfully');
                router.push('/login');
              } 
            },
          ]
        );
      },
    },
  ]);

  const handleToggleChange = async (index: number, newValue: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const newSettings = [...settings];
    newSettings[index].value = newValue;
    setSettings(newSettings);
    
    // Persist to AsyncStorage
    try {
      await AsyncStorage.setItem('settings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f7fa" />
      
      <View style={styles.header}>
        <Pressable 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerRight} />
      </View>
      
      <ScrollView style={styles.container}>
        <View style={styles.settingsContainer}>
          {settings.map((setting, index) => (
            <View key={setting.key} style={styles.settingItem}>
              <View style={[styles.iconContainer, { backgroundColor: getIconColor(setting.key) }]}>
                <Ionicons name={setting.icon as any} size={20} color="#fff" />
              </View>
              
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>{setting.title}</Text>
                <Text style={styles.settingDescription}>{setting.description}</Text>
              </View>
              
              {setting.type === 'toggle' ? (
                <Switch
                  value={setting.value}
                  onValueChange={(newValue) => handleToggleChange(index, newValue)}
                  trackColor={{ false: '#d1d1d6', true: '#34c759' }}
                  thumbColor={Platform.OS === 'ios' ? '#fff' : setting.value ? '#fff' : '#f4f3f4'}
                  ios_backgroundColor="#d1d1d6"
                />
              ) : (
                <Pressable 
                  style={styles.actionButton}
                  onPress={setting.action}
                >
                  <Ionicons name="chevron-forward" size={20} color="#888" />
                </Pressable>
              )}
            </View>
          ))}
        </View>
        
        <Text style={styles.footerText}>Stryde v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// Function to get icon background color based on setting key
function getIconColor(key: string): string {
  const colorMap: Record<string, string> = {
    darkMode: '#6c757d',
    notifications: '#fd7e14',
    useMetric: '#0d6efd',
    hapticFeedback: '#6610f2',
    allowGPS: '#198754',
    autoLock: '#dc3545',
    account: '#0dcaf0',
    data: '#20c997',
    privacy: '#6f42c1',
    about: '#0d6efd',
    help: '#ffc107',
    logout: '#dc3545',
  };
  
  return colorMap[key] || '#6c757d';
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  headerRight: {
    width: 40,
  },
  container: {
    flex: 1,
  },
  settingsContainer: {
    backgroundColor: '#fff',
    marginVertical: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
    paddingRight: 8,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: '#888',
  },
  actionButton: {
    padding: 8,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#888',
    marginVertical: 24,
  },
});