import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Alert, Modal, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../../firebase';
import { collection, query, where, orderBy, getDocs, setDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'expo-router';

// Define the Entry interface for calorie entries
interface Entry {
  id: string;
  userId: string;
  goalId: string;
  activity: string;
  duration: number;
  intensity: 'low' | 'medium' | 'high';
  caloriesBurned: number;
  date: string;
  timestamp: Date;
}

// Calorie burning estimates for various activities (calories per minute)
const ACTIVITY_CALORIES = {
  Running: 10,
  Jogging: 8,
  Cycling: 7,
  Swimming: 9,
  Walking: 4,
  HIIT: 12,
  Yoga: 3,
  'Weight Training': 6,
  Dancing: 7,
  Elliptical: 8,
} as const;

export default function DailyTracker() {
  const { id = '2' } = useLocalSearchParams();
  const router = useRouter();
  const userId = 'user123'; // Replace with actual authentication

  const [dailyEntries, setDailyEntries] = useState<Entry[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<keyof typeof ACTIVITY_CALORIES | ''>('');
  const [duration, setDuration] = useState('');
  const [intensity, setIntensity] = useState<'low' | 'medium' | 'high'>('medium');
  const [initialActivity, setInitialActivity] = useState('');
  const [totalCalories, setTotalCalories] = useState(0);
  const [goalPercentage, setGoalPercentage] = useState(0);

  useEffect(() => {
    loadInitialActivity();
    loadEntries();
  }, []);

  const loadInitialActivity = async () => {
    try {
      const activity = await AsyncStorage.getItem(`goal_${id}_initialActivity`);
      if (activity) {
        setInitialActivity(activity);
      }
    } catch (error) {
      console.error('Error loading initial activity:', error);
    }
  };

  const loadEntries = async () => {
    try {
      // Get current date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];

      // Use Firebase JS SDK Firestore methods
      const entriesRef = collection(db, 'calorieEntries');
      const q = query(
        entriesRef,
        where('userId', '==', userId),
        where('goalId', '==', id),
        where('date', '==', today),
        orderBy('timestamp', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const entries: Entry[] = [];
      let dailyTotal = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        entries.push({
          id: doc.id,
          userId: data.userId,
          goalId: data.goalId,
          activity: data.activity,
          duration: data.duration,
          intensity: data.intensity,
          caloriesBurned: data.caloriesBurned,
          date: data.date,
          timestamp: data.timestamp.toDate(), // Convert Firebase Timestamp to Date
        });
        dailyTotal += data.caloriesBurned;
      });

      setDailyEntries(entries);
      setTotalCalories(dailyTotal);
      setGoalPercentage(Math.min((dailyTotal / 500) * 100, 100));
    } catch (error) {
      console.error('Error loading entries:', error);
      Alert.alert('Error', 'Failed to load your daily entries');
    }
  };

  const handleAddEntry = () => {
    setSelectedActivity('');
    setDuration('');
    setIntensity('medium');
    setModalVisible(true);
  };

  const calculateCaloriesBurned = () => {
    if (!selectedActivity || !duration || isNaN(parseInt(duration)) || parseInt(duration) <= 0) {
      return 0;
    }

    const baseCaloriesPerMinute = ACTIVITY_CALORIES[selectedActivity];
    const intensityMultiplier = intensity === 'low' ? 0.8 : intensity === 'high' ? 1.2 : 1;

    return Math.round(baseCaloriesPerMinute * parseInt(duration) * intensityMultiplier);
  };

  const saveEntry = async () => {
    if (!selectedActivity) {
      Alert.alert('Error', 'Please select an activity');
      return;
    }

    if (!duration || isNaN(parseInt(duration)) || parseInt(duration) <= 0) {
      Alert.alert('Error', 'Please enter a valid duration in minutes');
      return;
    }

    const caloriesBurned = calculateCaloriesBurned();
    const today = new Date().toISOString().split('T')[0];
    const entryId = `${userId}_${id}_${Date.now()}`;

    try {
      // Use Firebase JS SDK Firestore methods
      await setDoc(doc(db, 'calorieEntries', entryId), {
        userId,
        goalId: id,
        activity: selectedActivity,
        duration: parseInt(duration),
        intensity,
        caloriesBurned,
        date: today,
        timestamp: serverTimestamp(),
      });

      setModalVisible(false);
      loadEntries(); // Reload entries after adding a new one
    } catch (error) {
      console.error('Error saving entry:', error);
      Alert.alert('Error', 'Failed to save your activity');
    }
  };

  const deleteEntry = async (entryId: string) => {
    try {
      // Use Firebase JS SDK Firestore methods
      await deleteDoc(doc(db, 'calorieEntries', entryId));
      loadEntries(); // Reload entries after deletion
    } catch (error) {
      console.error('Error deleting entry:', error);
      Alert.alert('Error', 'Failed to delete entry');
    }
  };

  // ... (rest of the file remains unchanged)
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Daily Calorie Tracker</Text>
        <Text style={styles.subHeaderText}>Goal: Burn 500 Calories Daily</Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressWrapper}>
          <View style={[styles.progressBar, { width: `${goalPercentage}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {totalCalories} / 500 calories ({Math.round(goalPercentage)}%)
        </Text>
      </View>

      <Pressable style={styles.addButton} onPress={handleAddEntry}>
        <Text style={styles.addButtonText}>Add Activity</Text>
      </Pressable>

      <View style={styles.entriesContainer}>
        <Text style={styles.entriesHeader}>Today's Activities</Text>

        {dailyEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Image
              source={require('../../assets/fire.png')}
              style={styles.emptyStateImage}
              resizeMode="contain"
            />
            <Text style={styles.emptyStateText}>No activities logged today</Text>
            <Text style={styles.emptyStateSubText}>Add your first activity to start tracking!</Text>
          </View>
        ) : (
          dailyEntries.map((entry) => (
            <View key={entry.id} style={styles.entryItem}>
              <View style={styles.entryContent}>
                <Text style={styles.activityName}>{entry.activity}</Text>
                <Text style={styles.entryDetails}>
                  {entry.duration} min • {entry.intensity} intensity
                </Text>
                <Text style={styles.caloriesBurned}>{entry.caloriesBurned} calories</Text>
              </View>
              <Pressable
                style={styles.deleteButton}
                onPress={() => deleteEntry(entry.id)}
              >
                <Text style={styles.deleteButtonText}>×</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Activity</Text>

            <Text style={styles.inputLabel}>Activity Type</Text>
            <ScrollView style={styles.activitySelector} horizontal showsHorizontalScrollIndicator={false}>
              {Object.keys(ACTIVITY_CALORIES).map((activity) => (
                <Pressable
                  key={activity}
                  style={[
                    styles.activityOption,
                    selectedActivity === activity && styles.activityOptionSelected,
                  ]}
                  onPress={() => setSelectedActivity(activity as keyof typeof ACTIVITY_CALORIES)}
                >
                  <Text
                    style={[
                      styles.activityOptionText,
                      selectedActivity === activity && styles.activityOptionTextSelected,
                    ]}
                  >
                    {activity}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Duration (minutes)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={duration}
              onChangeText={setDuration}
              placeholder="e.g., 30"
            />

            <Text style={styles.inputLabel}>Intensity</Text>
            <View style={styles.intensityContainer}>
              {(['low', 'medium', 'high'] as const).map((level) => (
                <Pressable
                  key={level}
                  style={[
                    styles.intensityOption,
                    intensity === level && styles.intensityOptionSelected,
                  ]}
                  onPress={() => setIntensity(level)}
                >
                  <Text
                    style={[
                      styles.intensityText,
                      intensity === level && styles.intensityTextSelected,
                    ]}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.caloriesCalculated}>
              <Text style={styles.caloriesText}>
                Estimated calories: {calculateCaloriesBurned()}
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveEntry}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#FF7043',
    padding: 20,
    paddingTop: 40,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subHeaderText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginTop: 5,
  },
  progressContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  progressWrapper: {
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FF7043',
  },
  progressText: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: '#FF7043',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  entriesContainer: {
    margin: 16,
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    minHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  entriesHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyStateImage: {
    width: 80,
    height: 80,
    opacity: 0.5,
    marginBottom: 15,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#666',
  },
  emptyStateSubText: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
  },
  entryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 12,
  },
  entryContent: {
    flex: 1,
  },
  activityName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  entryDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  caloriesBurned: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FF7043',
    marginTop: 4,
  },
  deleteButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ff5252',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 20,
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
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  activitySelector: {
    flexDirection: 'row',
    marginBottom: 16,
    maxHeight: 50,
  },
  activityOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    marginRight: 10,
  },
  activityOptionSelected: {
    backgroundColor: '#FF7043',
    borderColor: '#FF7043',
  },
  activityOptionText: {
    fontSize: 14,
    color: '#333',
  },
  activityOptionTextSelected: {
    color: '#fff',
  },
  intensityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  intensityOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    marginHorizontal: 5,
    borderRadius: 8,
  },
  intensityOptionSelected: {
    backgroundColor: '#FF7043',
    borderColor: '#FF7043',
  },
  intensityText: {
    fontSize: 14,
    color: '#333',
  },
  intensityTextSelected: {
    color: '#fff',
  },
  caloriesCalculated: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  caloriesText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF7043',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    marginRight: 10,
  },
  saveButton: {
    backgroundColor: '#FF7043',
    marginLeft: 10,
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: 'bold',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});