import React, { useState, useEffect } from 'react';
import { ScrollView, Text, StyleSheet, TouchableOpacity, Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DailyTracker() {
  const { id } = useLocalSearchParams() as { id: string };
  const router = useRouter();
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [initialWeight, setInitialWeight] = useState<string | null>(null);
  const [weightsHistory, setWeightsHistory] = useState<{ [key: string]: number }>({});
  const [refresh, setRefresh] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const weightData = await AsyncStorage.getItem(`goal_${id}_initialWeight`);
        setInitialWeight(weightData || 'Not set');

        const keys = await AsyncStorage.getAllKeys();
        const weightKeys = keys.filter(key => key.startsWith(`goal_${id}_day_`) && key.endsWith('_weight'));
        const weights = await Promise.all(weightKeys.map(key => AsyncStorage.getItem(key).then(val => ({ day: key.split('_')[3], weight: parseFloat(val || '0') }))));
        const history = weights.reduce((acc, { day, weight }) => ({ ...acc, [day]: weight }), {});
        console.log('weightsHistory:', history);
        setWeightsHistory(history);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, [id, refresh]);

  const navigateToDay = (day: number) => {
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