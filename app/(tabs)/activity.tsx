import { StyleSheet, View, useColorScheme } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import stepCounter from '@/services/stepCounter'; // Verify this path
import { db, auth } from '../../firebase';
import { collection, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function ActivityScreen() {
  const [currentStepCount, setCurrentStepCount] = useState<number>(0);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const colorScheme = useColorScheme();
  const backgroundColor = colorScheme === 'dark' ? '#121212' : '#FFFFFF';
  const textColor = colorScheme === 'dark' ? '#FFFFFF' : '#000000';
  const cardBackground = colorScheme === 'dark' ? '#1E1E1E' : '#F8F8F8';

  // Handle user authentication state changes
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);

        // Type check for stepCounter methods
        if (stepCounter && typeof (stepCounter as any).setUserId === 'function') {
          (stepCounter as any).setUserId(user.uid); // Safely call setUserId with type assertion
          console.log('setUserId called successfully for user:', user.uid);
        } else {
          console.error('stepCounter.setUserId is not a function. Available methods:', Object.keys(stepCounter));
          setError('Step counter initialization failed: setUserId not found');
        }

        const userDocRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCurrentStepCount(data.stepCount || 0);
        } else {
          await setDoc(userDocRef, { email: user.email, stepCount: 0, createdAt: new Date().toISOString() }, { merge: true });
          setCurrentStepCount(0);
        }

        if (!(stepCounter as any).pedometerSubscription && typeof (stepCounter as any).start === 'function') {
          try {
            await (stepCounter as any).start();
          } catch (err) {
            console.error('Failed to start step counter:', err);
            setError('Failed to initialize step counter');
          }
        }
      } else {
        setUserId(null);
        setCurrentStepCount(0);
        if ((stepCounter as any).pedometerSubscription && typeof (stepCounter as any).stop === 'function') {
          (stepCounter as any).stop();
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Subscribe to step counter updates and sync with Firestore
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = (stepCounter as any).subscribe((steps: number) => {
      const userDocRef = doc(db, 'users', userId);
      setDoc(userDocRef, { stepCount: steps }, { merge: true }).catch((err: Error) =>
        console.error('Failed to update step count:', err)
      );
      setCurrentStepCount(steps); // Update UI with the latest step count
    });

    const unsubscribeFirestore = onSnapshot(doc(db, 'users', userId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCurrentStepCount(data.stepCount || 0);
      }
    }, (err) => {
      console.error('Firestore listen error:', err);
      setError('Failed to sync step count');
    });

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') unsubscribe();
      if (unsubscribeFirestore && typeof unsubscribeFirestore === 'function') unsubscribeFirestore();
    };
  }, [userId]);

  // Subscribe to shaking state
  useEffect(() => {
    const interval = setInterval(() => {
      setIsShaking((stepCounter as any).isShaking);
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Calculate step metrics
  const calculateDistance = () => {
    const strideLength = 0.76; // meters
    const meters = currentStepCount * strideLength;
    const yards = Math.floor(meters * 1.09);
    return yards;
  };

  const calculateCalories = () => {
    return Math.floor(currentStepCount * 0.04);
  };

  const calculateTime = () => {
    return Math.floor(currentStepCount / 100);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <ThemedView style={styles.container}>
        {error ? (
          <ThemedText style={[styles.errorText, { color: 'red' }]}>{error}</ThemedText>
        ) : (
          <View style={styles.content}>
            {isShaking && (
              <View style={styles.shakeAlert}>
                <ThemedText style={styles.shakeText}>Shaking detected - pausing step count</ThemedText>
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
                <ThemedText style={[styles.progressText, { color: textColor }]}>---- Steps 10000 Steps</ThemedText>
              </ThemedView>

              <View style={styles.metricsRow}>
                <ThemedView style={[styles.metricCard, { backgroundColor: cardBackground }]}>
                  <ThemedText style={[styles.metricIcon, { color: textColor }]}>📍</ThemedText>
                  <ThemedText style={[styles.metricValueSmall, { color: textColor }]}>
                    {userId ? calculateDistance() : '--'}
                  </ThemedText>
                  <ThemedText style={[styles.metricValueSmall, { color: textColor }]}>yd</ThemedText>
                  <ThemedText style={[styles.metricLabelSmall, { color: textColor }]}>Distance</ThemedText>
                </ThemedView>
                <ThemedView style={[styles.metricCard, { backgroundColor: cardBackground }]}>
                  <ThemedText style={[styles.metricIcon, { color: textColor }]}>🔥</ThemedText>
                  <ThemedText style={[styles.metricValueSmall, { color: textColor }]}>
                    {userId ? calculateCalories() : '--'}
                  </ThemedText>
                  <ThemedText style={[styles.metricValueSmall, { color: textColor }]}>kcal</ThemedText>
                  <ThemedText style={[styles.metricLabelSmall, { color: textColor }]}>Calories</ThemedText>
                </ThemedView>
                <ThemedView style={[styles.metricCard, { backgroundColor: cardBackground }]}>
                  <ThemedText style={[styles.metricIcon, { color: textColor }]}>⏱️</ThemedText>
                  <ThemedText style={[styles.metricValueSmall, { color: textColor }]}>
                    {userId ? calculateTime() : '--'}
                  </ThemedText>
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
  safeArea: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20, width: '100%' },
  cardContainer: { flex: 1, alignItems: 'center' },
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
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  cardValue: { fontSize: 38, fontWeight: 'bold', textAlign: 'center', marginBottom: 5, padding: 15 },
  progressBar: {
    height: 10,
    width: '100%',
    backgroundColor: '#E0E0E0',
    borderRadius: 5,
    marginVertical: 10,
  },
  progressFill: { height: '100%', borderRadius: 5 },
  progressText: { fontSize: 14, textAlign: 'center', marginTop: 5 },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', width: '90%' },
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
  metricIcon: { fontSize: 24, marginBottom: 5, padding: 5 },
  metricValueSmall: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 5 },
  metricLabelSmall: { fontSize: 14, fontWeight: '500', textAlign: 'center' },
  errorText: { fontSize: 18, textAlign: 'center', paddingHorizontal: 20, marginBottom: 20 },
  shakeAlert: {
    backgroundColor: 'rgba(255, 165, 0, 0.2)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'orange',
  },
  shakeText: { color: 'orange', textAlign: 'center', fontWeight: '500' },
});