// E:\Stryde\app\(tabs)\activity.tsx
import { StyleSheet, View, useColorScheme } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import stepCounter from '@/services/stepCounter'; // Updated from '../services/stepCounter'

export default function ActivityScreen() {
  const [currentStepCount, setCurrentStepCount] = useState<number>(0);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const colorScheme = useColorScheme();
  const backgroundColor = colorScheme === 'dark' ? '#121212' : '#FFFFFF';
  const textColor = colorScheme === 'dark' ? '#FFFFFF' : '#000000';
  const cardBackground = colorScheme === 'dark' ? '#1E1E1E' : '#F8F8F8';

  // Subscribe to step counter updates
  useEffect(() => {
    const unsubscribe = stepCounter.subscribe((steps: number) => {
      setCurrentStepCount(steps);
    });

    // Initialize step counter if not already started
    if (!stepCounter.pedometerSubscription) {
      stepCounter.start().catch((err: Error) => {
        console.error('Failed to start step counter:', err);
        setError('Failed to initialize step counter');
      });
    }
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);
  // Subscribe to shaking state
  useEffect(() => {
    const interval = setInterval(() => {
      setIsShaking(stepCounter.isShaking);
    }, 100); // Check every 100ms
    
    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <ThemedView style={styles.container}>
        {error ? (
          <ThemedText style={[styles.errorText, { color: 'red' }]}>{error}</ThemedText>
        ) : (
          <View style={styles.content}>
            {isShaking && (
              <View style={styles.shakeAlert}>
                <ThemedText style={styles.shakeText}>
                  Shaking detected - pausing step count
                </ThemedText>
              </View>
            )}

            <View style={styles.cardContainer}>
              <ThemedView style={[styles.mainCard, { backgroundColor: cardBackground }]}>
                <ThemedText style={[styles.cardTitle, { color: textColor }]}>Steps</ThemedText>
                <ThemedText style={[styles.cardValue, { color: textColor }]}>
                  {Math.floor(currentStepCount)}
                </ThemedText>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min((currentStepCount / 10000) * 100, 100)}%`,
                        backgroundColor: colorScheme === 'dark' ? '#00C4B4' : '#00C4B4',
                      },
                    ]}
                  />
                </View>
                <ThemedText style={[styles.progressText, { color: textColor }]}>
                  ---- Steps 10000 Steps
                </ThemedText>
              </ThemedView>

              <View style={styles.metricsRow}>
                <ThemedView style={[styles.metricCard, { backgroundColor: cardBackground }]}>
                  <ThemedText style={[styles.metricIcon, { color: textColor }]}>📍</ThemedText>
                  <ThemedText style={[styles.metricValueSmall, { color: textColor }]}>--</ThemedText>
                  <ThemedText style={[styles.metricValueSmall, { color: textColor }]}>yd</ThemedText>
                  <ThemedText style={[styles.metricLabelSmall, { color: textColor }]}>Distance</ThemedText>
                </ThemedView>
                <ThemedView style={[styles.metricCard, { backgroundColor: cardBackground }]}>
                  <ThemedText style={[styles.metricIcon, { color: textColor }]}>🔥</ThemedText>
                  <ThemedText style={[styles.metricValueSmall, { color: textColor }]}>--</ThemedText>
                  <ThemedText style={[styles.metricValueSmall, { color: textColor }]}>kcal</ThemedText>
                  <ThemedText style={[styles.metricLabelSmall, { color: textColor }]}>Calories</ThemedText>
                </ThemedView>
                <ThemedView style={[styles.metricCard, { backgroundColor: cardBackground }]}>
                  <ThemedText style={[styles.metricIcon, { color: textColor }]}>⏱️</ThemedText>
                  <ThemedText style={[styles.metricValueSmall, { color: textColor }]}>--</ThemedText>
                  <ThemedText style={[styles.metricValueSmall, { color: textColor }]}>min</ThemedText>
                  <ThemedText style={[styles.metricLabelSmall, { color: textColor }]}>Time</ThemedText>
                </ThemedView>
              </View>
            </View>
          </View>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    width: '100%',
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
  },
  mainCard: {
    borderRadius: 16,
    padding: 25,
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    width: '90%',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  cardValue: {
    fontSize: 38,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
    padding: 15,
  },
  progressBar: {
    height: 10,
    width: '100%',
    backgroundColor: '#E0E0E0',
    borderRadius: 5,
    marginVertical: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 5,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    alignItems: 'center',
  },
  metricIcon: {
    fontSize: 24,
    marginBottom: 5,
    padding: 5,
  },
  metricValueSmall: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  metricLabelSmall: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  shakeAlert: {
    backgroundColor: 'rgba(255, 165, 0, 0.2)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'orange',
  },
  shakeText: {
    color: 'orange',
    textAlign: 'center',
    fontWeight: '500',
  },
});