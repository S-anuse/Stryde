import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { goalDetails } from '@constants/goalDetails';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth } from '../../firebase'; // Added Firebase Auth import

export default function GoalDetails() {
  const { id = '2' } = useLocalSearchParams();
  const router = useRouter();
  const goal = goalDetails[id as keyof typeof goalDetails] ?? goalDetails['2'];
  const userId = auth.currentUser?.uid; // Get the authenticated user ID

  const [isGoalStarted, setIsGoalStarted] = useState(false);

  useEffect(() => {
    const checkGoalStatus = async () => {
      try {
        if (!userId) return;
        const startedData = await AsyncStorage.getItem(`goal_${userId}_${id}_started`);
        if (startedData) {
          const { started } = JSON.parse(startedData);
          setIsGoalStarted(started);
        }
      } catch (error) {
        console.error('Error checking goal status:', error);
      }
    };
    checkGoalStatus();
  }, [id, userId]);

  const handleStart = async () => {
    if (!userId) {
      Alert.alert('Error', 'User not authenticated. Please log in.');
      return;
    }

    const goalId = id || '2';
    try {
      // Removed the initialActivity requirement
      await AsyncStorage.setItem(`goal_${userId}_${goalId}_started`, JSON.stringify({ started: true, startDate: new Date().toISOString() }));

      await setDoc(doc(db, 'goals', `${userId}_${goalId}`), {
        goalId,
        started: true,
        startDate: new Date().toISOString(),
        timestamp: new Date(),
        userId,
      });

      setIsGoalStarted(true);
      router.push(`/daily-tracker/${goalId}`);
    } catch (error) {
      console.error('Error starting goal:', error);
      Alert.alert('Error', 'Failed to start goal. Please try again.');
    }
  };

  const handleResume = () => {
    router.push(`/daily-tracker/${id}`);
  };

  const handleStop = () => {
    if (!userId) {
      Alert.alert('Error', 'User not authenticated. Please log in.');
      return;
    }

    Alert.alert(
      'Confirm Stop',
      'Are you sure you want to stop this goal? All related data will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: async () => {
            try {
              const goalId = id || '2';
              
              await deleteDoc(doc(db, 'goals', `${userId}_${goalId}`));
              
              const keys = await AsyncStorage.getAllKeys();
              const goalKeys = keys.filter(key => key.startsWith(`goal_${userId}_${goalId}_`));
              await AsyncStorage.multiRemove(goalKeys);

              setIsGoalStarted(false);
              Alert.alert('Success', 'Goal stopped and all data deleted.');
            } catch (error) {
              console.error('Error stopping goal:', error);
              Alert.alert('Error', 'Failed to stop goal. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>{goal.title}</Text>
      </View>
      <Text style={styles.description}>{goal.description}</Text>
      <View style={styles.section}>
        <Image
          source={require('../../assets/fire.png')}
          style={styles.sectionImage}
          resizeMode="contain"
        />
        <Text style={styles.sectionTitle}>Recommended Activities:</Text>
        <View style={styles.detailContainer}>
          <Text style={styles.detail}>• <Text style={styles.highlight}>Running:</Text> {goal.activities?.running}</Text>
          <Text style={styles.detail}>• <Text style={styles.highlight}>Cycling:</Text> {goal.activities?.cycling}</Text>
          <Text style={styles.detail}>• <Text style={styles.highlight}>Swimming:</Text> {goal.activities?.swimming}</Text>
          <Text style={styles.detail}>• <Text style={styles.highlight}>HIIT Workouts:</Text> {goal.activities?.hiit}</Text>
        </View>
      </View>
      <View style={styles.section}>
        <Image
          source={require('../../assets/dish.png')}
          style={styles.sectionImage}
          resizeMode="contain"
        />
        <Text style={styles.sectionTitle}>Nutrition Support:</Text>
        <View style={styles.detailContainer}>
          <Text style={styles.detail}>• <Text style={styles.highlight}>Pre-workout:</Text> {goal.nutrition?.preworkout}</Text>
          <Text style={styles.detail}>• <Text style={styles.highlight}>Post-workout:</Text> {goal.nutrition?.postworkout}</Text>
          <Text style={styles.detail}>• <Text style={styles.highlight}>Hydration:</Text> {goal.nutrition?.hydration}</Text>
        </View>
      </View>
      {isGoalStarted ? (
        <>
          <Pressable style={[styles.startButton, styles.resumeButton]} onPress={handleResume}>
            <Text style={styles.startButtonText}>Resume</Text>
          </Pressable>
          <Pressable style={[styles.startButton, styles.stopButton]} onPress={handleStop}>
            <Text style={styles.startButtonText}>Stop</Text>
          </Pressable>
        </>
      ) : (
        <Pressable style={styles.startButton} onPress={handleStart}>
          <Text style={styles.startButtonText}>Start</Text>
        </Pressable>
      )}
      <View style={styles.disclaimerContainer}>
        <Text style={styles.disclaimer}>{goal.disclaimer}</Text>
      </View>
    </ScrollView>
  );
}

// Styles remain unchanged
const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 16,
  },
  header: {
    backgroundColor: '#FF7043',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    minHeight: 200,
  },
  sectionImage: {
    width: 80,
    height: 80,
    alignSelf: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  detailContainer: {
    paddingLeft: 10,
  },
  detail: {
    fontSize: 16,
    color: '#444',
    marginBottom: 8,
    lineHeight: 22,
  },
  highlight: {
    fontWeight: 'bold',
    color: '#FF7043',
  },
  disclaimerContainer: {
    backgroundColor: '#ffebee',
    borderRadius: 12,
    padding: 15,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  disclaimer: {
    fontSize: 14,
    color: '#d32f2f',
    textAlign: 'center',
    lineHeight: 20,
  },
  startButton: {
    backgroundColor: '#FF7043',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 10,
  },
  resumeButton: {
    backgroundColor: 'rgba(121, 189, 226, 0.5)',
  },
  stopButton: {
    backgroundColor: 'rgba(240, 15, 15, 0.76)',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});