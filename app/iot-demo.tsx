import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IoTStepCounter from '../services/iotStepCounter';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const IoTDemo = () => {
  const [steps, setSteps] = useState<number>(0);
  const colorScheme = useColorScheme();
  const backgroundColor = colorScheme === 'dark' ? '#121212' : '#FFFFFF';
  const cardBackground = colorScheme === 'dark' ? '#1E1E1E' : '#F8F8F8';
  const textColor = colorScheme === 'dark' ? '#FFFFFF' : '#000000';
  const accentColor = colorScheme === 'dark' ? '#00C4B4' : '#007AFF';

  // Animation for step count
  const stepCountAnimation = useSharedValue(0);

  useEffect(() => {
    console.log('Starting IoT Step Counter...');
    IoTStepCounter.start((newSteps: number) => {
      console.log('Received new steps:', newSteps);
      setSteps(newSteps);
      stepCountAnimation.value = newSteps; // Trigger animation
    });
    return () => {
      console.log('Component unmounted, cleaning up...');
      IoTStepCounter.stop();
    };
  }, [stepCountAnimation]);

  // Animated style for step count
  const animatedStepStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withSpring(1, { damping: 10, stiffness: 100 }),
        },
      ],
    };
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <Ionicons name="walk" size={30} color={accentColor} style={styles.headerIcon} />
        <Text style={[styles.headerText, { color: textColor }]}>IoT Step Counter</Text>
      </View>
      <View style={[styles.card, { backgroundColor: cardBackground, shadowColor: textColor }]}>
        <View style={[styles.circle, { borderColor: accentColor }]}>
          <Animated.View style={animatedStepStyle}>
            <Text style={[styles.stepCount, { color: accentColor }]}>{steps}</Text>
          </Animated.View>
          <Text style={[styles.label, { color: textColor }]}>Steps</Text>
        </View>
      </View>
      <Text style={[styles.infoText, { color: textColor }]}>
        Shake your device to increment steps
      </Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerIcon: {
    marginRight: 10,
  },
  headerText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  card: {
    borderRadius: 16,
    padding: 20,
    elevation: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    alignItems: 'center',
    width: '90%',
  },
  circle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCount: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 18,
    marginTop: 5,
  },
  infoText: {
    fontSize: 16,
    marginTop: 20,
    opacity: 0.7,
  },
});

export default IoTDemo;