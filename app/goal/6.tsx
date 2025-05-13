import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Image,
  ScrollView,
  Pressable,
  Animated,
  Alert,
  Dimensions,
  FlatList,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { db, auth } from '../../firebase';
import { doc, setDoc, getDoc, collection, query, orderBy, getDocs } from 'firebase/firestore';

// Interface for history items
interface HistoryItem {
  id: string;
  date: string;
  measurement: number;
}

// Interface for exercise items
interface Exercise {
  id: string;
  title: string;
  thumbnail: any;
  duration: string;
  description: string;
  difficulty: string;
}

// Sample exercise data with more details
const exerciseData: Exercise[] = [
  {
    id: '1',
    title: 'Oblique Twists',
    thumbnail: require('../../assets/oblique-twists-thumbnail.png'),
    duration: '3 sets x 15 reps',
    description: 'Targets side abdominal muscles to trim waistline',
    difficulty: 'Beginner',
  },
  {
    id: '2',
    title: 'Plank Hip Dips',
    thumbnail: require('../../assets/plank-hip-dips-thumbnail.png'),
    duration: '3 sets x 12 reps each side',
    description: 'Works obliques and core stability',
    difficulty: 'Intermediate',
  },
  {
    id: '3',
    title: 'Russian Twists',
    thumbnail: require('../../assets/russian-twists-thumbnail.png'),
    duration: '3 sets x 20 reps',
    description: 'Engages entire core with rotational movement',
    difficulty: 'Intermediate',
  },
  {
    id: '4',
    title: 'Standing Side Crunches',
    thumbnail: require('../../assets/side-crunches-thumbnail.png'),
    duration: '3 sets x 15 reps each side',
    description: 'Targets love handles and obliques',
    difficulty: 'Beginner',
  },
];

