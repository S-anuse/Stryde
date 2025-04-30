import React, { useState, useEffect } from 'react';
import { Slot, useRootNavigationState } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Pedometer } from 'expo-sensors';
import stepCounter from '../services/stepCounter';
import * as Notifications from 'expo-notifications';

// Define types for navigation state routes
interface Route {
  name: string;
  key: string;
  params?: any;
}

export default function RootLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isPedometerAvailable, setIsPedometerAvailable] = useState<boolean>(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [isCounting, setIsCounting] = useState<boolean>(true);

  // Get the current route name
  const navigationState = useRootNavigationState();
  const routes: Route[] = navigationState?.routes ?? [];
  const currentRoute = routes[routes.length - 1]?.name || '';

  // Request notification permissions
  useEffect(() => {
    const requestNotificationPermissions = async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          console.warn('Notification permissions not granted');
        }
      } catch (error) {
        console.error('Error requesting notification permissions:', error);
      }
    };
    requestNotificationPermissions();
  }, []);

  // Check pedometer availability and request permissions
  useEffect(() => {
    const setupPedometer = async () => {
      try {
        const available = await Pedometer.isAvailableAsync();
        setIsPedometerAvailable(available);

        if (available) {
          const permission = await Pedometer.requestPermissionsAsync();
          setPermissionGranted(permission.granted);
        } else {
          console.warn('Pedometer not available on this device');
        }
      } catch (error) {
        console.error('Error setting up pedometer:', error);
      }
    };
    setupPedometer();
  }, []);

  // Start or stop the step counter based on the current route
  useEffect(() => {
    // Routes where step counting should be paused
    const pauseRoutes = ['3']; // Adjust as needed
    const shouldCount = !pauseRoutes.includes(currentRoute);

    setIsCounting(shouldCount);

    if (isPedometerAvailable && permissionGranted) {
      try {
        if (shouldCount) {
          stepCounter.start();
          console.log('Step counter started');
        } else {
          stepCounter.stop();
          console.log('Step counter stopped');
        }
      } catch (error) {
        console.error('Error managing step counter:', error);
      }
    }

    // Cleanup on unmount or route change
    return () => {
      try {
        stepCounter.stop();
      } catch (error) {
        console.error('Error stopping step counter:', error);
      }
    };
  }, [isPedometerAvailable, permissionGranted, currentRoute]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      console.log('Navigating to /login');
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Slot />;
}