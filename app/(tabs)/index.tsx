<<<<<<< HEAD
import { StyleSheet, View, useColorScheme, Dimensions } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useEffect, useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import stepCounter from '@/services/stepCounter';
import { db, auth } from '../../firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { LineChart } from 'react-native-chart-kit';

export default function ActivityScreen() {
  const [currentStepCount, setCurrentStepCount] = useState<number>(0);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [historicalSteps, setHistoricalSteps] = useState<{ date: string; steps: number }[]>([]);

  const colorScheme = useColorScheme();
  const backgroundColor = colorScheme === 'dark' ? '#121212' : '#FFFFFF';
  const textColor = colorScheme === 'dark' ? '#FFFFFF' : '#000000';
  const cardBackground = colorScheme === 'dark' ? '#1E1E1E' : '#F8F8F8';

  // Initialize step counter with the user's data
  const initializeStepCounter = useCallback(async (uid: string) => {
    try {
      console.log('Initializing step counter for user:', uid);
      
      stepCounter.setUserId(uid);
      
      const userDocRef = doc(db, 'users', uid);
      const docSnap = await getDoc(userDocRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('Loaded user data from Firestore:', data);
        setCurrentStepCount(data.stepCount || 0);
      } else {
        console.log('Creating new user document');
        await setDoc(userDocRef, { 
          email: auth.currentUser?.email, 
          stepCount: 0, 
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        });
        setCurrentStepCount(0);
      }
      
      await loadHistoricalSteps(uid);
      
      if (!stepCounter.pedometerSubscription) {
        await stepCounter.start();
        console.log('Step counter started');
      }
      
      setIsInitialized(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to initialize step counter:', err);
      setError(`Failed to initialize step counter: ${errorMessage}`);
    }
  }, []);

  // Load historical step data from Firestore
  const loadHistoricalSteps = async (uid: string) => {
    try {
      const stepsCollection = collection(db, 'users', uid, 'step_data'); // Updated to correct collection name
      const q = query(stepsCollection, orderBy('date', 'asc'));
      const querySnapshot = await getDocs(q);
      
      const stepsData: { date: string; steps: number }[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('Fetched step data:', data); // Debug log
        stepsData.push({
          date: data.date,
          steps: data.steps || 0,
        });
      });
      
      if (stepsData.length === 0) {
        console.log('No historical step data found for user:', uid);
        // Initialize with empty data for the last 7 days if none exists
        const today = new Date();
        const emptyData = Array.from({ length: 7 }, (_, i) => {
          const date = new Date(today);
          date.setDate(today.getDate() - (6 - i));
          return {
            date: date.toISOString().split('T')[0], // Format: YYYY-MM-DD
            steps: 0,
          };
        });
        setHistoricalSteps(emptyData);
      } else {
        const last7Days = stepsData.slice(-7);
        setHistoricalSteps(last7Days);
        console.log('Loaded historical steps:', last7Days);
      }
    } catch (err) {
      console.error('Failed to load historical steps:', err);
      setError('Failed to load historical step data');
    }
  };

  // Handle user authentication state changes
  useEffect(() => {
    console.log('Setting up authentication listener');
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log('User authenticated:', user.uid);
        setUserId(user.uid);
        await initializeStepCounter(user.uid);
      } else {
        console.log('User logged out or not authenticated');
        setUserId(null);
        setCurrentStepCount(0);
        setIsInitialized(false);
        setHistoricalSteps([]);
        
        if (stepCounter.pedometerSubscription) {
          stepCounter.stop();
          console.log('Step counter stopped');
        }
      }
    });

    return () => {
      console.log('Cleaning up authentication listener');
      unsubscribeAuth();
      if (stepCounter.pedometerSubscription) {
        stepCounter.stop();
      }
    };
  }, [initializeStepCounter]);

  // Subscribe to step counter updates and Firestore changes
  useEffect(() => {
    if (!userId || !isInitialized) return;

    console.log('Setting up step counter and Firestore listeners');
    
    const stepCounterUnsubscribe = stepCounter.subscribe((steps: number) => {
      console.log('Step counter update received:', steps);
      setCurrentStepCount(steps);
    });

    const firestoreUnsubscribe = onSnapshot(doc(db, 'users', userId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('Firestore sync update:', data.stepCount);
        if (data.stepCount > currentStepCount) {
          setCurrentStepCount(data.stepCount);
        }
      }
    }, (err) => {
      console.error('Firestore listen error:', err);
      setError('Failed to sync step count from Firestore');
    });

    const shakingInterval = setInterval(() => {
      setIsShaking(stepCounter.isShaking);
    }, 100);

    return () => {
      console.log('Cleaning up step counter and Firestore listeners');
      stepCounterUnsubscribe();
      firestoreUnsubscribe();
      clearInterval(shakingInterval);
    };
  }, [userId, isInitialized, currentStepCount]);

  // Force save data before component unmounts
  useEffect(() => {
    return () => {
      if (userId && stepCounter.currentStepCount > 0) {
        console.log('Saving step data on component unmount');
        stepCounter.saveData();
      }
    };
  }, [userId]);

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

  // Chart configuration
  const chartData = {
    labels: historicalSteps.map((item) => item.date.split('-').slice(1).join('/')), // Format: MM/DD
    datasets: [
      {
        data: historicalSteps.map((item) => item.steps),
        color: () => colorScheme === 'dark' ? '#00C4B4' : '#007AFF', // Line color
        strokeWidth: 2,
      },
    ],
  };

  const chartConfig = {
    backgroundColor: cardBackground,
    backgroundGradientFrom: cardBackground,
    backgroundGradientTo: cardBackground,
    decimalPlaces: 0,
    color: () => textColor,
    labelColor: () => textColor,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: colorScheme === 'dark' ? '#00C4B4' : '#007AFF',
    },
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
                <ThemedText style={[styles.progressText, { color: textColor }]}>
                  Goal: 10,000 Steps
                </ThemedText>
              </ThemedView>

              {/* Historical Steps Chart */}
              <ThemedView style={[styles.chartCard, { backgroundColor: cardBackground }]}>
                <ThemedText style={[styles.cardTitle, { color: textColor }]}>Step History (Last 7 Days)</ThemedText>
                {historicalSteps.length > 0 ? (
                  <LineChart
                    data={chartData}
                    width={Dimensions.get('window').width * 0.85} // Responsive width
                    height={220}
                    yAxisSuffix=" steps"
                    chartConfig={chartConfig}
                    bezier
                    style={{
                      marginVertical: 8,
                      borderRadius: 16,
                    }}
                  />
                ) : (
                  <ThemedText style={[styles.noDataText, { color: textColor }]}>
                    No step history available.
                  </ThemedText>
                )}
              </ThemedView>

              <View style={styles.metricsRow}>
                
              </View>
            </View>
          </View>
        )}
      </ThemedView>
    </SafeAreaView>
