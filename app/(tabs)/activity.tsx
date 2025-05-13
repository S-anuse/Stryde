import { StyleSheet, View, useColorScheme, TouchableOpacity, TextInput, Platform, Modal, Alert, ScrollView } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useEffect, useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, auth } from '../../firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import * as Notifications from 'expo-notifications';
import { Picker } from '@react-native-picker/picker';

// Define types for exercise plan
interface Exercise {
  id: string;
  day: string;
  name: string;
  duration: string;
  completed: boolean;
}

interface ExercisePlan {
  createdAt: string;
  notificationTime: string | null;
  exercises: Exercise[];
}

// Exercise templates by category
const exerciseTemplates = {
  cardio: [
    { name: 'Jogging', defaultDuration: '30 min' },
    { name: 'Cycling', defaultDuration: '30 min' },
    { name: 'Swimming', defaultDuration: '30 min' },
    { name: 'Walking', defaultDuration: '45 min' },
    { name: 'Jump Rope', defaultDuration: '15 min' },
    { name: 'Elliptical', defaultDuration: '25 min' },
    { name: 'Stair Climbing', defaultDuration: '20 min' },
    { name: 'Rowing', defaultDuration: '20 min' },
  ],
  strength: [
    { name: 'Push-ups', defaultDuration: '15 reps' },
    { name: 'Pull-ups', defaultDuration: '10 reps' },
    { name: 'Squats', defaultDuration: '20 reps' },
    { name: 'Lunges', defaultDuration: '20 reps' },
    { name: 'Planks', defaultDuration: '60 sec' },
    { name: 'Burpees', defaultDuration: '10 reps' },
    { name: 'Sit-ups', defaultDuration: '15 reps' },
    { name: 'Bench Press', defaultDuration: '3 sets x 10 reps' },
    { name: 'Deadlifts', defaultDuration: '3 sets x 8 reps' },
  ],
  flexibility: [
    { name: 'Yoga', defaultDuration: '20 min' },
    { name: 'Stretching', defaultDuration: '15 min' },
    { name: 'Pilates', defaultDuration: '30 min' },
    { name: 'Foam Rolling', defaultDuration: '10 min' },
    { name: 'Dynamic Stretching', defaultDuration: '10 min' },
  ],
  recovery: [
    { name: 'Rest Day', defaultDuration: 'Full day' },
    { name: 'Light Walking', defaultDuration: '20 min' },
    { name: 'Meditation', defaultDuration: '10 min' },
    { name: 'Gentle Yoga', defaultDuration: '15 min' },
  ]
};

