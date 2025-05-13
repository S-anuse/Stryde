import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Alert, Modal } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { db, auth } from '../../firebase';
import { collection, query, where, orderBy, getDocs, setDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// Define the possible activity types
type ActivityType = 'Running' | 'Jogging' | 'Cycling' | 'Swimming' | 'Walking' | 'HIIT' | 'Yoga' | 'Weight Training' | 'Dancing' | 'Elliptical';

// Define the Entry interface for calorie entries
interface Entry {
  id: string;
  userId: string;
  goalId: string;
  activity: ActivityType;
  duration: number;
  intensity: 'low' | 'medium' | 'high';
  caloriesBurned: number;
  date: string;
  timestamp: Date;
}

// Calorie burning estimates for various activities (calories per minute)
const ACTIVITY_CALORIES: Record<ActivityType, number> = {
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

// Map activities to icons (using valid Ionicons names)
const ACTIVITY_ICONS: Record<ActivityType, keyof typeof Ionicons['glyphMap']> = {
  Running: 'person-sharp',
  Jogging: 'walk-sharp',
  Cycling: 'bicycle-sharp',
  Swimming: 'water-sharp',
  Walking: 'walk-sharp',
  HIIT: 'flame-sharp',
  Yoga: 'body-sharp',
  'Weight Training': 'barbell-sharp',
  Dancing: 'musical-notes-sharp',
  Elliptical: 'bicycle-sharp',
};

export default function DailyTracker() {
  const { id = '2' } = useLocalSearchParams();
  const router = useRouter();
  const userId = auth.currentUser?.uid || 'user123'; // Use authenticated user ID, fallback to 'user123'

  const [dailyEntries, setDailyEntries] = useState<Entry[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | ''>('');
  const [duration, setDuration] = useState('');
  const [intensity, setIntensity] = useState<'low' | 'medium' | 'high'>('medium');
  const [totalCalories, setTotalCalories] = useState(0);
  const [goalPercentage, setGoalPercentage] = useState(0);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      if (!userId) {
        Alert.alert('Error', 'User not authenticated. Please log in.');
        return;
      }

      const today = new Date().toISOString().split('T')[0];
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
        // Validate that the activity is a valid ActivityType
        const activity = data.activity as ActivityType;
        if (Object.keys(ACTIVITY_CALORIES).includes(activity)) {
          entries.push({
            id: doc.id,
            userId: data.userId,
            goalId: data.goalId,
            activity,
            duration: data.duration,
            intensity: data.intensity,
            caloriesBurned: data.caloriesBurned,
            date: data.date,
            timestamp: data.timestamp.toDate(),
          });
          dailyTotal += data.caloriesBurned;
        }
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

    if (!userId) {
      Alert.alert('Error', 'User not authenticated. Please log in.');
      return;
    }

    const caloriesBurned = calculateCaloriesBurned();
    const today = new Date().toISOString().split('T')[0];
    const entryId = `${userId}_${id}_${Date.now()}`;

    try {
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
      loadEntries();
    } catch (error) {
      console.error('Error saving entry:', error);
      Alert.alert('Error', 'Failed to save your activity');
    }
  };

  const deleteEntry = async (entryId: string) => {
    try {
      await deleteDoc(doc(db, 'calorieEntries', entryId));
      loadEntries();
    } catch (error) {
      console.error('Error deleting entry:', error);
      Alert.alert('Error', 'Failed to delete entry');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <LinearGradient
        colors={['#FF6F61', '#FF8A65']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Daily Calorie Tracker</Text>
        <Text style={styles.subHeaderText}>Goal: Burn 500 Calories Daily</Text>
      </LinearGradient>

      <View style={styles.progressContainer}>
        <View style={styles.progressWrapper}>
          <LinearGradient
            colors={['#FF6F61', '#FF8A65']}
            style={[styles.progressBar, { width: `${goalPercentage}%` }]}
          />
        </View>
        <Text style={styles.progressText}>
          {totalCalories} / 500 Calories ({Math.round(goalPercentage)}%)
        </Text>
      </View>

      <Pressable style={styles.addButton} onPress={handleAddEntry}>
        <LinearGradient
          colors={['#FF6F61', '#FF8A65']}
          style={styles.addButtonGradient}
        >
          <Text style={styles.addButtonText}>Add Activity</Text>
        </LinearGradient>
      </Pressable>

      <View style={styles.entriesContainer}>
        <Text style={styles.entriesHeader}>Today's Activities</Text>

        {dailyEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="flame-outline" size={50} color="#FF6F61" style={styles.emptyStateIcon} />
            <Text style={styles.emptyStateText}>No activities logged today</Text>
            <Text style={styles.emptyStateSubText}>Add your first activity to start tracking!</Text>
          </View>
        ) : (
          dailyEntries.map((entry) => (
            <View key={entry.id} style={styles.entryItem}>
              <View style={styles.entryContent}>
                <View style={styles.entryHeader}>
                  <Ionicons
                    name={ACTIVITY_ICONS[entry.activity]}
                    size={24}
                    color="#FF6F61"
                    style={styles.entryIcon}
                  />
                  <Text style={styles.activityName}>{entry.activity}</Text>
                </View>
                <Text style={styles.entryDetails}>
                  {entry.duration} min • {entry.intensity.charAt(0).toUpperCase() + entry.intensity.slice(1)} intensity
                </Text>
                <Text style={styles.caloriesBurned}>{entry.caloriesBurned} Calories</Text>
              </View>
              <Pressable
                style={styles.deleteButton}
                onPress={() => deleteEntry(entry.id)}
              >
                <Ionicons name="close-circle" size={30} color="#FF5252" />
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
                  onPress={() => setSelectedActivity(activity as ActivityType)}
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
                Estimated Calories: {calculateCaloriesBurned()}
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
    backgroundColor: '#E6F0FA',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subHeaderText: {
    fontSize: 18,
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
    elevation: 3,
  },
  progressWrapper: {
    height: 20,
    backgroundColor: '#E0E0E0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 10,
  },
  progressText: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  addButton: {
    marginHorizontal: 16,
    marginTop: 0,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
  },
  addButtonGradient: {
    padding: 16,
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
    elevation: 3,
  },
  entriesHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyStateIcon: {
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
    backgroundColor: '#F9F9F9',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    minHeight: 80, // Ensure enough space
  },
  entryContent: {
    flex: 1,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  entryIcon: {
    marginRight: 8,
  },
  activityName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flexShrink: 1, // Allow text to wrap if needed
  },
  entryDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  caloriesBurned: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6F61',
    marginTop: 4,
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
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
    width: '90%', // You can adjust between 85-95% based on your preference
    maxWidth: 400, // Add maxWidth for larger screens
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
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
    backgroundColor: '#F9F9F9',
  },
  activitySelector: {
    marginBottom: 16,
    maxHeight: 100, // Limit height to prevent taking too much space
  },
  activityOption: {
    minWidth: 110, // Increased from 100 to 110
    paddingHorizontal: 15, // Increased from 12
    paddingVertical: 12, // Increased from 10
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    marginRight: 10, // Increased from 8
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50, // Fixed height for consistency
  },
  activityOptionSelected: {
    backgroundColor: '#FF6F61',
    borderColor: '#FF6F61',
  },
  activityOptionText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    flexShrink: 1, // Allow text to shrink if needed
  },
  activityOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  intensityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  intensityOption: {
    flex: 1,
    paddingVertical: 10,
    minWidth: 90, // Ensure enough space for "Medium"
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
  },
  intensityOptionSelected: {
    backgroundColor: '#FF6F61',
    borderColor: '#FF6F61',
  },
  intensityText: {
    fontSize: 14, // Keep readable size
    color: '#333',
  },
  intensityTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  caloriesCalculated: {
    backgroundColor: '#F5F5F5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  caloriesText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6F61',
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
    backgroundColor: '#F5F5F5',
    marginRight: 10,
  },
  saveButton: {
    backgroundColor: '#FF6F61',
    marginLeft: 10,
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});