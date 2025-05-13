import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';

// Types
type PlankVariation = 'regular' | 'side' | 'elevated';
type AchievementId = 'first_plank' | 'full_2min' | 'three_day_streak' | 'seven_day_streak' | 'all_variations';

interface Achievement {
  id: AchievementId;
  title: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}

interface PlankTrackerData {
  plankTime?: number;
  variation?: PlankVariation;
  lastPlank?: string | null;
  longestStreak?: number;
  achievements?: AchievementId[];
}

// Helper function to remove undefined fields
const cleanData = (data: Record<string, any>): Record<string, any> => {
  const cleaned: Record<string, any> = {};
  Object.keys(data).forEach((key) => {
    if (data[key] !== undefined) {
      cleaned[key] = data[key];
    }
  });
  return cleaned;
};

// Create animated circle component
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function PlankTracker() {
  // Core state variables
  const [plankTime, setPlankTime] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [variation, setVariation] = useState<PlankVariation>('regular');
  const [lastPlank, setLastPlank] = useState<string | null>(null);
  const [longestStreak, setLongestStreak] = useState<number>(0);
  const [isBeginner, setIsBeginner] = useState<boolean | null>(null);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [restMode, setRestMode] = useState<boolean>(false);
  const [restTime, setRestTime] = useState<number>(60);
  const [achievements, setAchievements] = useState<AchievementId[]>([]);
  const [showAchievement, setShowAchievement] = useState<boolean>(false);
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null);
  const [showModeSelector, setShowModeSelector] = useState<boolean>(true);
  const [showGoalModal, setShowGoalModal] = useState<boolean>(false);
  
  // Refs
  const intervalId = useRef<NodeJS.Timeout | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const achievementAnim = useRef(new Animated.Value(0)).current;
  
  const targetTime = 120; // 2 minutes in seconds

  // Define achievements
  const availableAchievements: Achievement[] = [
    { id: 'first_plank', title: 'First Plank!', description: 'Complete your first plank', icon: 'star' },
    { id: 'full_2min', title: 'Endurance Master', description: 'Complete a full 2-minute plank', icon: 'emoji-events' },
    { id: 'three_day_streak', title: 'Consistency', description: 'Maintain a 3-day streak', icon: 'local-fire-department' },
    { id: 'seven_day_streak', title: 'Weekly Warrior', description: 'Maintain a 7-day streak', icon: 'whatshot' },
    { id: 'all_variations', title: 'Variety Master', description: 'Try all plank variations', icon: 'diversity-3' },
  ];

  // Load data on first render
  useEffect(() => {
    loadData();
  }, []);

  // Timer effect
  useEffect(() => {
    if (isActive && plankTime < targetTime) {
      intervalId.current = setInterval(() => {
        setPlankTime((prev) => {
          const newTime = prev + 1;
          Animated.timing(progressAnim, {
            toValue: newTime / (isBeginner ? getBeginnerTarget().time : targetTime),
            duration: 1000,
            useNativeDriver: false,
          }).start();
          return newTime;
        });
      }, 1000);
    } else if (isActive && plankTime >= targetTime) {
      setIsActive(false);
      saveCompletedPlank();
      checkAchievements('full_2min');
      setShowGoalModal(true);
    } else if (isActive && isBeginner && plankTime >= getBeginnerTarget().time) {
      setIsActive(false);
      saveCompletedPlank();
      if (getBeginnerTarget().time >= targetTime) {
        checkAchievements('full_2min');
      }
      setShowGoalModal(true);
    }
    
    if (restMode) {
      intervalId.current = setInterval(() => {
        setRestTime((prev) => {
          if (prev <= 1) {
            setRestMode(false);
            return 60;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (intervalId.current) {
        clearInterval(intervalId.current);
      }
    };
  }, [isActive, plankTime, restMode, restTime, isBeginner]);

  // Load data from storage
  const loadData = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert('Error', 'User not authenticated. Please log in.');
      return;
    }

    try {
      const goalRef = doc(db, 'users', userId, 'goals', '11');
      const goalDoc = await getDoc(goalRef);

      if (goalDoc.exists()) {
        const data: PlankTrackerData = goalDoc.data() as PlankTrackerData;
        setPlankTime(data.plankTime || 0);
        setVariation(data.variation || 'regular');
        setLastPlank(data.lastPlank || null);
        setLongestStreak(data.longestStreak || 0);
        setAchievements(data.achievements || []);
      } else {
        await setDoc(goalRef, {
          plankTime: 0,
          variation: 'regular',
          lastPlank: null,
          longestStreak: 0,
          achievements: [],
        });
      }
    } catch (error) {
      console.log('Error loading plank data:', error);
    }
  };

  // Save data to storage
  const saveData = async (data: Partial<PlankTrackerData> = {}) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert('Error', 'User not authenticated. Please log in.');
      return;
    }

    try {
      const currentData: PlankTrackerData = {
        plankTime,
        variation,
        lastPlank,
        longestStreak,
        achievements,
        ...data
      };
      
      const cleanedData = cleanData(currentData);
      const goalRef = doc(db, 'users', userId, 'goals', '11');
      await updateDoc(goalRef, cleanedData);
    } catch (error) {
      console.log('Error saving plank data:', error);
    }
  };

  // When a plank is completed
  const saveCompletedPlank = async () => {
    const now = new Date().toISOString();
    const newLongestStreak = Math.max(1, longestStreak);
    
    setLongestStreak(newLongestStreak);
    
    await saveData({ 
      lastPlank: now,
      longestStreak: newLongestStreak
    });
    
    if (newLongestStreak === 1 && longestStreak === 0) {
      checkAchievements('first_plank');
    }
  };

  // Check and award achievements
  const checkAchievements = (achievementId: AchievementId) => {
    if (!achievements.includes(achievementId)) {
      const newAchievements = [...achievements, achievementId];
      setAchievements(newAchievements);
      saveData({ achievements: newAchievements });
      
      const achievement = availableAchievements.find(a => a.id === achievementId);
      if (achievement) {
        setCurrentAchievement(achievement);
        setShowAchievement(true);
        
        Animated.sequence([
          Animated.timing(achievementAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.delay(2000),
          Animated.timing(achievementAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          })
        ]).start(() => {
          setShowAchievement(false);
        });
      }
    }
  };

  // Start a plank session
  const startPlank = () => {
    const targetTimeToBeat = isBeginner ? getBeginnerTarget().time : targetTime;
    
    if (plankTime >= targetTimeToBeat) {
      setShowGoalModal(true);
      return;
    }
    
    // Reset progress animation to start from current progress
    progressAnim.setValue(plankTime / targetTimeToBeat);
    setIsActive(true);
  };

  // Stop current plank
  const stopPlank = () => {
    setIsActive(false);
    if (plankTime > 0) {
      Alert.alert(
        "Take a Rest?",
        "Would you like to start a rest timer?",
        [
          {
            text: "Yes",
            onPress: () => setRestMode(true)
          },
          {
            text: "No",
            style: "cancel"
          }
        ]
      );
    }
  };

  // Reset the timer
  const resetPlank = () => {
    setPlankTime(0);
    progressAnim.setValue(0);
  };

  // Change plank variation
  const changeVariation = (newVariation: PlankVariation) => {
    setVariation(newVariation);
    
    const usedVariations = new Set(achievements.filter(a => a.startsWith('variation_')));
    usedVariations.add(`variation_${newVariation}` as AchievementId);
    
    if (usedVariations.size >= 3) {
      checkAchievements('all_variations');
    }
  };

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Get feedback based on current time
  const getFeedback = (): string => {
    if (plankTime < 30) return "Focus on keeping your back straight.";
    if (plankTime < 60) return "Try engaging your core more.";
    if (plankTime < 90) return "You're doing great! Keep breathing!";
    return "Almost there! Hold strong!";
  };

  // Show mode selector modal
  const showModeSelectorModal = () => {
    setShowModeSelector(true);
  };

  // Render the circular progress indicator
  const renderProgressCircle = (currentTarget: number = targetTime) => {
    const size = 200;
    const strokeWidth = 15;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = progressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [circumference, 0],
    });

    return (
      <View style={styles.progressCircleContainer}>
        <Svg width={size} height={size} style={styles.progressCircle}>
          <Circle
            stroke="#E0F7FA"
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
          />
          <AnimatedCircle
            stroke="#0277BD"
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </Svg>
        <Animated.View style={styles.progressTextContainer}>
          <Text style={styles.timerText}>{formatTime(plankTime)}</Text>
        </Animated.View>
      </View>
    );
  };
  // Calculate beginner target based on current plankTime
  const getBeginnerTarget = () => {
    const beginnerSteps = [
      { time: 20, text: "Start with a 20-second plank" },
      { time: 30, text: "Move up to a 30-second plank" },
      { time: 45, text: "Try a 45-second plank" },
      { time: 60, text: "Challenge yourself with a 1-minute plank" },
      { time: 90, text: "Progress to a 90-second plank" },
      { time: 120, text: "Full 2-minute plank - You've made it!" }
    ];
    
    for (let i = 0; i < beginnerSteps.length; i++) {
      if (plankTime < beginnerSteps[i].time) {
        return beginnerSteps[i];
      }
    }
    
    return beginnerSteps[beginnerSteps.length - 1];
  };

  // Display the beginner's progressive mode
  const renderBeginnerMode = () => {
    const currentTarget = getBeginnerTarget();
    
    return (
      <View style={styles.beginnerContainer}>
        <Text style={styles.beginnerTitle}>Progressive Plank Training</Text>
        <Text style={styles.beginnerTarget}>{currentTarget.text}</Text>
        
        {/* Progress circle for beginner mode */}
        {renderProgressCircle(currentTarget.time)}
        
        {!restMode ? (
          <>
            <View style={styles.beginnerGuideContainer}>
              <Text style={styles.guideHeader}>Proper Form:</Text>
              <Text style={styles.guideItem}>1. Start on your forearms and toes</Text>
              <Text style={styles.guideItem}>2. Keep your body in a straight line</Text>
              <Text style={styles.guideItem}>3. Engage your core muscles</Text>
              <Text style={styles.guideItem}>4. Don't let your hips sag or rise</Text>
              <Text style={styles.guideItem}>5. Breathe normally throughout</Text>
            </View>
            
            {isActive && (
              <Text style={styles.feedbackText}>{getFeedback()}</Text>
            )}
            
            <TouchableOpacity 
            style={[styles.button, styles.beginnerButton, isActive ? styles.stopButton : {}]} 
            onPress={() => isActive ? stopPlank() : startPlank()}>
            <Text style={styles.buttonText}>
              {isActive ? "Stop" : (plankTime >= currentTarget.time ? `Restart ${currentTarget.time}-Second Plank` : `Start ${currentTarget.time}-Second Plank`)}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton, styles.maxWidthButton]} 
            onPress={showModeSelectorModal}>
            <Text style={styles.buttonText}>Switch to Advanced Mode</Text>
          </TouchableOpacity>
        </>
        ) : (
          <View style={styles.restContainer}>
            <Text style={styles.restTitle}>Rest Time</Text>
            <Text style={styles.restTimer}>{formatTime(restTime)}</Text>
            <TouchableOpacity 
              style={[styles.button, styles.resetButton]} 
              onPress={() => setRestMode(false)}>
              <Text style={styles.buttonText}>Skip Rest</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Display the advanced mode with full features
  const renderAdvancedMode = () => {
    return (
      <View style={styles.advancedContainer}>
        {!restMode ? (
          <>
            {renderProgressCircle()}
            
            {isActive && (
              <Text style={styles.feedbackText}>{getFeedback()}</Text>
            )}
            
            <View style={styles.controlContainer}>
              {isActive ? (
                <TouchableOpacity style={[styles.button, styles.stopButton]} onPress={stopPlank}>
                  <Text style={styles.buttonText}>Stop</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.button} onPress={startPlank}>
                  <Text style={styles.buttonText}>Start Plank</Text>
                </TouchableOpacity>
              )}
              
              {plankTime > 0 && !isActive && (
                <TouchableOpacity style={[styles.button, styles.resetButton]} onPress={resetPlank}>
                  <Text style={styles.buttonText}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <TouchableOpacity 
              style={styles.helpButton} 
              onPress={() => setShowGuide(true)}>
              <MaterialIcons name="help-outline" size={24} color="#0277BD" />
              <Text style={styles.helpText}>View Plank Guide</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
            style={[styles.button, styles.secondaryButton, styles.maxWidthButton, {marginTop: 20}]} 
            onPress={showModeSelectorModal}>
            <Text style={styles.buttonText}>Switch to Beginner Mode</Text>
          </TouchableOpacity>
        </>
        ) : (
          <View style={styles.restContainer}>
            <Text style={styles.restTitle}>Rest Time</Text>
            <Text style={styles.restTimer}>{formatTime(restTime)}</Text>
            <TouchableOpacity 
              style={[styles.button, styles.resetButton]} 
              onPress={() => setRestMode(false)}>
              <Text style={styles.buttonText}>Skip Rest</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#E0F7FA', '#B2EBF2', '#80DEEA']} style={styles.background} />
      
      {/* Mode selection modal - show on start or when switching */}
      {showModeSelector && (
        <Modal transparent={true} animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <MaterialIcons name="fitness-center" size={48} color="#0277BD" style={styles.modalIcon} />
              <Text style={styles.modalTitle}>Plank Tracker</Text>
              <Text style={styles.modalText}>Choose your training mode:</Text>
              <TouchableOpacity 
                style={styles.modalButton} 
                onPress={() => {
                  setIsBeginner(true);
                  setShowModeSelector(false);
                  resetPlank();
                }}>
                <Text style={styles.buttonText}>Beginner Mode</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalButton} 
                onPress={() => {
                  setIsBeginner(false);
                  setShowModeSelector(false);
                  resetPlank();
                }}>
                <Text style={styles.buttonText}>Advanced Mode</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
      
      {/* Goal Achieved Modal */}
      {showGoalModal && (
        <Modal transparent={true} animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.goalModalContent}>
              <Text style={styles.goalTitle}>Goal Achieved!</Text>
              <Text style={styles.goalText}>
                {isBeginner 
                  ? `You've completed ${getBeginnerTarget().time} seconds of planking!` 
                  : "You've already completed 2 minutes of planking today!"}
              </Text>
              <TouchableOpacity 
                style={styles.modalButton} 
                onPress={() => setShowGoalModal(false)}>
                <Text style={styles.buttonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
      
      {/* Plank Guide Modal */}
      {showGuide && (
        <Modal transparent={true} animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Plank Guide</Text>
              <Text style={styles.guideHeader}>Regular Plank:</Text>
              <Text style={styles.guideItem}>1. Start on your forearms and toes</Text>
              <Text style={styles.guideItem}>2. Keep elbows under shoulders</Text>
              <Text style={styles.guideItem}>3. Form a straight line from head to heels</Text>
              
              <Text style={styles.guideHeader}>Side Plank:</Text>
              <Text style={styles.guideItem}>1. Lie on one side with elbow under shoulder</Text>
              <Text style={styles.guideItem}>2. Stack feet or stagger them for stability</Text>
              <Text style={styles.guideItem}>3. Raise hips to create straight line</Text>
              
              <Text style={styles.guideHeader}>Elevated Plank:</Text>
              <Text style={styles.guideItem}>1. Place forearms on elevated surface</Text>
              <Text style={styles.guideItem}>2. Walk feet back to form decline plank</Text>
              <Text style={styles.guideItem}>3. Maintain straight body alignment</Text>
              
              <TouchableOpacity style={styles.modalButton} onPress={() => setShowGuide(false)}>
                <Text style={styles.buttonText}>Close Guide</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
      
      {/* Main content */}
      {isBeginner === true ? renderBeginnerMode() : isBeginner === false ? renderAdvancedMode() : null}
      
      {/* Achievement popup */}
      {showAchievement && currentAchievement && (
        <Animated.View 
          style={[
            styles.achievementContainer,
            {
              opacity: achievementAnim,
              transform: [{
                translateY: achievementAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-50, 0]
                })
              }]
            }
          ]}>
          <MaterialIcons name={currentAchievement.icon} size={24} color="#FFC107" />
          <View style={styles.achievementTextContainer}>
            <Text style={styles.achievementTitle}>{currentAchievement.title}</Text>
            <Text style={styles.achievementDesc}>{currentAchievement.description}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  // Progress Circle Styles
  progressCircleContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    width: 200,
    height: 200,
  },
  progressCircle: {
    position: 'absolute',
    transform: [{ rotateZ: '-90deg' }],
  },
  progressTextContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  timerText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0277BD',
  },
  targetText: {
    fontSize: 18,
    color: '#0277BD',
    opacity: 0.7,
  },
  feedbackText: {
    fontSize: 14,
    color: '#0277BD',
    marginTop: 8,
    marginBottom: 12,
    textAlign: 'center',
    maxWidth: 250,
  },
  // Control Buttons
  controlContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  button: {
    width: 150,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4FC3F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    elevation: 3,
  },
  secondaryButton: {
    backgroundColor: '#90CAF9',
    marginTop: 10,
  },
  maxWidthButton: {
    width: '90%', // Match the width of beginnerButton
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stopButton: {
    backgroundColor: '#FF5252',
  },
  resetButton: {
    backgroundColor: '#9E9E9E',
  },
  // Variation Selector
  variationContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  variationTitle: {
    fontSize: 16,
    color: '#0277BD',
    marginBottom: 10,
  },
  variationButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  variationButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#B2EBF2',
    marginHorizontal: 5,
  },
  activeVariation: {
    backgroundColor: '#0277BD',
  },
  variationText: {
    color: '#01579B',
    fontWeight: '500',
  },
  // Stats Display
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '80%',
    marginVertical: 15,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    marginLeft: 5,
    color: '#01579B',
    fontWeight: '500',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    width: '85%',
    maxHeight: '80%',
  },
  goalModalContent: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    width: '85%',
  },
  goalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0277BD',
    marginBottom: 12,
  },
  goalText: {
    fontSize: 18,
    color: '#01579B',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0277BD',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 18,
    color: '#01579B',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButton: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4FC3F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  // Beginner Mode
  beginnerContainer: {
    width: '90%',
    alignItems: 'center',
  },
  beginnerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0277BD',
    marginBottom: 8,
  },
  beginnerTarget: {
    fontSize: 18,
    color: '#01579B',
    marginBottom: 20,
    textAlign: 'center',
  },
  beginnerGuideContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    width: '100%',
  },
  guideHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#01579B',
    marginBottom: 8,
    marginTop: 8,
  },
  guideItem: {
    fontSize: 14,
    color: '#01579B',
    marginBottom: 4,
    paddingLeft: 8,
  },
  beginnerButton: {
    width: '90%',
    backgroundColor: '#4CAF50',
  },
  // Advanced Mode
  advancedContainer: {
    width: '90%',
    alignItems: 'center',
  },
  // Help Button
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  helpText: {
    color: '#0277BD',
    marginLeft: 5,
  },
  // Rest Timer
  restContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  restTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0277BD',
    marginBottom: 10,
  },
  restTimer: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#0277BD',
    marginBottom: 20,
  },
  // Achievement Styles
  achievementContainer: {
    position: 'absolute',
    top: 40,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  achievementTextContainer: {
    marginLeft: 10,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0277BD',
  },
  achievementDesc: {
    fontSize: 14,
    color: '#01579B',
  },
});