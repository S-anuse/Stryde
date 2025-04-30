import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Alert, Image, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import LottieView from 'lottie-react-native';
import { BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { Share } from 'react-native';

const TIERS = {
  BEGINNER: { name: 'Beginner', threshold: 10 },
  WARRIOR: { name: 'Warrior', threshold: 25 },
  LEGEND: { name: 'Legend', threshold: 50 },
};

const DAILY_CHALLENGES = [
  { id: 'speed_10', name: 'Do 10 push-ups in 20 seconds' },
  { id: 'plank_30', name: 'Hold a plank for 30 seconds after 25 push-ups' },
  { id: 'wide_15', name: 'Do 15 wide-grip push-ups' },
  { id: 'diamond_10', name: 'Do 10 diamond push-ups' },
  { id: 'elevated_10', name: 'Do 10 elevated push-ups' },
];

export default function PushUpGoal() {
  const [pushUps, setPushUps] = useState<number>(0);
  const [totalPushUps, setTotalPushUps] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [tier, setTier] = useState<string>(TIERS.BEGINNER.name);
  const [challenge, setChallenge] = useState(DAILY_CHALLENGES[0]);
  const [isChallengeCompleted, setIsChallengeCompleted] = useState<boolean>(false);
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [weeklyData, setWeeklyData] = useState<Array<{ day: string; count: number }>>([]);
  const router = useRouter();
  const animationRef = useRef<LottieView>(null);
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    loadPushUpData();
    generateDailyChallenge();
  }, []);

  useEffect(() => {
    if (totalPushUps >= TIERS.LEGEND.threshold) {
      setTier(TIERS.LEGEND.name);
    } else if (totalPushUps >= TIERS.WARRIOR.threshold) {
      setTier(TIERS.WARRIOR.name);
    } else {
      setTier(TIERS.BEGINNER.name);
    }
  }, [totalPushUps]);

  const loadPushUpData = async () => {
    if (!userId) return;

    try {
      const goalRef = doc(db, 'users', userId, 'goals', '5');
      const goalDoc = await getDoc(goalRef);

      if (goalDoc.exists()) {
        const data = goalDoc.data();
        setTotalPushUps(data.pushUps || 0);
        setStreak(data.streak || 0);
        setTier(data.tier || TIERS.BEGINNER.name);
        setIsChallengeCompleted(data.isChallengeCompleted || false);

        const weekData: Array<{ day: number; count: number; date?: string }> = data.dailyPushUps || [];
        const formattedData = formatWeeklyData(weekData);
        setWeeklyData(formattedData);
      } else {
        await setDoc(goalRef, {
          pushUps: 0,
          streak: 0,
          tier: TIERS.BEGINNER.name,
          isChallengeCompleted: false,
          dailyPushUps: [],
        });
      }
    } catch (error) {
      console.error('Error loading push-up data:', error);
      Alert.alert('Error', 'Failed to load your push-up data');
    }
  };

  const generateDailyChallenge = () => {
    const randomIndex = Math.floor(Math.random() * DAILY_CHALLENGES.length);
    setChallenge(DAILY_CHALLENGES[randomIndex]);
  };

  const formatWeeklyData = (dailyData: Array<{ day: number; count: number; date?: string }>) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date().getDay();

    let formattedData: Array<{ day: string; count: number }> = [];
    for (let i = 0; i < 7; i++) {
      const dayIndex = (today - 6 + i + 7) % 7;
      const dayName = days[dayIndex];
      const dayData = dailyData.find((d) => d.day === dayIndex) || { count: 0 };
      formattedData.push({
        day: dayName,
        count: Number(dayData.count) || 0,
      });
    }

    return formattedData;
  };

  const savePushUpData = async () => {
    if (!userId) return;

    try {
      const goalRef = doc(db, 'users', userId, 'goals', '5');
      const goalDoc = await getDoc(goalRef);

      const now = new Date();
      const today = now.getDay();
      const dateString = now.toISOString().split('T')[0];

      let dailyPushUps: Array<{ day: number; count: number; date: string }> = [];
      let lastLoggedDate = '';

      if (goalDoc.exists()) {
        const data = goalDoc.data();
        dailyPushUps = data.dailyPushUps || [];
        lastLoggedDate = data.lastLoggedDate || '';
      }

      const isNewDay = lastLoggedDate !== dateString;
      const newStreak = isNewDay ? streak + 1 : streak;

      const existingDayIndex = dailyPushUps.findIndex((d) => d.day === today);
      if (existingDayIndex >= 0) {
        dailyPushUps[existingDayIndex].count = totalPushUps;
      } else {
        dailyPushUps.push({ day: today, count: totalPushUps, date: dateString });
      }

      if (dailyPushUps.length > 7) {
        dailyPushUps = dailyPushUps.slice(-7);
      }

      await updateDoc(goalRef, {
        pushUps: totalPushUps,
        streak: newStreak,
        tier,
        isChallengeCompleted,
        lastLoggedDate: dateString,
        dailyPushUps,
      });

      setWeeklyData(formatWeeklyData(dailyPushUps));
      setStreak(newStreak);

      if (totalPushUps >= 50) {
        setIsModalVisible(true);
      }
    } catch (error) {
      console.error('Error saving push-up data:', error);
      Alert.alert('Error', 'Failed to save your push-up data');
    }
  };

  const handleStartTracking = () => {
    setIsTracking(true);

    let pushUpCount = 0;
    const interval = setInterval(() => {
      pushUpCount++;
      setPushUps(pushUpCount);

      if (pushUpCount >= 5) {
        clearInterval(interval);
        setIsTracking(false);
        handleLogPushUps(pushUpCount);
      }
    }, 1500);
  };

  const handleLogPushUps = (count: number | null) => {
    const newTotal = totalPushUps + (count || pushUps);
    setTotalPushUps(newTotal);
    setPushUps(0);
    savePushUpData();
  };

  const handleMarkChallengeComplete = () => {
    setIsChallengeCompleted(true);
    animationRef.current?.play();
    savePushUpData();
  };

  const handleShareAchievement = async () => {
    try {
      await Share.share({
        message: `Smashed 50 push-ups today with Stryde! 💪 #PushUpQuest`,
      });
    } catch (error) {
      Alert.alert('Error', 'Could not share your achievement');
    }
  };

  const handleResetProgress = async () => {
    if (!userId) return;

    Alert.alert(
      'Reset Progress',
      'Are you sure you want to reset all your push-up progress? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              const goalRef = doc(db, 'users', userId, 'goals', '5');
              await setDoc(goalRef, {
                pushUps: 0,
                streak: 0,
                tier: TIERS.BEGINNER.name,
                isChallengeCompleted: false,
                dailyPushUps: [],
                lastLoggedDate: '',
              });

              setPushUps(0);
              setTotalPushUps(0);
              setStreak(0);
              setTier(TIERS.BEGINNER.name);
              setIsChallengeCompleted(false);
              setWeeklyData(formatWeeklyData([]));
              generateDailyChallenge();

              Alert.alert('Success', 'Your push-up progress has been reset.');
            } catch (error) {
              console.error('Error resetting progress:', error);
              Alert.alert('Error', 'Failed to reset your progress.');
            }
          },
        },
      ]
    );
  };

  const getTierProgress = () => {
    if (tier === TIERS.LEGEND.name) return 100;
    if (tier === TIERS.WARRIOR.name) return (totalPushUps / TIERS.LEGEND.threshold) * 100;
    return (totalPushUps / TIERS.WARRIOR.threshold) * 100;
  };

  const chartData = {
    labels: weeklyData.length > 0 ? weeklyData.map((item) => item.day) : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    datasets: [
      {
        data: weeklyData.length > 0 ? weeklyData.map((item) => item.count) : [0, 0, 0, 0, 0, 0, 0],
      },
    ],
  };

  const chartConfig = {
    backgroundGradientFrom: '#f9f9f9',
    backgroundGradientTo: '#f9f9f9',
    decimalPlaces: 0,
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
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Image source={require('../../assets/push-up.png')} style={styles.headerImage} />
        <Text style={styles.title}>Push-Up Power Quest</Text>
      </View>

      <View style={styles.tierContainer}>
        <Text style={styles.tierTitle}>Current Tier: {tier}</Text>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${getTierProgress()}%` }]} />
        </View>
        <Text style={styles.streakText}>🔥 {streak} Day Streak</Text>
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>Today's Progress</Text>
        <Text style={styles.statsValue}>{totalPushUps} / 50 Push-ups</Text>
      </View>

      <View style={styles.challengeContainer}>
        <Text style={styles.challengeTitle}>Daily Challenge:</Text>
        <Text style={styles.challengeDescription}>{challenge.name}</Text>
        {!isChallengeCompleted ? (
          <Pressable style={styles.challengeButton} onPress={handleMarkChallengeComplete}>
            <Text style={styles.buttonText}>Mark Complete</Text>
          </Pressable>
        ) : (
          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>Challenge Completed! ✅</Text>
          </View>
        )}
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter push-up count"
          keyboardType="numeric"
          value={pushUps.toString()}
          onChangeText={(text) => setPushUps(parseInt(text.replace(/[^0-9]/g, '')) || 0)}
        />
        <Pressable style={styles.addButton} onPress={() => handleLogPushUps(pushUps)}>
          <Text style={styles.buttonText}>Log Push-ups</Text>
        </Pressable>
      </View>

      <Pressable style={styles.trackButton} onPress={handleStartTracking} disabled={isTracking}>
        <Text style={styles.buttonText}>{isTracking ? 'Tracking...' : 'Auto-track Push-ups'}</Text>
      </Pressable>

      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Weekly Progress</Text>
        <BarChart
          data={chartData}
          width={Dimensions.get('window').width - 32}
          height={220}
          chartConfig={chartConfig}
          verticalLabelRotation={0}
          fromZero
          showBarTops
          style={styles.chart}
          yAxisLabel=""
          yAxisSuffix=""
        />
      </View>

      <Pressable style={styles.resetButton} onPress={handleResetProgress}>
        <Text style={styles.resetButtonText}>Reset Progress</Text>
      </Pressable>

      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <LottieView
              ref={animationRef}
              source={require('../../assets/celebration.json')}
              autoPlay
              loop={false}
              style={styles.animation}
            />
            <Text style={styles.modalTitle}>Achievement Unlocked!</Text>
            <Text style={styles.modalText}>You've completed 50 push-ups today!</Text>
            <Pressable style={styles.shareButton} onPress={handleShareAchievement}>
              <Text style={styles.buttonText}>Share Achievement</Text>
            </Pressable>
            <Pressable style={styles.closeButton} onPress={() => setIsModalVisible(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerImage: {
    width: 50,
    height: 50,
    marginRight: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  tierContainer: {
    backgroundColor: '#f0f9f0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  tierTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  streakText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ff7043',
  },
  statsContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  statsTitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  statsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  challengeContainer: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  challengeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  challengeDescription: {
    fontSize: 16,
    color: '#555',
    marginBottom: 12,
  },
  challengeButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  completedBadge: {
    backgroundColor: '#e6f4ea',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  completedText: {
    color: '#34a853',
    fontSize: 16,
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  trackButton: {
    backgroundColor: '#FF9800',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  chartContainer: {
    marginVertical: 16,
    padding: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  chart: {
    borderRadius: 16,
    marginVertical: 8,
  },
  resetButton: {
    backgroundColor: '#FF4D4D',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    width: '80%',
  },
  animation: {
    width: 150,
    height: 150,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 10,
  },
  modalText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  shareButton: {
    backgroundColor: '#1DA1F2',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  closeButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    width: '100%',
  },
  closeButtonText: {
    color: '#666',
    fontSize: 16,
  },
});