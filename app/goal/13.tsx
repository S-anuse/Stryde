import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

// Define the type for goal details
interface GoalDetail {
  title: string;
  description: string;
  diet: {
    protein: string;
    carbs: string;
    fats: string;
    calories: string;
  };
  exercise: {
    duration: string;
    frequency: string;
    type: string;
  };
  disclaimer: string;
}

// Goal details data with typed keys
const goalDetails: Record<string, GoalDetail> = {
  '1': {
    title: 'Reduce 2 kg in 1 week',
    description: 'Losing 2 kg in one week is a challenging goal that requires careful planning. This is a general guideline—consult a nutritionist or doctor before starting.',
    diet: {
      protein: 'Increase protein intake to 1.6-2.2g per kg of body weight (e.g., 120-160g for a 75kg person) from sources like chicken, eggs, or lentils.',
      carbs: 'Reduce carbs to 100-150g daily, focusing on whole grains and vegetables.',
      fats: 'Limit fats to 20-30% of daily calories (e.g., 40-60g) from healthy sources like nuts or olive oil.',
      calories: 'Aim for a 500-1000 calorie deficit daily (e.g., 1200-1500 calories total for women, 1500-1800 for men, depending on activity level).',
    },
    exercise: {
      duration: 'At least 60-90 minutes daily of moderate to high-intensity cardio (e.g., running, cycling).',
      frequency: '5-6 days per week.',
      type: 'Combine cardio (e.g., jogging) with strength training (e.g., bodyweight exercises) to preserve muscle.',
    },
    disclaimer: 'Warning: Rapid weight loss can be unhealthy. Seek professional guidance to avoid risks like muscle loss or dehydration.',
  },
  // Add more goal details here later (e.g., '2', '3', etc.)
};

export default function GoalDetails() {
  const { id } = useLocalSearchParams(); // Get the id from the URL

  // Safely access goal details with type checking
  const goal = id ? goalDetails[id as string] : goalDetails['1'];

  if (!goal) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Goal Not Found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{goal.title}</Text>
      <Text style={styles.description}>{goal.description}</Text>
      <Text style={styles.sectionTitle}>Diet Recommendations:</Text>
      <Text style={styles.detail}>• Protein: {goal.diet.protein}</Text>
      <Text style={styles.detail}>• Carbs: {goal.diet.carbs}</Text>
      <Text style={styles.detail}>• Fats: {goal.diet.fats}</Text>
      <Text style={styles.detail}>• Calories: {goal.diet.calories}</Text>
      <Text style={styles.sectionTitle}>Exercise Recommendations:</Text>
      <Text style={styles.detail}>• Duration: {goal.exercise.duration}</Text>
      <Text style={styles.detail}>• Frequency: {goal.exercise.frequency}</Text>
      <Text style={styles.detail}>• Type: {goal.exercise.type}</Text>
      <Text style={styles.disclaimer}>{goal.disclaimer}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000',
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    color: '#000',
  },
  detail: {
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
    marginBottom: 5,
  },
  disclaimer: {
    fontSize: 14,
    color: '#d32f2f',
    marginTop: 15,
    textAlign: 'center',
  },
});