import React, { useEffect, useState } from 'react';
import { ScrollView, Text, StyleSheet, TextInput, TouchableOpacity, Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { goalDetails } from '@constants/goalDetails';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Href } from 'expo-router';

export default function DayDetails() {
  const { id, day } = useLocalSearchParams() as { id: string; day: string };
  const [currentWeight, setCurrentWeight] = useState<string>('');
  const [initialWeight, setInitialWeight] = useState<number | null>(null);
  const [weightsHistory, setWeightsHistory] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const initialWeightData = await AsyncStorage.getItem(`goal_${id}_initialWeight`);
        if (initialWeightData) {
          const parsedInitialWeight = parseFloat(initialWeightData);
          if (!isNaN(parsedInitialWeight)) {
            setInitialWeight(parsedInitialWeight);
          }
        }

        const keys = await AsyncStorage.getAllKeys();
        const weightKeys = keys.filter(key =>
          typeof key === 'string' &&
          key.startsWith(`goal_${id}_day_`) &&
          key.endsWith('_weight')
        );
        console.log('weightKeys:', weightKeys);

        const weights = await Promise.all(weightKeys.map(async key => {
          try {
            const val = await AsyncStorage.getItem(key);
            const numVal = typeof val === 'string' ? parseFloat(val) : NaN;
            return {
              day: key.split('_')[3] || '0',
              weight: typeof numVal === 'number' && !isNaN(numVal) ? numVal : 0
            };
          } catch (e) {
            return { day: '0', weight: 0 };
          }
        }));

        const history = weights.reduce<Record<string, number>>((acc, { day, weight }) => {
          if (typeof day === 'string' && typeof weight === 'number') {
            return { ...acc, [day]: weight };
          }
          return acc;
        }, {});
        console.log('weightsHistory:', history);

        setWeightsHistory(history);

        const savedWeightForDay = history[day] ? history[day].toString() : '';
        setCurrentWeight(savedWeightForDay);
      } catch (error) {
        console.error('Error fetching data:', error);
        Alert.alert('Error', 'Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, day]);

  if (loading) {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Loading...</Text>
      </ScrollView>
    );
  }

  const effectiveWeight = currentWeight ? parseFloat(currentWeight) : (initialWeight || 55);
  const dayNumber = day ? parseInt(day, 10) : 1;

  const goal = id && goalDetails[id as keyof typeof goalDetails] ? goalDetails[id as keyof typeof goalDetails] : null;

  if (!id || !goal || !goal.dailyPlan || isNaN(dayNumber)) {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Goal or Day Not Found (id: {id}, day: {day})</Text>
      </ScrollView>
    );
  }

  const dayPlan = goal.dailyPlan.find((d) => d.day === dayNumber) || goal.dailyPlan[0];

  const totalWeightLossGoal = 1;
  const baseCaloriesToBurn = 1100;
  const dietCalories = parseInt(dayPlan.diet.totalCalories) || 1300;
  const initialDailyWeightLoss = totalWeightLossGoal / 7;

  const previousWeights = Object.entries(weightsHistory)
    .filter(([d]) => parseInt(d) < dayNumber)
    .map(([d, w]) => ({ day: parseInt(d), weight: w }))
    .sort((a, b) => a.day - b.day);

  const latestPreviousWeight = previousWeights.length > 0
    ? previousWeights[previousWeights.length - 1].weight
    : initialWeight || 55;

  const totalWeightLost = initialWeight ? initialWeight - latestPreviousWeight : 0;
  const completedDays = dayNumber - 1;
  const remainingDays = 7 - completedDays;

  let adjustedDailyWeightLoss = initialDailyWeightLoss;
  let adjustedDailyCalories = baseCaloriesToBurn + dietCalories;

  if (initialWeight && remainingDays > 0) {
    const remainingWeightLoss = Math.max(0, totalWeightLossGoal - totalWeightLost);
    adjustedDailyWeightLoss = remainingWeightLoss / remainingDays;
    adjustedDailyCalories = Math.round(adjustedDailyWeightLoss * 7700) + dietCalories;
  } else {
    adjustedDailyWeightLoss = 0;
    adjustedDailyCalories = dietCalories;
  }

  console.log('initialWeight:', initialWeight);
  console.log('totalWeightLost:', totalWeightLost);
  console.log('adjustedDailyWeightLoss:', adjustedDailyWeightLoss);

  const suggestExercisePlan = (calories: number) => {
    const exercises = [
      { name: 'Running (10-12 km/h)', caloriesPerHour: 900, durationMin: 75 },
      { name: 'Cycling (20-25 km/h)', caloriesPerHour: 700, durationMin: 90 },
      { name: 'HIIT (30s sprint/30s rest)', caloriesPerHour: 800, durationMin: 80 },
    ];
    let remainingCalories = Math.round(calories - dietCalories);
    if (remainingCalories <= 0) return 'Goal achieved, no exercise needed';
    for (let activity of exercises) {
      if (remainingCalories >= activity.caloriesPerHour * (activity.durationMin / 60)) {
        return `${activity.durationMin / 60} hr ${activity.name} (~${Math.round(activity.caloriesPerHour * (activity.durationMin / 60))} kcal)`;
      }
    }
    return '1 hr HIIT (~800 kcal) + 15 min Running (~225 kcal)';
  };

  const exerciseSuggestion = suggestExercisePlan(adjustedDailyCalories);