=======
// E:\Stryde\app\(tabs)\index.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';

interface GoalData {
  goalId: string;
  started: boolean;
  startDate: string;
  longestStreak?: number;
  userId: string;
  stepCount?: number;
  milestones?: string[];
}

interface GoalItemProps {
  goalId: string;
  title: string;
  image: any;
  goalStatus: { stepCount: number; milestones: string[] } | null;
}

const GoalItem = ({ goalId, title, image, goalStatus }: GoalItemProps) => {
  const router = useRouter();

  const handleTrack = () => {
    router.push(`./goal/${goalId}`);
  };

  return (
    <View style={styles.goalItem}>
      <Image source={image} style={styles.icon} />
      <View style={styles.textContainer}>
        <Text style={styles.goalText}>{title}</Text>
        {goalStatus && (
          <Text style={styles.goalStatus}>
            Steps: {goalStatus.stepCount} | Milestones: {goalStatus.milestones.join(', ') || 'None'}
          </Text>
        )}
        <TouchableOpacity style={styles.trackButton} onPress={handleTrack}>
          <Text style={styles.trackText}>Track</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function Index() {
  const [startedGoals, setStartedGoals] = useState<GoalData[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
        setStartedGoals([]);
        router.push('/(auth)/login');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchStartedGoals = async () => {
      if (!userId) return;

      try {
        const goalsQuery = query(
          collection(db, 'goals'),
          where('userId', '==', userId),
          where('started', '==', true)
        );
        const querySnapshot = await getDocs(goalsQuery);
        const goalsData: GoalData[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data() as GoalData;
          const goalId = doc.id.split('_')[1];
          goalsData.push({ ...data, goalId });
        });
        setStartedGoals(goalsData);
      } catch (error) {
        console.error('Error fetching data:', error);
        setStartedGoals([]);
      }
    };

    fetchStartedGoals();
  }, [userId]);

  const predefinedGoals = [
    { id: '1', title: 'Reduce 1 kg in 1 week', image: require('../../assets/scale.png') },
    { id: '2', title: 'Burn 500 calories daily', image: require('../../assets/fire.png') },
    { id: '3', title: 'Walk 10,000 steps daily', image: require('../../assets/shoes.png') },
    { id: '4', title: 'Run 5 km in under 30 minutes', image: require('../../assets/training.png') },
    { id: '5', title: 'Complete 50 push-ups daily', image: require('../../assets/push-up.png') },
    { id: '6', title: 'Lose 1 inch off waist in 2 weeks', image: require('../../assets/slim-body.png') },
    { id: '7', title: 'Drink 3 liters of water daily', image: require('../../assets/drop.png') },
    { id: '8', title: 'Cycle 20 km weekly', image: require('../../assets/school.png') },
    { id: '9', title: 'Do 30 minutes of yoga daily', image: require('../../assets/lotus.png') },
    { id: '10', title: 'Cut sugar intake by 50%', image: require('../../assets/diet.png') },
    { id: '11', title: 'Plank for 2 minutes daily', image: require('../../assets/plank.png') },
    { id: '12', title: 'Swim 500 meters weekly', image: require('../../assets/swimming.png') },
    { id: '13', title: 'Lift weights 3 times a week', image: require('../../assets/dumbbells.png') },
    { id: '14', title: 'Reduce 5% body fat in 1 month', image: require('../../assets/body.png') },
    { id: '15', title: 'Hike 10 km every weekend', image: require('../../assets/hiking.png') },
  ];

  const getGoalStatus = (goal: GoalData) => {
    return goal ? { stepCount: goal.stepCount || 0, milestones: goal.milestones || [] } : null;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Started Goals</Text>
      {startedGoals.length === 0 ? (
        <Text style={styles.noGoalsText}>No goals started yet.</Text>
      ) : (
        <FlatList
          data={startedGoals}
          renderItem={({ item }) => {
            const goal = predefinedGoals.find(g => g.id === item.goalId);
            if (!goal) return null;
            return (
              <GoalItem
                goalId={item.goalId}
                title={goal.title}
                image={goal.image}
                goalStatus={getGoalStatus(item)}
              />
            );
          }}
          keyExtractor={(item) => item.goalId}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
>>>>>>> 6668c50c021bad7c228fa3318f7b513b9eaefcf1
  );
}

const styles = StyleSheet.create({
<<<<<<< HEAD
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
  chartCard: {
    borderRadius: 16,
    padding: 15,
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
  noDataText: { fontSize: 16, textAlign: 'center', marginVertical: 10 },
=======
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#000',
    textAlign: 'center',
  },
  noGoalsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f9f9f9',
    padding: 50,
    borderRadius: 12,
    marginHorizontal: 5,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  icon: {
    width: 70,
    height: 70,
    resizeMode: 'contain',
    marginRight: 40,
    marginInlineStart: -25,
  },
  textContainer: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  goalText: {
    fontSize: 18,
    color: '#333',
    marginBottom: 5,
  },
  goalStatus: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  trackButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
    width: 85,
    height: 50,
    marginLeft: 20,
  },
  trackText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
>>>>>>> 6668c50c021bad7c228fa3318f7b513b9eaefcf1
});