export default function WaistlineVisualizer() {
  // State variables
  const [waistMeasurement, setWaistMeasurement] = useState('');
  const [initialWaist, setInitialWaist] = useState<number | null>(null);
  const [goalWaist, setGoalWaist] = useState<number | null>(null);
  const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'progress' | 'exercises'>('progress');

  // Animated values
  const beltScale = useRef(new Animated.Value(1)).current;
  const progressValue = useRef(new Animated.Value(0)).current;
  const silhouetteAnimation = useRef(new Animated.Value(0)).current;

  // Screen dimensions for responsive design
  const screenWidth = Dimensions.get('window').width;
  const user = auth.currentUser;

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };

  // Fetch user's waist data and history from Firebase
  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        try {
          setLoading(true);

          // Get current goal data
          const docRef = doc(db, 'users', user.uid, 'goals', 'waistline');
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            setInitialWaist(data.initialWaist || null);
            setWaistMeasurement(data.currentWaist?.toString() || '');

            // Set goal to lose 1 inch from initial measurement
            if (data.initialWaist) {
              setGoalWaist(data.initialWaist - 1);
            }

            // Animate based on progress
            if (data.initialWaist && data.currentWaist) {
              const progress = Math.min(1, Math.max(0, (data.initialWaist - data.currentWaist) / 1));
              animateProgress(progress);
            }
          }

          // Get measurement history
          const historyRef = collection(db, 'users', user.uid, 'waistlineHistory');
          const historyQuery = query(historyRef, orderBy('date', 'asc'));
          const historySnap = await getDocs(historyQuery);

          const historyItems: HistoryItem[] = [];
          historySnap.forEach(doc => {
            const historyData = doc.data();
            historyItems.push({
              date: historyData.date,
              measurement: historyData.measurement,
              id: doc.id,
            });
          });

          setHistoryData(historyItems);
          setLoading(false);
        } catch (error) {
          console.error('Error fetching waist data:', error);
          Alert.alert('Error', 'Failed to load waist data. Please try again.');
          setLoading(false);
        }
      };

      fetchData();
    }
  }, [user]);

  // Animate progress indicators
  const animateProgress = (progress: number) => {
    // Animate belt shrinking
    Animated.timing(beltScale, {
      toValue: 1 - progress * 0.15,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Animate progress bar
    Animated.timing(progressValue, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: false,
    }).start();

    // Animate silhouette transition
    Animated.timing(silhouetteAnimation, {
      toValue: progress,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  };

  // Handle waist measurement input and update Firebase
  const handleMeasurementSubmit = async () => {
    const currentWaist = parseFloat(waistMeasurement);
    if (isNaN(currentWaist) || currentWaist <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid waist measurement.');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to save measurements.');
      return;
    }

    try {
      setLoading(true);
      const timestamp = new Date().toISOString();
      const isFirstMeasurement = initialWaist === null;

      // Update current goal data
      const goalData = {
        currentWaist,
        initialWaist: isFirstMeasurement ? currentWaist : initialWaist,
        updatedAt: timestamp,
      };

      await setDoc(doc(db, 'users', user.uid, 'goals', 'waistline'), goalData, { merge: true });

      // Add to history collection
      await setDoc(doc(db, 'users', user.uid, 'waistlineHistory', timestamp), {
        measurement: currentWaist,
        date: timestamp,
      });

      // Update state
      if (isFirstMeasurement) {
        setInitialWaist(currentWaist);
        setGoalWaist(currentWaist - 1);
      }

      // Refresh history data
      const historyRef = collection(db, 'users', user.uid, 'waistlineHistory');
      const historyQuery = query(historyRef, orderBy('date', 'asc'));
      const historySnap = await getDocs(historyQuery);

      const historyItems: HistoryItem[] = [];
      historySnap.forEach(doc => {
        const historyData = doc.data();
        historyItems.push({
          date: historyData.date,
          measurement: historyData.measurement,
          id: doc.id,
        });
      });

      setHistoryData(historyItems);

      // Calculate and animate progress
      const progress = initialWaist ? Math.min(1, Math.max(0, (initialWaist - currentWaist) / 1)) : 0;
      animateProgress(progress);

      setLoading(false);
      Alert.alert('Success', 'Measurement saved! Keep up the good work!');
    } catch (error) {
      console.error('Error saving measurement:', error);
      Alert.alert('Error', 'Failed to save measurement. Please try again.');
      setLoading(false);
    }
  };

  // Calculate progress percentage
  const calculateProgress = (): number => {
    if (!initialWaist || !waistMeasurement) return 0;
    const currentWaist = parseFloat(waistMeasurement);
    if (isNaN(currentWaist)) return 0;

    return Math.min(100, Math.max(0, ((initialWaist - currentWaist) / 1) * 100));
  };

  // Prepare chart data
  const chartData = {
    labels: historyData.slice(-7).map(item => formatDate(item.date)),
    datasets: [
      {
        data: historyData.slice(-7).map(item => item.measurement),
        color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
        strokeWidth: 2,
      },
    ],
    legend: ['Waist Measurement (inches)'],
  };

  // Calculate days remaining based on current progress
  const calculateDaysRemaining = (): string => {
    const progress = calculateProgress() / 100;
    if (progress >= 1) return 'Goal achieved!';
    if (progress <= 0) return 'Start tracking to see estimate';

    // Rough estimate based on typical healthy weight loss rate
    const remainingPercentage = 1 - progress;
    const estimatedDays = Math.ceil(remainingPercentage * 30); // Assuming 30 days to lose 1 inch healthily
    return `~${estimatedDays} days to goal`;
  };

  // Exercise item renderer
  const renderExerciseItem = ({ item }: { item: Exercise }) => (
    <Pressable
      style={styles.exerciseCard}
      onPress={() => Alert.alert(item.title, `${item.description}\n\nDuration: ${item.duration}\nDifficulty: ${item.difficulty}`)}
    >
      <Image source={item.thumbnail} style={styles.exerciseImage} />
      <View style={styles.exerciseContent}>
        <Text style={styles.exerciseTitle}>{item.title}</Text>
        <Text style={styles.exerciseDuration}>{item.duration}</Text>
        <Text style={styles.exerciseDifficulty}>Difficulty: {item.difficulty}</Text>
      </View>
    </Pressable>
  );

  // Calculate silhouette scales for visualization
  const currentSilhouetteScale = {
    transform: [{ scale: 1 }],
  };

  const interpolatedScale = silhouetteAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.95],
  });

  const goalSilhouetteScale = {
    transform: [{ scale: interpolatedScale }],
    opacity: silhouetteAnimation.interpolate({
      inputRange: [0, 0.3, 1],
      outputRange: [0.3, 0.6, 1],
    }),
  };

  // Progress bar width calculation
  const progressBarWidth = progressValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Lose 1 Inch Off Waist</Text>

      {/* Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Starting</Text>
            <Text style={styles.statusValue}>{initialWaist ? `${initialWaist}"` : '--'}</Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Current</Text>
            <Text style={styles.statusValue}>{waistMeasurement ? `${waistMeasurement}"` : '--'}</Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Goal</Text>
            <Text style={styles.statusValue}>{goalWaist ? `${goalWaist}"` : '--'}</Text>
          </View>
        </View>

        {/* Days Remaining Estimate */}
        <Text style={styles.daysRemaining}>{calculateDaysRemaining()}</Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'progress' && styles.activeTab]}
          onPress={() => setActiveTab('progress')}
        >
          <Text style={[styles.tabText, activeTab === 'progress' && styles.activeTabText]}>Progress</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'exercises' && styles.activeTab]}
          onPress={() => setActiveTab('exercises')}
        >
          <Text style={[styles.tabText, activeTab === 'exercises' && styles.activeTabText]}>Exercises</Text>
        </Pressable>
      </View>

      {activeTab === 'progress' ? (
        <>
          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.subHeader}>Progress Toward Goal</Text>
              <Text style={styles.progressPercentage}>{calculateProgress().toFixed(0)}%</Text>
            </View>
            <View style={styles.progressBarContainer}>
              <Animated.View style={[styles.progressBarFill, { width: progressBarWidth }]} />
            </View>
          </View>

          {/* Body Silhouette and Goal Visualization */}
          <View style={styles.silhouetteContainer}>
            <Text style={styles.subHeader}>Body Transformation</Text>
            <View style={styles.silhouetteWrapper}>
              <View style={styles.silhouetteColumn}>
                <Animated.Image
                  source={require('../../assets/silhouette.png')}
                  style={[styles.silhouette, currentSilhouetteScale]}
                />
                <Text style={styles.silhouetteLabel}>Current</Text>
              </View>
              <View style={styles.silhouetteArrow}>
                <Text style={styles.arrowText}>➔</Text>
              </View>
              <View style={styles.silhouetteColumn}>
                <Animated.Image
                  source={require('../../assets/silhouette.png')}
                  style={[styles.silhouette, goalSilhouetteScale]}
                />
                <Text style={styles.silhouetteLabel}>Goal</Text>
              </View>
            </View>
          </View>

          {/* Shrinking Belt Visual */}
          <View style={styles.beltContainer}>
            <Text style={styles.subHeader}>Your Progress Belt</Text>
            <Animated.Image
              source={require('../../assets/belt.png')}
              style={[styles.belt, { transform: [{ scale: beltScale }] }]}
            />
          </View>

          {/* Measurement History Chart */}
          {historyData.length > 1 && (
            <View style={styles.chartContainer}>
              <Text style={styles.subHeader}>Measurement History</Text>
              <LineChart
                data={chartData}
                width={screenWidth - 40}
                height={220}
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: {
                    borderRadius: 16,
                  },
                  propsForDots: {
                    r: '6',
                    strokeWidth: '2',
                    stroke: '#4CAF50',
                  },
                }}
                bezier
                style={styles.chart}
              />
            </View>
          )}

          {/* Measurement Input */}
          <View style={styles.trackerContainer}>
            <Text style={styles.subHeader}>Enter Today's Measurement</Text>
            <TextInput
              style={styles.input}
              placeholder="Waist measurement in inches"
              keyboardType="numeric"
              value={waistMeasurement}
              onChangeText={setWaistMeasurement}
            />
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                { opacity: pressed ? 0.7 : 1 },
                loading && styles.disabledButton,
              ]}
              onPress={handleMeasurementSubmit}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>{loading ? 'Saving...' : 'Save Measurement'}</Text>
            </Pressable>
          </View>
        </>
      ) : (
        // Exercises Tab
        <View style={styles.exercisesContainer}>
          <Text style={styles.exerciseIntro}>
            These targeted exercises can help reduce inches from your waistline when combined with a calorie deficit diet.
          </Text>
          <FlatList
            data={exerciseData}
            renderItem={renderExerciseItem}
            keyExtractor={item => item.id}
            scrollEnabled={false} // Prevent nested scrolling issues
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  header: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  daysRemaining: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
    color: '#4CAF50',
    marginTop: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#4CAF50',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  subHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  progressSection: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressPercentage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  silhouetteContainer: {
    marginBottom: 24,
  },
  silhouetteWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  silhouetteColumn: {
    alignItems: 'center',
  },
  silhouette: {
    width: 120,
    height: 230,
    resizeMode: 'contain',
  },
  silhouetteLabel: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  silhouetteArrow: {
    paddingHorizontal: 10,
  },
  arrowText: {
    fontSize: 24,
    color: '#999',
  },
  beltContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  belt: {
    width: 180,
    height: 60,
    resizeMode: 'contain',
  },
  chartContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  trackerContainer: {
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#a5d6a7',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  exercisesContainer: {
    marginBottom: 24,
  },
  exerciseIntro: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    lineHeight: 22,
  },
  exerciseCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  exerciseImage: {
    width: 100,
    height: 100,
    resizeMode: 'cover',
  },
  exerciseContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  exerciseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  exerciseDuration: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  exerciseDifficulty: {
    fontSize: 13,
    color: '#4CAF50',
  },
});
