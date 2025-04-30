import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { DeviceMotion } from 'expo-sensors';
import LottieView from 'lottie-react-native';
import { LineChart } from 'react-native-chart-kit';
import * as Notifications from 'expo-notifications';

// Interfaces
interface Pose {
  name: string;
  duration: number;
  instructions: string;
}

interface YogaFlow {
  id: string;
  name: string;
  description: string;
  poses: Pose[];
}

interface Mood {
  id: string;
  name: string;
  emoji: string;
}

interface MoodHistoryEntry {
  date: string;
  mood: Mood;
}

// Predefined yoga flows
const YOGA_FLOWS: YogaFlow[] = [
  {
    id: 'morning_stretch',
    name: 'Morning Stretch',
    description: 'Gentle poses to wake up your body',
    poses: [
      { name: "Child's Pose", duration: 30, instructions: 'Kneel and sit back on heels, extending arms forward' },
      { name: 'Cat-Cow Stretch', duration: 60, instructions: 'Alternate between arching and rounding your back' },
      { name: 'Downward Dog', duration: 45, instructions: 'Form an inverted V with your body' },
      { name: 'Forward Fold', duration: 30, instructions: 'Bend forward from hips with straight back' },
      { name: 'Mountain Pose', duration: 30, instructions: 'Stand tall with feet together, hands at sides' },
      { name: 'Sun Salutation (3x)', duration: 180, instructions: 'Flow through the classic sequence' },
      { name: 'Warrior I', duration: 45, instructions: 'Front knee bent, back leg straight, arms up' },
      { name: 'Warrior II', duration: 45, instructions: 'Arms parallel to ground, gaze over front hand' },
      { name: 'Triangle Pose', duration: 30, instructions: 'Front leg straight, arm reaches down' },
      { name: 'Tree Pose', duration: 60, instructions: 'Balance on one leg, foot on inner thigh' },
      { name: 'Corpse Pose', duration: 180, instructions: 'Lie flat on your back, completely relaxed' },
    ],
  },
  {
    id: 'stress_relief',
    name: 'Stress Relief',
    description: 'Calming poses to release tension',
    poses: [
      { name: 'Easy Seat', duration: 60, instructions: 'Sit cross-legged with straight spine' },
      { name: 'Neck Rolls', duration: 30, instructions: 'Gently roll head in circles' },
      { name: 'Seated Forward Bend', duration: 45, instructions: 'Extend legs, fold forward from hips' },
      { name: 'Butterfly Pose', duration: 45, instructions: 'Soles of feet together, knees out' },
      { name: 'Supine Twist', duration: 60, instructions: 'Lie on back, twist lower body' },
      { name: 'Bridge Pose', duration: 45, instructions: 'Lie on back, lift hips with feet on floor' },
      { name: 'Legs Up The Wall', duration: 180, instructions: 'Lie with legs elevated against wall' },
      { name: 'Happy Baby', duration: 45, instructions: 'Hold feet with knees to chest' },
      { name: 'Reclining Bound Angle', duration: 60, instructions: 'Lie back with soles together, knees out' },
      { name: 'Corpse Pose', duration: 180, instructions: 'Complete relaxation on your back' },
    ],
  },
  {
    id: 'energizing_flow',
    name: 'Energizing Flow',
    description: 'Dynamic sequence to boost energy',
    poses: [
      { name: 'Mountain Pose', duration: 30, instructions: 'Stand tall, arms at sides' },
      { name: 'Sun Salutation A (3x)', duration: 180, instructions: 'Full sequence with breath' },
      { name: 'Chair Pose', duration: 30, instructions: 'Bend knees, arms overhead' },
      { name: 'Warrior I (Both Sides)', duration: 60, instructions: 'Lunge with back leg straight' },
      { name: 'Warrior II (Both Sides)', duration: 60, instructions: 'Open hips, arms extended' },
      { name: 'Reverse Warrior (Both Sides)', duration: 60, instructions: 'Back arm down, front arm up' },
      { name: 'Extended Side Angle (Both Sides)', duration: 60, instructions: 'Side bend with arm extended' },
      { name: 'Low Lunge Twist (Both Sides)', duration: 60, instructions: 'Twist torso in lunge position' },
      { name: 'Boat Pose', duration: 30, instructions: 'Balance on sit bones, lift legs' },
      { name: 'Plank to Chaturanga', duration: 60, instructions: 'Hold plank, lower halfway' },
      { name: 'Upward Dog', duration: 30, instructions: 'Lift chest forward and up' },
      { name: 'Downward Dog', duration: 45, instructions: 'Inverted V position' },
      { name: "Child's Pose", duration: 45, instructions: 'Rest with knees wide, arms extended' },
      { name: 'Corpse Pose', duration: 120, instructions: 'Final relaxation' },
    ],
  },
];

