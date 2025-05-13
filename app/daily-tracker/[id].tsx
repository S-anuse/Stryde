import React, { useState, useEffect } from 'react';
import { ScrollView, Text, StyleSheet, TouchableOpacity, Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, auth } from '../../firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function DailyTracker() {
  const { id } = useLocalSearchParams() as { id: string };
  const router = useRouter();
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [initialWeight, setInitialWeight] = useState<string | null>(null);
  const [weightsHistory, setWeightsHistory] = useState<{ [key: string]: number }>({});
  const [refresh, setRefresh] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
        router.push('/(auth)/login');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;

      try {
        const goalDocRef = doc(db, 'goals', `${userId}_${id}`);
        const goalDoc = await getDoc(goalDocRef);
        let initialWeightData: string | null = null;
        let history: { [key: string]: number } = {};

        if (goalDoc.exists()) {
          const goalData = goalDoc.data();
          initialWeightData = goalData.initialWeight?.toString() || null;

          const weightsRef = collection(db, 'goals', `${userId}_${id}`, 'dailyWeights');
          const weightsSnapshot = await getDocs(weightsRef);
          weightsSnapshot.forEach((doc) => {
            const day = doc.id;
            const weight = doc.data().weight;
            history[day] = weight;
          });
        } else {
          await setDoc(goalDocRef, {
            goalId: id,
            started: false,
            startDate: new Date().toISOString(),
            userId: userId,
          });
        }

        if (!initialWeightData) {
          initialWeightData = await AsyncStorage.getItem(`goal_${userId}_${id}_initialWeight`);
        }
        setInitialWeight(initialWeightData || 'Not set');

        const keys = await AsyncStorage.getAllKeys();
        const weightKeys = keys.filter(key => key.startsWith(`goal_${userId}_${id}_day_`) && key.endsWith('_weight'));
        const weights = await Promise.all(weightKeys.map(key => AsyncStorage.getItem(key).then(val => ({ day: key.split('_')[4], weight: parseFloat(val || '0') }))));
        const asyncStorageHistory = weights.reduce((acc, { day, weight }) => ({ ...acc, [day]: weight }), {});

        history = { ...asyncStorageHistory, ...history };
        setWeightsHistory(history);

        if (initialWeightData) {
          await AsyncStorage.setItem(`goal_${userId}_${id}_initialWeight`, initialWeightData);
        }
        for (const [day, weight] of Object.entries(history)) {
          await AsyncStorage.setItem(`goal_${userId}_${id}_day_${day}_weight`, weight.toString());
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, [id, refresh, userId]);

  const navigateToDay = (day: number) => {
    if (!userId) {
      Alert.alert('Error', 'Please log in to continue.');
      return;
    }

    const lastCompletedDay = Math.max(...Object.keys(weightsHistory).map(d => parseInt(d)).filter(d => !isNaN(d)), 0);
    if (day <= lastCompletedDay + 1 && day <= 7) {
      router.push(`/day-details/${id}/${day}?exerciseType=Indoor`);
    } else {
      Alert.alert('Locked', 'Complete the previous day to unlock this day.');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Daily Tracker</Text>
      <View style={styles.daysContainer}>
        {days.map((day) => {
          const lastCompletedDay = Math.max(...Object.keys(weightsHistory).map(d => parseInt(d)).filter(d => !isNaN(d)), 0);
          const isCompleted = weightsHistory[day.toString()] !== undefined && weightsHistory[day.toString()] !== 0;
          const isNextOrCompleted = day <= lastCompletedDay + 1 && day <= 7;
          const isClickable = isNextOrCompleted || isCompleted;
          return (
            <TouchableOpacity
              key={day}
              style={[styles.dayButton, !isClickable && styles.disabledButton]}
              onPress={() => navigateToDay(day)}
              disabled={!isClickable}
            >
              <Text style={[styles.dayButtonText, !isClickable && styles.disabledText]}>Day {day}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  dayButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 8,
    margin: 5,
    width: '30%',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#a9a9a9',
  },
  dayButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledText: {
    color: '#ddd',
  },
});