export default function ExercisePlanScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [exercisePlan, setExercisePlan] = useState<ExercisePlan | null>(null);
  const [isTimePickerVisible, setTimePickerVisible] = useState(false);
  const [selectedHour, setSelectedHour] = useState(8); // Default to 8 AM
  const [selectedMinute, setSelectedMinute] = useState(0); // Default to 00 minutes
  const [error, setError] = useState<string | null>(null);
  
  // For setting exercise goals
  const [isExerciseModalVisible, setExerciseModalVisible] = useState(false);
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [selectedCategory, setSelectedCategory] = useState('cardio');
  const [selectedExercises, setSelectedExercises] = useState<{ name: string; duration: string }[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);

  const colorScheme = useColorScheme();
  const backgroundColor = colorScheme === 'dark' ? '#121212' : '#FFFFFF';
  const textColor = colorScheme === 'dark' ? '#FFFFFF' : '#000000';
  const cardBackground = colorScheme === 'dark' ? '#1E1E1E' : '#F8F8F8';
  const modalBackground = colorScheme === 'dark' ? '#202020' : '#F5F5F5';
  const inputBackground = colorScheme === 'dark' ? '#333333' : '#EFEFEF';

  // Request notification permissions
  useEffect(() => {
    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        setError('Notification permissions not granted');
      }
    };
    requestPermissions();
  }, []);

  // Handle authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        loadExercisePlan(user.uid);
      } else {
        setUserId(null);
        setExercisePlan(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load exercise plan
  const loadExercisePlan = useCallback(async (uid: string) => {
    try {
      const planRef = doc(db, 'users', uid, 'exercise_plan', 'current');
      const docSnap = await getDoc(planRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as ExercisePlan;
        setExercisePlan(data);
        if (data.notificationTime) {
          const [hours, minutes] = data.notificationTime.split(':').map(Number);
          setSelectedHour(hours);
          setSelectedMinute(minutes);
          scheduleNotifications(data.notificationTime);
        }
      } else {
        await createNewPlan(uid);
      }
    } catch (err) {
      setError('Failed to load exercise plan');
      console.error(err);
    }
  }, []);

  // Create a new empty exercise plan
  const createNewPlan = async (uid: string) => {
    const newPlan: ExercisePlan = {
      createdAt: new Date().toISOString(),
      notificationTime: null,
      exercises: [],
    };

    await setDoc(doc(db, 'users', uid, 'exercise_plan', 'current'), newPlan);
    setExercisePlan(newPlan);
  };

  // Toggle exercise completion
  const toggleExercise = async (exerciseId: string) => {
    if (!userId || !exercisePlan) return;

    const updatedExercises = exercisePlan.exercises.map((ex) =>
      ex.id === exerciseId ? { ...ex, completed: !ex.completed } : ex
    );

    const updatedPlan = { ...exercisePlan, exercises: updatedExercises };
    setExercisePlan(updatedPlan);

    await setDoc(doc(db, 'users', userId, 'exercise_plan', 'current'), updatedPlan);
  };

  // Open the set exercise goal modal with a specific day pre-selected
  const openSetExerciseGoalModal = (day: string = 'Monday') => {
    setIsEditMode(false);
    setCurrentExercise(null);
    setSelectedDay(day);
    setSelectedCategory('cardio');
    setSelectedExercises([]);
    setExerciseModalVisible(true);
  };

  // Open the edit exercise modal
  const openEditExerciseModal = (exercise: Exercise) => {
    setIsEditMode(true);
    setCurrentExercise(exercise);
    setSelectedDay(exercise.day);
    setSelectedExercises([{ name: exercise.name, duration: exercise.duration }]);
    setExerciseModalVisible(true);
  };

  // Toggle exercise selection in the modal
  const toggleExerciseSelection = (exerciseName: string, defaultDuration: string) => {
    const isSelected = selectedExercises.some(ex => ex.name === exerciseName);
    if (isSelected) {
      setSelectedExercises(selectedExercises.filter(ex => ex.name !== exerciseName));
    } else {
      setSelectedExercises([...selectedExercises, { name: exerciseName, duration: defaultDuration }]);
    }
  };

  // Update duration for a selected exercise
  const updateExerciseDuration = (exerciseName: string, duration: string) => {
    setSelectedExercises(
      selectedExercises.map(ex =>
        ex.name === exerciseName ? { ...ex, duration } : ex
      )
    );
  };

  // Save exercises to plan
  const saveExercises = async () => {
    if (!userId || !exercisePlan) return;

    if (selectedExercises.length === 0) {
      Alert.alert('Error', 'Please select at least one exercise');
      return;
    }

    const hasInvalidDuration = selectedExercises.some(ex => !ex.duration || ex.duration.trim() === '');
    if (hasInvalidDuration) {
      Alert.alert('Error', 'Please enter a duration for all selected exercises');
      return;
    }

    let updatedExercises = [...exercisePlan.exercises];

    if (isEditMode && currentExercise) {
      // Remove the old exercise
      updatedExercises = updatedExercises.filter(ex => ex.id !== currentExercise.id);
      // Add the updated exercise(s)
      const newExercises = selectedExercises.map(ex => ({
        id: currentExercise.id,
        day: selectedDay,
        name: ex.name,
        duration: ex.duration,
        completed: false,
      }));
      updatedExercises.push(...newExercises);
    } else {
      // Add new exercises
      const newExercises = selectedExercises.map(ex => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9), // Unique ID
        day: selectedDay,
        name: ex.name,
        duration: ex.duration,
        completed: false,
      }));
      updatedExercises.push(...newExercises);
    }

    const updatedPlan = { ...exercisePlan, exercises: updatedExercises };

    try {
      await setDoc(doc(db, 'users', userId, 'exercise_plan', 'current'), updatedPlan);
      setExercisePlan(updatedPlan);
      setExerciseModalVisible(false);
    } catch (err) {
      console.error('Failed to save exercises:', err);
      setError('Failed to save exercises');
    }
  };

  // Delete exercise from plan
  const deleteExercise = async (exerciseId: string) => {
    if (!userId || !exercisePlan) return;

    Alert.alert(
      'Delete Exercise',
      'Are you sure you want to delete this exercise?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedExercises = exercisePlan.exercises.filter(ex => ex.id !== exerciseId);
            const updatedPlan = { ...exercisePlan, exercises: updatedExercises };
            
            try {
              await setDoc(doc(db, 'users', userId, 'exercise_plan', 'current'), updatedPlan);
              setExercisePlan(updatedPlan);
            } catch (err) {
              console.error('Failed to delete exercise:', err);
              setError('Failed to delete exercise');
            }
          }
        }
      ]
    );
  };

  // Handle time selection confirmation
  const handleConfirmTime = async () => {
    setTimePickerVisible(false);

    if (!userId || !exercisePlan) return;
    
    const hours = selectedHour.toString().padStart(2, '0');
    const minutes = selectedMinute.toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}:00`;
    
    const updatedPlan = { ...exercisePlan, notificationTime: timeString };
    setExercisePlan(updatedPlan);

    await setDoc(doc(db, 'users', userId, 'exercise_plan', 'current'), updatedPlan);
    scheduleNotifications(timeString);
  };

  // Schedule daily notifications
  const scheduleNotifications = async (timeString: string) => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();

      const [hours, minutes] = timeString.split(':').map(Number);
      const now = new Date();

      for (let i = 0; i < 7; i++) {
        const notificationDate = new Date();
        notificationDate.setDate(now.getDate() + i);
        notificationDate.setHours(hours, minutes, 0, 0);

        if (notificationDate.getTime() <= now.getTime()) {
          console.log(`Skipping notification for ${getDayName(i)}: Trigger is in the past`);
          continue;
        }

        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Exercise Reminder',
            body: `Time to follow your exercise plan for ${getDayName(i)}!`,
          },
          trigger: {
            channelId: 'exercise-reminders',
            date: notificationDate,
          },
        });
        console.log(`Scheduled notification for ${getDayName(i)} at ${timeString}`);
      }
    } catch (err) {
      console.error('Failed to schedule notifications:', err);
      setError('Failed to schedule notifications');
    }
  };
  
  // Helper to get day name
  const getDayName = (offset: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const now = new Date();
    now.setDate(now.getDate() + offset);
    return days[now.getDay()];
  };

  // Render hours picker items
  const renderHourItems = () => {
    const items = [];
    for (let i = 0; i < 24; i++) {
      items.push(
        <Picker.Item key={`hour-${i}`} label={i.toString().padStart(2, '0')} value={i} />
      );
    }
    return items;
  };

  // Render minutes picker items
  const renderMinuteItems = () => {
    const items = [];
    for (let i = 0; i < 60; i++) {
      items.push(
        <Picker.Item key={`minute-${i}`} label={i.toString().padStart(2, '0')} value={i} />
      );
    }
    return items;
  };

  // Sort exercises by day
  const getDayExercises = (day: string) => {
    if (!exercisePlan) return [];
    return exercisePlan.exercises.filter(exercise => exercise.day === day);
  };

  // Render week days
  const renderWeekDay = (day: string) => {
    const exercises = getDayExercises(day);
    
    return (
      <View key={day} style={styles.dayContainer}>
        <View style={styles.dayHeader}>
          <ThemedText style={[styles.dayTitle, { color: textColor }]}>{day}</ThemedText>
        </View>
        <TouchableOpacity
          style={[styles.setGoalButton, { backgroundColor: '#00C4B4' }]}
          onPress={() => openSetExerciseGoalModal(day)}
        >
          <ThemedText style={styles.setGoalButtonText}>Set Exercise Goal</ThemedText>
        </TouchableOpacity>
        
        {exercises.length > 0 ? (
          exercises.map(exercise => (
            <View 
              key={exercise.id} 
              style={[styles.exerciseItem, { backgroundColor: cardBackground }]}
            >
              <TouchableOpacity 
                style={styles.exerciseCheckbox}
                onPress={() => toggleExercise(exercise.id)}
              >
                <ThemedText style={[styles.checkbox, { color: exercise.completed ? '#00C4B4' : textColor }]}>
                  {exercise.completed ? '✓' : '⬜'}
                </ThemedText>
              </TouchableOpacity>
              
              <View style={styles.exerciseInfo}>
                <ThemedText style={[styles.exerciseText, { color: textColor }]}>
                  {exercise.name}
                </ThemedText>
                <ThemedText style={[styles.exerciseDuration, { color: textColor }]}>
                  {exercise.duration}
                </ThemedText>
              </View>
              
              <View style={styles.exerciseActions}>
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={() => openEditExerciseModal(exercise)}
                >
                  <ThemedText style={{ color: '#00C4B4' }}>✎</ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={() => deleteExercise(exercise.id)}
                >
                  <ThemedText style={{ color: '#FF5252' }}>✖</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <ThemedText style={[styles.noExercisesText, { color: textColor }]}>
            No exercises added for this day
          </ThemedText>
        )}
      </View>
    );
  };

  // Format time for display
  const formatTimeForDisplay = (hours: number, minutes: number) => {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <ThemedView style={styles.container}>
        {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}
        {userId && exercisePlan ? (
          <View style={styles.content}>
            <ThemedText style={[styles.title, { color: textColor }]}>Your Weekly Exercise Plan</ThemedText>
            
            {/* Custom Time Picker Button */}
            <TouchableOpacity
              style={[styles.timePickerButton, { backgroundColor: cardBackground }]}
              onPress={() => setTimePickerVisible(true)}
            >
              <ThemedText style={[styles.timePickerText, { color: textColor }]}>
                {exercisePlan.notificationTime
                  ? `Reminders set for ${exercisePlan.notificationTime.slice(0, 5)}`
                  : 'Set Daily Reminder Time'}
              </ThemedText>
            </TouchableOpacity>

            {/* Exercise List by Day */}
            <ScrollView style={styles.weekContainer}>
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => 
                renderWeekDay(day)
              )}
            </ScrollView>
            
            {/* Custom Time Picker Modal */}
            <Modal
              visible={isTimePickerVisible}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setTimePickerVisible(false)}
            >
              <View style={styles.modalContainer}>
                <View style={[styles.modalContent, { backgroundColor: modalBackground }]}>
                  <ThemedText style={[styles.modalTitle, { color: textColor }]}>
                    Select Reminder Time
                  </ThemedText>
                  
                  <View style={styles.pickerContainer}>
                    <View style={styles.pickerWrapper}>
                      <ThemedText style={[styles.pickerLabel, { color: textColor }]}>Hour</ThemedText>
                      <Picker
                        selectedValue={selectedHour}
                        onValueChange={(itemValue) => setSelectedHour(itemValue)}
                        style={[styles.picker, { color: textColor }]}
                      >
                        {renderHourItems()}
                      </Picker>
                    </View>
                    
                    <ThemedText style={[styles.pickerSeparator, { color: textColor }]}>:</ThemedText>
                    
                    <View style={styles.pickerWrapper}>
                      <ThemedText style={[styles.pickerLabel, { color: textColor }]}>Minute</ThemedText>
                      <Picker
                        selectedValue={selectedMinute}
                        onValueChange={(itemValue) => setSelectedMinute(itemValue)}
                        style={[styles.picker, { color: textColor }]}
                      >
                        {renderMinuteItems()}
                      </Picker>
                    </View>
                  </View>
                  
                  <View style={styles.modalButtonsContainer}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.cancelButton]}
                      onPress={() => setTimePickerVisible(false)}
                    >
                      <ThemedText style={styles.modalButtonText}>Cancel</ThemedText>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.modalButton, styles.confirmButton]}
                      onPress={handleConfirmTime}
                    >
                      <ThemedText style={styles.modalButtonText}>Confirm</ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            {/* Exercise Goal Modal */}
            <Modal
              visible={isExerciseModalVisible}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setExerciseModalVisible(false)}
            >
              <View style={styles.modalContainer}>
                <View style={[styles.modalContent, { backgroundColor: modalBackground, maxHeight: '80%' }]}>
                  <ScrollView style={styles.modalScrollView}>
                    <ThemedText style={[styles.modalTitle, { color: textColor }]}>
                      {isEditMode ? 'Edit Exercise Goal' : 'Set Exercise Goal'}
                    </ThemedText>
                    
                    <View style={styles.formGroup}>
                      <ThemedText style={[styles.formLabel, { color: textColor }]}>Day</ThemedText>
                      <View style={[styles.pickerBorder, { backgroundColor: inputBackground }]}>
                        <Picker
                          selectedValue={selectedDay}
                          onValueChange={(itemValue) => setSelectedDay(itemValue)}
                          style={[styles.formPicker, { color: textColor }]}
                        >
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                            <Picker.Item key={day} label={day} value={day} />
                          ))}
                        </Picker>
                      </View>
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={[styles.formLabel, { color: textColor }]}>Category</ThemedText>
                      <View style={[styles.pickerBorder, { backgroundColor: inputBackground }]}>
                        <Picker
                          selectedValue={selectedCategory}
                          onValueChange={(itemValue) => setSelectedCategory(itemValue)}
                          style={[styles.formPicker, { color: textColor }]}
                        >
                          <Picker.Item label="Cardio" value="cardio" />
                          <Picker.Item label="Strength" value="strength" />
                          <Picker.Item label="Flexibility" value="flexibility" />
                          <Picker.Item label="Recovery" value="recovery" />
                        </Picker>
                      </View>
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={[styles.formLabel, { color: textColor }]}>Select Exercises</ThemedText>
                      {exerciseTemplates[selectedCategory as keyof typeof exerciseTemplates].map(exercise => (
                        <View key={exercise.name} style={styles.exerciseSelectionItem}>
                          <TouchableOpacity
                            style={styles.exerciseSelectionCheckbox}
                            onPress={() => toggleExerciseSelection(exercise.name, exercise.defaultDuration)}
                          >
                            <ThemedText style={[styles.checkbox, { color: selectedExercises.some(ex => ex.name === exercise.name) ? '#00C4B4' : textColor }]}>
                              {selectedExercises.some(ex => ex.name === exercise.name) ? '✓' : '⬜'}
                            </ThemedText>
                          </TouchableOpacity>
                          <ThemedText style={[styles.exerciseSelectionText, { color: textColor, flex: 1 }]}>
                            {exercise.name}
                          </ThemedText>
                          {selectedExercises.some(ex => ex.name === exercise.name) && (
                            <TextInput
                              style={[styles.durationInput, { backgroundColor: inputBackground, color: textColor }]}
                              value={selectedExercises.find(ex => ex.name === exercise.name)?.duration || exercise.defaultDuration}
                              onChangeText={(text) => updateExerciseDuration(exercise.name, text)}
                              placeholder="Duration (e.g., 30 min)"
                              placeholderTextColor="#999999"
                              keyboardType="numeric"
                            />
                          )}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                  
                  <View style={styles.modalButtonsContainer}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.cancelButton]}
                      onPress={() => setExerciseModalVisible(false)}
                    >
                      <ThemedText style={styles.modalButtonText}>Cancel</ThemedText>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.modalButton, styles.confirmButton]}
                      onPress={saveExercises}
                    >
                      <ThemedText style={styles.modalButtonText}>Save</ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </View>
        ) : (
          <ThemedText style={[styles.noPlanText, { color: textColor }]}>
            {userId ? 'Creating your exercise plan...' : 'Please log in to view your exercise plan.'}
          </ThemedText>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  content: { flex: 1 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },

  // Time Picker Button
  timePickerButton: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  timePickerText: { fontSize: 16, fontWeight: '500' },

  // Week Container
  weekContainer: {
    flex: 1,
  },
  dayContainer: {
    marginBottom: 16,
  },
  dayHeader: {
    marginBottom: 8,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  setGoalButton: {
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 8,
  },
  setGoalButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },

  // Exercise Items
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  exerciseCheckbox: {
    marginRight: 10,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseText: {
    fontSize: 16,
    fontWeight: '400',
  },
  exerciseDuration: {
    fontSize: 14,
    fontWeight: '300',
    marginTop: 4,
  },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  checkbox: {
    fontSize: 20,
  },
  noExercisesText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },

  // Modal Styles (Time Picker and Exercise Modal)
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
  },
  modalContent: {
    borderRadius: 12,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modalScrollView: {
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  pickerWrapper: {
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  picker: {
    width: 100,
    height: 150,
  },
  pickerSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: '#FF5252',
  },
  confirmButton: {
    backgroundColor: '#00C4B4',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },

  // Form Styles (Exercise Modal)
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  pickerBorder: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  formPicker: {
    width: '100%',
    height: 50,
  },
  exerciseSelectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseSelectionCheckbox: {
    marginRight: 10,
  },
  exerciseSelectionText: {
    fontSize: 16,
    fontWeight: '400',
  },
  durationInput: {
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    width: 120,
    marginLeft: 10,
  },

  // Error and Placeholder Text
  errorText: {
    color: '#FF5252',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 16,
  },
  noPlanText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 20,
  },
});