// Mood options
const MOODS: Mood[] = [
  { id: 'calm', name: 'Calm', emoji: '😌' },
  { id: 'energized', name: 'Energized', emoji: '⚡' },
  { id: 'relaxed', name: 'Relaxed', emoji: '😊' },
  { id: 'balanced', name: 'Balanced', emoji: '🧘' },
  { id: 'refreshed', name: 'Refreshed', emoji: '🌿' },
];

// Mindfulness insights
const MINDFULNESS_INSIGHTS: string[] = [
  'Notice the sensations in your body without judgment.',
  'Focus on your breath as an anchor to the present moment.',
  "You've practiced yoga for {streak} days! Try adding a gratitude meditation today.",
  'Remember that each pose is an opportunity to observe, not to achieve.',
  'The true measure of yoga is not how flexible your body is, but how flexible your mind becomes.',
  'Your {streak}-day streak shows your commitment. How can you bring this dedication to other areas?',
  'Today, try to carry the mindfulness from your mat into your daily activities.',
  "You're feeling {mood} today. Notice how your practice affects your state of mind.",
  'Consistency matters more than intensity. Your {streak}-day streak proves this.',
];

// Generate random insight with streak and mood substitution
const generateRandomInsight = (streak: number, mood: string): string => {
  const insight = MINDFULNESS_INSIGHTS[Math.floor(Math.random() * MINDFULNESS_INSIGHTS.length)];
  return insight.replace('{streak}', streak.toString()).replace('{mood}', mood.toLowerCase());
};

