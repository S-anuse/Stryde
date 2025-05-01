import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Alert, Vibration } from 'react-native';
import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';

export default function MeditationGoal() {
  const [isMeditating, setIsMeditating] = useState(false);
  const [time, setTime] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [streak, setStreak] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const router = useRouter();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<LottieView>(null);
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    loadMeditationData();
  }, []);

  const loadMeditationData = async () => {
    if (!userId) {
      Alert.alert('Error', 'User not authenticated. Please log in.');
      return;
    }

    try {
      const goalRef = doc(db, 'users', userId, 'goals', '9');
      const goalDoc = await getDoc(goalRef);

      if (goalDoc.exists()) {
        const data = goalDoc.data();
        setStreak(data.streak || 0);
        setTotalSessions(data.totalSessions || 0);
      } else {
        await setDoc(goalRef, {
          streak: 0,
          totalSessions: 0,
          userId, // Add userId for clarity
        });
      }
    } catch (error) {
      console.error('Error loading meditation data:', error);
      Alert.alert('Error', 'Failed to load your meditation data');
    }
  };

  const startMeditation = () => {
    setIsMeditating(true);
    setTime(0);
    timerRef.current = setInterval(() => {
      setTime((prev) => prev + 1);
    }, 1000);

    if (animationRef.current) {
      animationRef.current.play();
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const stopMeditation = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      setIsMeditating(false);
      setModalVisible(true);

      if (time >= 600) { // 10 minutes in seconds
        Vibration.vibrate([0, 200, 100, 200]);
        saveMeditationData();
      }
    }
  };

  const saveMeditationData = async () => {
    if (!userId) {
      Alert.alert('Error', 'User not authenticated. Please log in.');
      return;
    }

    try {
      const goalRef = doc(db, 'users', userId, 'goals', '9');
      const goalDoc = await getDoc(goalRef);
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      let newStreak = streak;

      if (goalDoc.exists()) {
        const data = goalDoc.data();
        const lastSession = data.lastSession || '';
        if (lastSession !== today) {
          if (new Date(lastSession).getDate() === now.getDate() - 1) {
            newStreak += 1;
          } else {
            newStreak = 1;
          }
        }
      } else {
        newStreak = 1;
      }

      await updateDoc(goalRef, {
        streak: newStreak,
        totalSessions: totalSessions + 1,
        lastSession: today,
        userId,
      });

      setStreak(newStreak);
      setTotalSessions(totalSessions + 1);
    } catch (error) {
      console.error('Error saving meditation data:', error);
      Alert.alert('Error', 'Failed to save your meditation data');
    }
  };

  const resetProgress = async () => {
    if (!userId) {
      Alert.alert('Error', 'User not authenticated. Please log in.');
      return;
    }

    Alert.alert(
      'Reset Progress',
      'Are you sure you want to reset your meditation progress? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              const goalRef = doc(db, 'users', userId, 'goals', '9');
              await setDoc(goalRef, {
                streak: 0,
                totalSessions: 0,
                lastSession: '',
                userId,
              });

              setStreak(0);
              setTotalSessions(0);
              Alert.alert('Success', 'Your meditation progress has been reset.');
            } catch (error) {
              console.error('Error resetting progress:', error);
              Alert.alert('Error', 'Failed to reset your progress.');
            }
          },
        },
      ]
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Meditation Quest</Text>
      <Text style={styles.subtitle}>Goal: 10 minutes daily</Text>

      <View style={styles.timerContainer}>
        <Text style={styles.timerText}>{formatTime(time)}</Text>
        {isMeditating ? (
          <Pressable style={styles.stopButton} onPress={stopMeditation}>
            <Text style={styles.buttonText}>Stop</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.startButton} onPress={startMeditation}>
            <Text style={styles.buttonText}>Start</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.statLabel}>Streak: {streak} days</Text>
        <Text style={styles.statLabel}>Total Sessions: {totalSessions}</Text>
      </View>

      <LottieView
        ref={animationRef}
        source={require('../../assets/celebration.json')}
        style={styles.animation}
        autoPlay={false}
        loop
      />

      <Pressable style={styles.resetButton} onPress={resetProgress}>
        <Text style={styles.resetButtonText}>Reset Progress</Text>
      </Pressable>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Meditation Session</Text>
            <Text style={styles.modalText}>
              {time >= 600 ? 'Great job! You completed 10 minutes!' : 'Session ended.'}
            </Text>
            <Pressable style={styles.modalButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.modalButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  timerText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 20,
  },
  startButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    width: 150,
  },
  stopButton: {
    backgroundColor: '#f44336',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    width: 150,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statsContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  animation: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  resetButton: {
    backgroundColor: '#FF4D4D',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    width: 150,
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
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    width: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  modalText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});