const handleSaveWeight = async () => {
  if (!initialWeight && dayNumber !== 1) {
    Alert.alert('Error', 'Initial weight must be set on Day 1 before proceeding.');
    return;
  }

  if (!currentWeight || isNaN(parseFloat(currentWeight)) || parseFloat(currentWeight) <= 0) {
    Alert.alert('Error', 'Please enter a valid weight (e.g., 55.5)');
    return;
  }

  const weightNum = parseFloat(currentWeight);
  const weightChange = initialWeight ? initialWeight - weightNum : 0;

  if (initialWeight && weightChange < 0 && dayNumber > 1) {
    Alert.alert(
      'Weight Increase',
      'Your weight has increased. Do you want to adjust the goal or continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Adjust Goal',
          onPress: async () => {
            try {
              await AsyncStorage.setItem(`goal_${id}_day_${day}_weight`, currentWeight);
              setWeightsHistory(prev => ({ ...prev, [day]: weightNum }));
              Alert.alert('Success', 'Goal adjusted. Weight saved.');
              // Explicitly type the route as Href
              router.push(`/daily-tracker/${id}?refresh=true` as Href);
            } catch (error) {
              console.error('Error saving weight:', error);
              Alert.alert('Error', 'Failed to save weight. Please try again.');
            }
          },
        },
        {
          text: 'Continue',
          onPress: async () => {
            try {
              await AsyncStorage.setItem(`goal_${id}_day_${day}_weight`, currentWeight);
              setWeightsHistory(prev => ({ ...prev, [day]: weightNum }));
              Alert.alert('Warning', 'Weight saved, but progress may be affected.');
              // Explicitly type the route as Href
              router.push(`/daily-tracker/${id}?refresh=true` as Href);
            } catch (error) {
              console.error('Error saving weight:', error);
              Alert.alert('Error', 'Failed to save weight. Please try again.');
            }
          },
        },
      ]
    );
    return;
  }

  try {
    await AsyncStorage.setItem(`goal_${id}_day_${day}_weight`, currentWeight);
    if (!initialWeight && dayNumber === 1) {
      await AsyncStorage.setItem(`goal_${id}_initialWeight`, currentWeight);
      setInitialWeight(weightNum);
    }
    setWeightsHistory(prev => ({ ...prev, [day]: weightNum }));
    console.log(`Saved weight ${currentWeight} for day ${day}`);
    Alert.alert('Success', 'Weight saved and targets updated!');
    // Explicitly type the route as Href
    router.push(`/daily-tracker/${id}?refresh=true` as Href);
  } catch (error) {
    console.error('Error saving weight:', error);
    Alert.alert('Error', 'Failed to save weight. Please try again.');
  }
};

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Day {day}</Text>
      <Text style={styles.targetText}>
        Today's Target: {adjustedDailyWeightLoss.toFixed(3)} kg, {Math.round(adjustedDailyCalories)} kcal
      </Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Diet Plan</Text>
        <Text style={styles.detail}>Breakfast: {dayPlan.diet.breakfast}</Text>
        <Text style={styles.detail}>Lunch: {dayPlan.diet.lunch}</Text>
        <Text style={styles.detail}>Dinner: {dayPlan.diet.dinner}</Text>
        <Text style={styles.detail}>Snacks: {dayPlan.diet.snacks}</Text>
        <Text style={styles.detail}>Total Calories: {dayPlan.diet.totalCalories}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Exercise Plan</Text>
        <Text style={styles.detail}>Suggested: {exerciseSuggestion}</Text>
        <Text style={styles.detail}>Base Duration: 1-1.5 hr</Text>
        <Text style={styles.detail}>Base Calories: 1100 kcal (deficit)</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Weight</Text>
        <TextInput
          style={styles.weightInput}
          placeholder="Enter weight (kg)"
          keyboardType="numeric"
          value={currentWeight}
          onChangeText={setCurrentWeight}
        />
        <TouchableOpacity style={styles.saveButton} onPress={handleSaveWeight}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fc',
    padding: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#333',
  },
  targetText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
    color: '#555',
  },
  section: {
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#222',
  },
  detail: {
    fontSize: 15,
    marginBottom: 6,
    color: '#444',
  },
  weightInput: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginTop: 8,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});