export default function YogaGoal() {
  const [selectedFlow, setSelectedFlow] = useState<YogaFlow | null>(null);
  const [currentPoseIndex, setCurrentPoseIndex] = useState<number>(0);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [sessionDuration, setSessionDuration] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [moodHistory, setMoodHistory] = useState<MoodHistoryEntry[]>([]);
  const [currentMood, setCurrentMood] = useState<Mood | null>(null);
  const [showMoodModal, setShowMoodModal] = useState<boolean>(false);
  const [showFlowSelectModal, setShowFlowSelectModal] = useState<boolean>(false);
  const [insight, setInsight] = useState<string>('');
  const [sessionCompleted, setSessionCompleted] = useState<boolean>(false);
  const [inactivityDetected, setInactivityDetected] = useState<boolean>(false);
  const animationRef = useRef<LottieView>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const userId = auth.currentUser?.uid;

  // Initialize yoga data
  useEffect(() => {
    loadYogaData();
    // Set up DeviceMotion listener for inactivity detection
    DeviceMotion.setUpdateInterval(1000);
    const subscription = DeviceMotion.addListener((motion) => {
      if (isSessionActive && !isPaused && motion.acceleration) {
        const { x, y, z } = motion.acceleration;
        const isInactive = Math.abs(x) < 0.1 && Math.abs(y) < 0.1 && Math.abs(z) < 0.1;
        setInactivityDetected(isInactive);
        if (isInactive) {
          setIsPaused(true);
          Notifications.scheduleNotificationAsync({
            content: {
              title: 'Yoga Session Paused',
              body: 'No movement detected. Resume when ready!',
            },
            trigger: null,
          });
        }
      }
    });

    return () => {
      subscription?.remove();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isSessionActive, isPaused]);

  // Load yoga data from Firestore
  const loadYogaData = async () => {
    if (!userId) return;

    try {
      const goalRef = doc(db, 'users', userId, 'goals', '9');
      const goalDoc = await getDoc(goalRef);

      if (goalDoc.exists()) {
        const data = goalDoc.data();
        setStreak(data.streak || 0);
        setMoodHistory(data.moodHistory || []);
        setInsight(data.lastInsight || generateRandomInsight(data.streak || 0, data.lastMood?.name || 'Calm'));
      } else {
        await setDoc(goalRef, {
          streak: 0,
          moodHistory: [],
          lastSession: null,
          lastMood: null,
          lastInsight: generateRandomInsight(0, 'Calm'),
        });
        setInsight(generateRandomInsight(0, 'Calm'));
      }
    } catch (error) {
      console.error('Error loading yoga data:', error);
      Alert.alert('Error', 'Failed to load yoga data');
    }
  };

  // Save yoga session to Firestore
  const saveYogaSession = async (duration: number, mood: Mood | null) => {
    if (!userId) return;

    try {
      const goalRef = doc(db, 'users', userId, 'goals', '9');
      const goalDoc = await getDoc(goalRef);

      const now = new Date();
      const today = now.toISOString().split('T')[0];

      let newStreak = streak;
      let newMoodHistory = [...moodHistory];
      let lastSessionDate = '';

      if (goalDoc.exists()) {
        const data = goalDoc.data();
        lastSessionDate = data.lastSession?.date || '';
        if (lastSessionDate !== today) {
          newStreak = streak + 1;
        }
      } else {
        newStreak = 1;
      }

      if (mood) {
        newMoodHistory.push({ date: today, mood });
      }

      // Limit mood history to last 7 days
      newMoodHistory = newMoodHistory.filter((entry: MoodHistoryEntry) => {
        const entryDate = new Date(entry.date);
        const daysDiff = (now.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 7;
      });

      const newInsight = generateRandomInsight(newStreak, mood?.name || 'Calm');

      await updateDoc(goalRef, {
        streak: newStreak,
        moodHistory: newMoodHistory,
        lastSession: { date: today, duration, flow: selectedFlow?.id || '' },
        lastMood: mood || null,
        lastInsight: newInsight,
      });

      setStreak(newStreak);
      setMoodHistory(newMoodHistory);
      setInsight(newInsight);
      setSessionCompleted(true);

      Notifications.scheduleNotificationAsync({
        content: {
          title: 'Yoga Session Completed!',
          body: `You completed a ${Math.floor(duration / 60)} minute session. Great job!`,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Error saving yoga session:', error);
      Alert.alert('Error', 'Failed to save yoga session');
    }
  };

  // Start yoga session
  const startSession = (flow: YogaFlow) => {
    setSelectedFlow(flow);
    setCurrentPoseIndex(0);
    setTimeRemaining(flow.poses[0].duration);
    setSessionDuration(0);
    setIsSessionActive(true);
    setIsPaused(false);
    setShowFlowSelectModal(false);
    startTimer(flow.poses[0].duration);
  };

  // Timer logic
  const startTimer = (duration: number) => {
    setTimeRemaining(duration);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          handlePoseCompletion();
          return 0;
        }
        setSessionDuration((prev) => prev + 1);
        return prev - 1;
      });
    }, 1000);
  };

  // Handle pose completion
  const handlePoseCompletion = () => {
    if (!selectedFlow) return;
    const nextPoseIndex = currentPoseIndex + 1;
    if (nextPoseIndex < selectedFlow.poses.length) {
      setCurrentPoseIndex(nextPoseIndex);
      setTimeRemaining(selectedFlow.poses[nextPoseIndex].duration);
      startTimer(selectedFlow.poses[nextPoseIndex].duration);
    } else {
      setIsSessionActive(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setShowMoodModal(true);
    }
  };

  // Pause/resume session
  const togglePause = () => {
    setIsPaused(!isPaused);
    if (!isPaused) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } else {
      startTimer(timeRemaining);
    }
  };

  // End session early
  const endSession = () => {
    setIsSessionActive(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setShowMoodModal(true);
  };

  // Reset session
  const resetSession = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setSelectedFlow(null);
    setCurrentPoseIndex(0);
    setIsSessionActive(false);
    setIsPaused(false);
    setTimeRemaining(0);
    setSessionDuration(0);
    setInactivityDetected(false);
    setShowMoodModal(false);
    setShowFlowSelectModal(false);
    setSessionCompleted(false);
    // Reload yoga data to refresh the UI
    loadYogaData();
  };

  // Handle mood selection
  const handleMoodSelection = (mood: Mood) => {
    setCurrentMood(mood);
    saveYogaSession(sessionDuration, mood);
    setShowMoodModal(false);
  };

  // Render mood trend graph
  const renderMoodGraph = () => {
    const moodCounts = MOODS.map((mood) => ({
      name: mood.name,
      count: moodHistory.filter((entry) => entry.mood.id === mood.id).length,
    }));

    const data = {
      labels: moodCounts.map((m) => m.name),
      datasets: [{ data: moodCounts.map((m) => m.count) }],
    };

    return (
      <View style={styles.graphContainer}>
        <Text style={styles.sectionTitle}>Mood Trends (Last 7 Days)</Text>
        <LineChart
          data={data}
          width={Dimensions.get('window').width - 40}
          height={220}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#f0f0f0',
            backgroundGradientTo: '#f0f0f0',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          }}
          bezier
          style={styles.chart}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!isSessionActive ? (
          <>
            <Text style={styles.title}>Zen Journey: Master Your Yoga Flow</Text>
            <Image source={require('../../assets/lotus.png')} style={styles.icon} />
            <Text style={styles.streak}>Streak: {streak} days</Text>
            <Text style={styles.insight}>{insight}</Text>

            <Pressable style={styles.button} onPress={() => setShowFlowSelectModal(true)}>
              <Text style={styles.buttonText}>Start Yoga Session</Text>
            </Pressable>

            {moodHistory.length > 0 && renderMoodGraph()}
          </>
        ) : selectedFlow ? (
          <View style={styles.sessionContainer}>
            <LottieView
              ref={animationRef}
              source={require('../../assets/water-drop.json')}
              autoPlay
              loop
              style={styles.animation}
            />
            <Text style={styles.sessionTitle}>{selectedFlow.name}</Text>
            <Text style={styles.poseName}>{selectedFlow.poses[currentPoseIndex].name}</Text>
            <Text style={styles.instructions}>{selectedFlow.poses[currentPoseIndex].instructions}</Text>
            <Text style={styles.timer}>
              {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
            </Text>
            <Text style={styles.sessionDuration}>
              Session Time: {Math.floor(sessionDuration / 60)}:{(sessionDuration % 60).toString().padStart(2, '0')}
            </Text>

            <View style={styles.sessionControls}>
              <Pressable style={styles.controlButton} onPress={togglePause}>
                <Text style={styles.buttonText}>{isPaused ? 'Resume' : 'Pause'}</Text>
              </Pressable>
              <Pressable style={styles.controlButton} onPress={endSession}>
                <Text style={styles.buttonText}>End Session</Text>
              </Pressable>
              <Pressable style={styles.controlButton} onPress={resetSession}>
                <Text style={styles.buttonText}>Reset</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Flow Selection Modal */}
      <Modal visible={showFlowSelectModal} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Choose Your Yoga Flow</Text>
          {YOGA_FLOWS.map((flow) => (
            <Pressable key={flow.id} style={styles.flowItem} onPress={() => startSession(flow)}>
              <Text style={styles.flowName}>{flow.name}</Text>
              <Text style={styles.flowDescription}>{flow.description}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.closeButton} onPress={() => setShowFlowSelectModal(false)}>
            <Text style={styles.buttonText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Mood Selection Modal */}
      <Modal visible={showMoodModal} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>How do you feel after your session?</Text>
          <View style={styles.moodContainer}>
            {MOODS.map((mood) => (
              <Pressable key={mood.id} style={styles.moodItem} onPress={() => handleMoodSelection(mood)}>
                <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                <Text style={styles.moodName}>{mood.name}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={styles.closeButton}
            onPress={() => {
              saveYogaSession(sessionDuration, null);
              setShowMoodModal(false);
            }}
          >
            <Text style={styles.buttonText}>Skip</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Session Completion Modal */}
      <Modal visible={sessionCompleted} animationType="slide">
        <View style={styles.modalContainer}>
          <LottieView
            source={require('../../assets/celebration.json')}
            autoPlay
            loop={false}
            style={styles.celebrationAnimation}
          />
          <Text style={styles.modalTitle}>Session Completed!</Text>
          <Text style={styles.completionText}>
            You completed a {Math.floor(sessionDuration / 60)} minute yoga session. Great job!
          </Text>
          <Pressable
            style={styles.closeButton}
            onPress={() => {
              setSessionCompleted(false);
              router.push('/(tabs)/goals');
            }}
          >
            <Text style={styles.buttonText}>Back to Goals</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  icon: {
    width: 100,
    height: 100,
    marginBottom: 10,
  },
  streak: {
    fontSize: 18,
    color: '#333',
    marginBottom: 10,
  },
  insight: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
    width: '80%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  graphContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  chart: {
    borderRadius: 10,
  },
  sessionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  animation: {
    width: 200,
    height: 200,
  },
  sessionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  poseName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
  },
  instructions: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  timer: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 10,
  },
  sessionDuration: {
    fontSize: 18,
    color: '#333',
    marginBottom: 20,
  },
  sessionControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
  },
  controlButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  flowItem: {
    padding: 15,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    marginVertical: 5,
    width: '100%',
    alignItems: 'center',
  },
  flowName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  flowDescription: {
    fontSize: 14,
    color: '#666',
  },
  moodContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  moodItem: {
    alignItems: 'center',
    margin: 10,
  },
  moodEmoji: {
    fontSize: 40,
  },
  moodName: {
    fontSize: 16,
    marginTop: 5,
  },
  closeButton: {
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    width: '80%',
    alignItems: 'center',
  },
  celebrationAnimation: {
    width: 200,
    height: 200,
  },
  completionText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
});