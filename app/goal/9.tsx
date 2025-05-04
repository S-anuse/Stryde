import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Alert,
  Vibration,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

// Yoga pose data organized by level
const yogaPoses = {
  beginner: [
    { id: 'b1', name: 'Mountain Pose', sanskrit: 'Tadasana', duration: 30, instructions: 'Stand tall with feet together, hands by your sides. Ground down through your feet, engage your core, and breathe deeply.' },
    { id: 'b2', name: "Child's Pose", sanskrit: 'Balasana', duration: 60, instructions: 'Kneel on the floor, touch big toes together, sit on heels, then fold forward extending arms forward or alongside body.' },
    { id: 'b3', name: 'Cat-Cow Stretch', sanskrit: 'Marjaryasana-Bitilasana', duration: 45, instructions: 'On hands and knees, alternate between arching (cow) and rounding (cat) your back with your breath.' },
    { id: 'b4', name: 'Downward Dog', sanskrit: 'Adho Mukha Svanasana', duration: 45, instructions: 'Form an inverted V-shape with hands and feet on the floor, pushing hips up and back.' },
    { id: 'b5', name: 'Cobra Pose', sanskrit: 'Bhujangasana', duration: 30, instructions: 'Lie on your stomach, place hands under shoulders, then lift chest while keeping hips on the floor.' },
    { id: 'b6', name: 'Seated Forward Bend', sanskrit: 'Paschimottanasana', duration: 60, instructions: 'Sit with legs extended, fold forward reaching for your feet while keeping your back straight.' },
  ],
  intermediate: [
    { id: 'i1', name: 'Warrior I', sanskrit: 'Virabhadrasana I', duration: 45, instructions: 'Lunge with back foot at 45°, hips facing forward, arms extended overhead with palms together.' },
    { id: 'i2', name: 'Warrior II', sanskrit: 'Virabhadrasana II', duration: 45, instructions: 'Lunge with back foot parallel to back edge, arms extended to sides, gaze over front hand.' },
    { id: 'i3', name: 'Triangle Pose', sanskrit: 'Trikonasana', duration: 30, instructions: 'Feet wide apart, front foot forward, extend torso to front leg, bottom hand to shin, top arm extended up.' },
    { id: 'i4', name: 'Crow Pose', sanskrit: 'Bakasana', duration: 20, instructions: 'Squat with hands on floor, knees to outer arms, lean forward to lift feet, balancing on hands.' },
    { id: 'i5', name: 'Camel Pose', sanskrit: 'Ustrasana', duration: 30, instructions: 'Kneel with hips over knees, reach back to hold heels, lift chest and extend spine backward.' },
    { id: 'i6', name: 'Bridge Pose', sanskrit: 'Setu Bandha Sarvangasana', duration: 45, instructions: 'Lie on back, bend knees, feet flat. Lift hips, interlace fingers under back, press shoulders down.' },
  ],
  advanced: [
    { id: 'a1', name: 'Headstand', sanskrit: 'Sirsasana', duration: 60, instructions: 'Create a triangle with forearms, interlace fingers, crown of head on floor, lift legs overhead, maintain balance.' },
    { id: 'a2', name: 'Forearm Stand', sanskrit: 'Pincha Mayurasana', duration: 30, instructions: 'Forearms on floor, shoulders over elbows, lift one leg then the other, find balance in an inverted position.' },
    { id: 'a3', name: 'Wheel Pose', sanskrit: 'Chakrasana', duration: 20, instructions: 'Lie on back, bend knees, place hands by ears, press up to form an arch with body.' },
    { id: 'a4', name: 'Firefly Pose', sanskrit: 'Tittibhasana', duration: 15, instructions: 'Squat, thread arms inside thighs, place hands flat, shift weight to hands, extend legs to sides.' },
    { id: 'a5', name: 'Lotus Pose', sanskrit: 'Padmasana', duration: 120, instructions: 'Sit cross-legged, place each foot on opposite thigh, keep spine straight, hands in Mudra position.' },
    { id: 'a6', name: 'Handstand', sanskrit: 'Adho Mukha Vrksasana', duration: 30, instructions: 'Place hands shoulder-width apart, kick one leg up followed by the other, find balance while inverted.' },
  ],
};

// Define yoga sequences by level with yoga types
const yogaSequences = {
  beginner: {
    name: 'Gentle Flow for Beginners',
    duration: 15,
    description: 'A gentle introduction to basic yoga poses with focus on breathing and proper alignment.',
    poses: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b3'],
    benefits: 'Improves flexibility, reduces stress, and builds body awareness',
    types: ['Hatha', 'Gentle Vinyasa', 'Restorative', 'Yin Yoga'],
  },
  intermediate: {
    name: 'Dynamic Flow',
    duration: 25,
    description: 'A flowing sequence that builds strength and deepens your practice with challenging transitions.',
    poses: ['b1', 'b4', 'i1', 'i2', 'i3', 'i5', 'i6', 'b2'],
    benefits: 'Builds core strength, increases stamina, and improves balance',
    types: ['Vinyasa', 'Power Yoga', 'Kundalini (light)', 'Iyengar'],
  },
  advanced: {
    name: 'Power Inversion Practice',
    duration: 40,
    description: 'An intense practice featuring advanced inversions and deep backbends that challenge your strength and focus.',
    poses: ['b1', 'b4', 'i1', 'i2', 'a3', 'a4', 'b4', 'a1', 'a2', 'a6', 'b2'],
    benefits: 'Develops advanced balance, upper body strength, and mental focus',
    types: ['Ashtanga', 'Power Yoga', 'Advanced Vinyasa', 'Inversion Flows'],
  },
};

// Ensure default export for expo-router
export default function YogaGoal() {
  const [selectedLevel, setSelectedLevel] = useState<'beginner' | 'intermediate' | 'advanced' | null>(null);
  const [selectedSequence, setSelectedSequence] = useState<any>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [totalSessionTime, setTotalSessionTime] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [instructionsVisible, setInstructionsVisible] = useState(false);
  const [currentPose, setCurrentPose] = useState<any>(null);
  const [totalSessions, setTotalSessions] = useState(0);
  const [completedTime, setCompletedTime] = useState(0);
  const [lastPauseTime, setLastPauseTime] = useState(0);
  const [isBreak, setIsBreak] = useState(false);
  const [breakTimeRemaining, setBreakTimeRemaining] = useState(5);
  const [lastAnnouncedPoseTime, setLastAnnouncedPoseTime] = useState<number | null>(null);
  const [lastAnnouncedBreakTime, setLastAnnouncedBreakTime] = useState<number | null>(null);

  const router = useRouter();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    loadYogaData();
    return () => {
      cleanupSession();
    };
  }, []);

  useEffect(() => {
    if (isSessionActive && currentPose && !isPaused && !isBreak) {
      const instructions = `${currentPose.name}. ${currentPose.instructions}`;
      try {
        Speech.speak(instructions, {
          language: 'en',
          pitch: 1.0,
          rate: 0.8,
          onError: (error) => {
            console.error('Speech error:', error);
            Alert.alert('Speech Error', 'Voice guidance is unavailable on this device.');
          },
        });
      } catch (error) {
        console.error('Speech initialization error:', error);
        Alert.alert('Speech Error', 'Failed to initialize voice guidance.');
      }
    }
  }, [currentPose, isSessionActive, isPaused, isBreak]);

  const cleanupSession = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try {
      Speech.stop();
    } catch (error) {
      console.error('Error stopping speech:', error);
    }
  };

  const loadYogaData = async () => {
    if (!userId) {
      Alert.alert('Error', 'User not authenticated. Please log in.');
      return;
    }

    try {
      const goalRef = doc(db, 'users', userId, 'goals', '9');
      const goalDoc = await getDoc(goalRef);

      if (goalDoc.exists()) {
        const data = goalDoc.data();
        setTotalSessions(data.totalSessions || 0);
        setCompletedTime(data.completedTime || 0);
      } else {
        await setDoc(goalRef, {
          totalSessions: 0,
          completedTime: 0,
          userId,
        });
      }
    } catch (error) {
      console.error('Error loading yoga data:', error);
      Alert.alert('Error', 'Failed to load your yoga data');
    }
  };

  const selectLevel = (level: 'beginner' | 'intermediate' | 'advanced') => {
    const sequence = yogaSequences[level];
    setSelectedLevel(level);
    setSelectedSequence(sequence);

    let totalTime = 0;
    sequence.poses.forEach((poseId: string) => {
      const pose = findPoseById(poseId);
      if (pose) totalTime += pose.duration;
    });

    setTotalSessionTime(totalTime);
  };

  const findPoseById = (poseId: string) => {
    for (const level in yogaPoses) {
      const foundPose = yogaPoses[level as keyof typeof yogaPoses].find(
        (pose) => pose.id === poseId
      );
      if (foundPose) return foundPose;
    }
    return null;
  };

  const startSession = () => {
    if (!selectedSequence || !selectedSequence.poses || selectedSequence.poses.length === 0) {
      console.error('Invalid sequence:', selectedSequence);
      Alert.alert('Error', 'Invalid yoga sequence');
      return;
    }

    setIsSessionActive(true);
    setIsPaused(false);
    setIsBreak(false);
    setCurrentPoseIndex(0);
    setLastAnnouncedPoseTime(null);
    setLastAnnouncedBreakTime(null);

    const firstPoseId = selectedSequence.poses[0];
    const firstPose = findPoseById(firstPoseId);
    if (!firstPose) {
      console.error('First pose not found for ID:', firstPoseId);
      Alert.alert('Error', 'Failed to load the first pose');
      return;
    }

    setCurrentPose(firstPose);
    setTimeRemaining(firstPose.duration);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      Speech.speak(`Starting ${selectedSequence.name}. First pose: ${firstPose.name}`, {
        language: 'en',
        pitch: 1.0,
        rate: 0.8,
        onError: (error) => {
          console.error('Speech error:', error);
        },
      });
    } catch (error) {
      console.error('Speech initialization error:', error);
    }

    cleanupSession();
    
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        console.log(`Pose timer - Time remaining: ${prev}`);
        if (prev <= 0) {
          console.log('Pose timer reached 0, waiting for manual navigation');
          return 0;
        }
        if ([10, 5, 1].includes(prev) && prev !== lastAnnouncedPoseTime) {
          try {
            Speech.speak(`${prev} seconds remaining`, {
              language: 'en',
              pitch: 1.0,
              rate: 0.8,
              onError: (error) => {
                console.error('Speech error:', error);
              },
            });
            setLastAnnouncedPoseTime(prev);
          } catch (error) {
            console.error('Speech initialization error:', error);
          }
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startBreak = () => {
    console.log('Starting break');
    setIsBreak(true);
    setBreakTimeRemaining(5);
    setLastAnnouncedBreakTime(null);

    try {
      Speech.stop(); // Ensure any ongoing speech is stopped
      Speech.speak('Take a 5-second break.', {
        language: 'en',
        pitch: 1.0,
        rate: 0.8,
        onError: (error) => {
          console.error('Speech error in startBreak:', error);
          Alert.alert('Speech Error', 'Failed to announce break. Voice guidance may be unavailable.');
        },
      });
    } catch (error) {
      console.error('Speech initialization error in startBreak:', error);
      Alert.alert('Speech Error', 'Failed to initialize break announcement.');
    }

    cleanupSession();
    timerRef.current = setInterval(() => {
      setBreakTimeRemaining((prev) => {
        console.log(`Break timer - Time remaining: ${prev}`);
        if (prev <= 0) {
          console.log('Break timer reached 0, waiting for manual navigation');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const advanceToNextPose = () => {
    console.log('Advancing to next pose, currentPoseIndex:', currentPoseIndex, 'selectedSequence:', selectedSequence);
    if (!selectedSequence || !selectedSequence.poses) {
      console.error('No selected sequence or poses');
      Alert.alert(
        'Error',
        'No yoga sequence selected. Would you like to restart or end the session?',
        [
          {
            text: 'Restart',
            onPress: () => {
              setIsSessionActive(false);
              setIsBreak(false);
              setCurrentPoseIndex(0);
              setCurrentPose(null);
              setTimeRemaining(0);
              setBreakTimeRemaining(5);
              setLastAnnouncedPoseTime(null);
              setLastAnnouncedBreakTime(null);
            },
          },
          {
            text: 'End Session',
            style: 'destructive',
            onPress: () => {
              setIsSessionActive(false);
              setIsBreak(false);
              setCurrentPoseIndex(0);
              setCurrentPose(null);
              setTimeRemaining(0);
              setBreakTimeRemaining(5);
              setLastAnnouncedPoseTime(null);
              setLastAnnouncedBreakTime(null);
              setSelectedSequence(null);
              setSelectedLevel(null);
            },
          },
        ]
      );
      return;
    }

    const nextIndex = currentPoseIndex + 1;

    if (nextIndex >= selectedSequence.poses.length) {
      console.log('Session complete');
      completeSession();
      return;
    }

    const nextPoseId = selectedSequence.poses[nextIndex];
    const nextPose = findPoseById(nextPoseId);

    if (nextPose) {
      console.log(`Advancing to next pose: ${nextPose.name}`);
      setCurrentPoseIndex(nextIndex);
      setCurrentPose(nextPose);
      setTimeRemaining(nextPose.duration);
      setIsBreak(false);
      setLastAnnouncedPoseTime(null);

      const announcement = `Next pose: ${nextPose.name}. ${nextPose.instructions}`;
      try {
        Speech.speak(announcement, {
          language: 'en',
          pitch: 1.0,
          rate: 0.8,
          onError: (error) => {
            console.error('Speech error:', error);
          },
        });
      } catch (error) {
        console.error('Speech initialization error:', error);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      cleanupSession();
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          console.log(`Pose timer - Time remaining: ${prev}`);
          if (prev <= 0) {
            console.log('Pose timer reached 0, waiting for manual navigation');
            return 0;
          }
          if ([10, 5, 1].includes(prev) && prev !== lastAnnouncedPoseTime) {
            try {
              Speech.speak(`${prev} seconds remaining`, {
                language: 'en',
                pitch: 1.0,
                rate: 0.8,
                onError: (error) => {
                  console.error('Speech error:', error);
                },
              });
              setLastAnnouncedPoseTime(prev);
            } catch (error) {
              console.error('Speech initialization error:', error);
            }
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      console.error(`Failed to find pose with ID: ${nextPoseId}`);
      completeSession();
    }
  };

  const pauseSession = () => {
    cleanupSession();
    setIsPaused(true);
    setLastPauseTime(isBreak ? breakTimeRemaining : timeRemaining);
    
    Alert.alert(
      'Session Paused',
      'Would you like to resume your session or end it?',
      [
        { 
          text: 'Resume', 
          style: 'cancel', 
          onPress: () => resumeSession() 
        },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: () => {
            setIsSessionActive(false);
            setIsPaused(false);
            setIsBreak(false);
            setCurrentPoseIndex(0);
            setCurrentPose(null);
            setTimeRemaining(0);
            setBreakTimeRemaining(5);
            setLastAnnouncedPoseTime(null);
            setLastAnnouncedBreakTime(null);
          },
        },
      ]
    );
  };

  const resumeSession = () => {
    setIsPaused(false);
    setLastAnnouncedPoseTime(null);
    setLastAnnouncedBreakTime(null);
    
    cleanupSession();
    
    if (isBreak) {
      console.log('Resuming break timer');
      setBreakTimeRemaining(lastPauseTime);
      timerRef.current = setInterval(() => {
        setBreakTimeRemaining((prev) => {
          console.log(`Break timer - Time remaining: ${prev}`);
          if (prev <= 0) {
            console.log('Break timer reached 0, waiting for manual navigation');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      try {
        Speech.speak('Resuming break.', {
          language: 'en',
          pitch: 1.0,
          rate: 0.8,
          onError: (error) => {
            console.error('Speech error:', error);
          },
        });
      } catch (error) {
        console.error('Speech initialization error:', error);
      }
    } else {
      console.log('Resuming pose timer');
      setTimeRemaining(lastPauseTime);
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          console.log(`Pose timer - Time remaining: ${prev}`);
          if (prev <= 0) {
            console.log('Pose timer reached 0, waiting for manual navigation');
            return 0;
          }
          if ([10, 5, 1].includes(prev) && prev !== lastAnnouncedPoseTime) {
            try {
              Speech.speak(`${prev} seconds remaining`, {
                language: 'en',
                pitch: 1.0,
                rate: 0.8,
                onError: (error) => {
                  console.error('Speech error:', error);
                },
              });
              setLastAnnouncedPoseTime(prev);
            } catch (error) {
              console.error('Speech initialization error:', error);
            }
          }
          return prev - 1;
        });
      }, 1000);

      if (currentPose) {
        try {
          Speech.speak(`Resuming. ${currentPose.name}. ${currentPose.instructions}`, {
            language: 'en',
            pitch: 1.0,
            rate: 0.8,
            onError: (error) => {
              console.error('Speech error:', error);
            },
          });
        } catch (error) {
          console.error('Speech initialization error:', error);
        }
      }
    }
  };

  const completeSession = () => {
    cleanupSession();
    setIsSessionActive(false);
    setIsPaused(false);
    setIsBreak(false);
    setCurrentPoseIndex(0);
    setCurrentPose(null);
    setTimeRemaining(0);
    setBreakTimeRemaining(5);
    setLastAnnouncedPoseTime(null);
    setLastAnnouncedBreakTime(null);

    Vibration.vibrate([0, 200, 100, 200]);
    try {
      Speech.speak('Congratulations! You have completed your yoga session.', {
        language: 'en',
        pitch: 1.0,
        rate: 0.8,
        onError: (error) => {
          console.error('Speech error:', error);
        },
      });
    } catch (error) {
      console.error('Speech initialization error:', error);
    }

    saveYogaData();
    setModalVisible(true);
  };

  const saveYogaData = async () => {
    if (!userId || !selectedSequence) {
      Alert.alert('Error', 'Missing user or session data.');
      return;
    }

    try {
      const goalRef = doc(db, 'users', userId, 'goals', '9');
      const goalDoc = await getDoc(goalRef);
      const sessionTimeCompleted = totalSessionTime;

      if (goalDoc.exists()) {
        const data = goalDoc.data();
        await updateDoc(goalRef, {
          totalSessions: (data.totalSessions || 0) + 1,
          completedTime: (data.completedTime || 0) + sessionTimeCompleted,
          lastCompletedLevel: selectedLevel,
          userId,
        });
      } else {
        await setDoc(goalRef, {
          totalSessions: 1,
          completedTime: sessionTimeCompleted,
          lastCompletedLevel: selectedLevel,
          userId,
        });
      }

      setTotalSessions(prev => prev + 1);
      setCompletedTime(prev => prev + sessionTimeCompleted);
    } catch (error) {
      console.error('Error saving yoga data:', error);
      Alert.alert('Error', 'Failed to save your yoga data');
    }
  };

  const resetProgress = async () => {
    if (!userId) {
      Alert.alert('Error', 'User not authenticated. Please log in.');
      return;
    }

    Alert.alert(
      'Reset Progress',
      'Are you sure you want to reset your yoga progress? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              const goalRef = doc(db, 'users', userId, 'goals', '9');
              await setDoc(goalRef, {
                totalSessions: 0,
                completedTime: 0,
                lastSession: '',
                userId,
              });

              setTotalSessions(0);
              setCompletedTime(0);
              Alert.alert('Success', 'Your yoga progress has been reset.');
            } catch (error) {
              console.error('Error resetting progress:', error);
              Alert.alert('Error', 'Failed to reset your progress.');
            }
          },
        },
      ]
    );
  };

  const showPoseInstructions = (pose: any) => {
    setCurrentPose(pose);
    setInstructionsVisible(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderPoseItem = ({ item, index }: { item: any; index: number }) => (
    <TouchableOpacity style={styles.poseItem} onPress={() => showPoseInstructions(item)}>
      <View style={styles.poseHeader}>
        <Text style={styles.poseName}>{item.name}</Text>
        <Text style={styles.poseSanskrit}>{item.sanskrit}</Text>
      </View>
      <Text style={styles.poseDuration}>{formatTime(item.duration)}</Text>
    </TouchableOpacity>
  );

  const calculateProgress = () => {
    if (!selectedSequence || selectedSequence.poses.length === 0) return 0;
    
    const totalPoses = selectedSequence.poses.length;
    const completedPoses = currentPoseIndex;
    
    let currentPoseProgress = 0;
    if (isBreak) {
      currentPoseProgress = 1;
    } else if (currentPose) {
      currentPoseProgress = 1 - (timeRemaining / currentPose.duration);
    }
    
    const progress = ((completedPoses + currentPoseProgress) / totalPoses) * 100;
    return progress > 100 ? 100 : progress;
  };

  if (isSessionActive) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{selectedSequence?.name}</Text>
        <Text style={styles.subtitle}>
          Pose {currentPoseIndex + 1}/{selectedSequence?.poses.length}: {currentPose?.name}
        </Text>

        <View style={styles.poseContainer}>
          {isBreak ? (
            <>
              <Text style={styles.poseNameLarge}>Break</Text>
              <Text style={styles.poseSanskritLarge}>Take a moment to rest</Text>
              <View style={styles.timerContainer}>
                <Text style={styles.timerText}>{formatTime(breakTimeRemaining)}</Text>
              </View>
              <Text style={styles.instructionsText}>Next pose: {findPoseById(selectedSequence.poses[currentPoseIndex + 1])?.name || 'Session Complete'}</Text>
            </>
          ) : (
            <>
              <Text style={styles.poseNameLarge}>{currentPose.name}</Text>
              <Text style={styles.poseSanskritLarge}>{currentPose.sanskrit}</Text>
              <View style={styles.timerContainer}>
                <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
              </View>
              <Text style={styles.instructionsText}>{currentPose.instructions}</Text>
            </>
          )}
        </View>

        <View style={styles.sessionControls}>
          <TouchableOpacity 
            style={styles.stopButton} 
            onPress={pauseSession}
          >
            <Text style={styles.buttonText}>Pause Session</Text>
          </TouchableOpacity>
          {isBreak ? (
            <TouchableOpacity 
              style={styles.nextButton} 
              onPress={advanceToNextPose}
            >
              <Text style={styles.buttonText}>End Break</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.nextButton} 
              onPress={startBreak}
            >
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${calculateProgress()}%` },
            ]}
          />
        </View>
      </View>
    );
  }

  if (selectedLevel && !isSessionActive) {
    const sequence = yogaSequences[selectedLevel];
    const sequencePoses = sequence.poses.map(id => findPoseById(id)).filter(pose => pose !== null);

    return (
      <View style={styles.container}>
        <Text style={styles.title}>{sequence.name}</Text>
        <Text style={styles.subtitle}>{sequence.description}</Text>

        <View style={styles.sequenceInfo}>
          <Text style={styles.infoText}>Duration: {sequence.duration} minutes</Text>
          <Text style={styles.infoText}>Benefits: {sequence.benefits}</Text>
          <Text style={styles.infoText}>Types: {sequence.types.join(', ')}</Text>
        </View>

        <FlatList
          data={sequencePoses}
          renderItem={renderPoseItem}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          style={styles.poseList}
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              setSelectedLevel(null);
              setSelectedSequence(null);
            }}
          >
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.startButton}
            onPress={startSession}
          >
            <Text style={styles.buttonText}>Start Session</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Yoga Journey</Text>
      <Text style={styles.subtitle}>Choose your practice level</Text>

      <View style={styles.statsContainer}>
        <Text style={styles.statLabel}>Total Sessions: {totalSessions}</Text>
        <Text style={styles.statLabel}>Total Practice Time: {formatTime(completedTime)}</Text>
      </View>

      <View style={styles.levelContainer}>
        <TouchableOpacity
          style={[styles.levelButton, styles.beginnerButton]}
          onPress={() => selectLevel('beginner')}
        >
          <Text style={styles.levelTitle}>Beginner</Text>
          <Text style={styles.levelSubtitle}>{yogaSequences.beginner.name}</Text>
          <Text style={styles.levelDuration}>{yogaSequences.beginner.duration} min</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.levelButton, styles.intermediateButton]}
          onPress={() => selectLevel('intermediate')}
        >
          <Text style={styles.levelTitle}>Intermediate</Text>
          <Text style={styles.levelSubtitle}>{yogaSequences.intermediate.name}</Text>
          <Text style={styles.levelDuration}>{yogaSequences.intermediate.duration} min</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.levelButton, styles.advancedButton]}
          onPress={() => selectLevel('advanced')}
        >
          <Text style={styles.levelTitle}>Advanced</Text>
          <Text style={styles.levelSubtitle}>{yogaSequences.advanced.name}</Text>
          <Text style={styles.levelDuration}>{yogaSequences.advanced.duration} min</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.resetButton} onPress={resetProgress}>
        <Text style={styles.resetButtonText}>Reset Progress</Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Session Complete!</Text>
            <Text style={styles.modalText}>
              Great job completing your {selectedLevel} yoga session!
            </Text>
            <Text style={styles.modalStats}>
              Total session time: {formatTime(totalSessionTime)}
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={instructionsVisible}
        onRequestClose={() => setInstructionsVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{currentPose?.name}</Text>
            <Text style={styles.poseSanskritLarge}>{currentPose?.sanskrit}</Text>
            <Text style={styles.modalText}>{currentPose?.instructions}</Text>
            <Text style={styles.modalStats}>
              Hold for: {formatTime(currentPose?.duration || 0)}
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setInstructionsVisible(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2D3748',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#718096',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  timerContainer: {
    alignItems: 'center',
    marginVertical: 20,
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  timerText: {
    fontSize: 56,
    fontWeight: '800',
    color: '#48BB78',
    letterSpacing: 1.2,
  },
  startButton: {
    backgroundColor: '#48BB78',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    width: 180,
    marginVertical: 10,
  },
  stopButton: {
    backgroundColor: '#F56565',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  nextButton: {
    backgroundColor: '#4299E1',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginLeft: 8,
  },
  sessionControls: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    marginVertical: 20,
  },
  secondaryButton: {
    backgroundColor: '#A0AEC0',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    width: 120,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statsContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '100%',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 16,
    color: '#4A5568',
    marginBottom: 8,
    fontWeight: '500',
  },
  resetButton: {
    backgroundColor: '#E53E3E',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    width: 160,
    marginTop: 20,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    width: '85%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2D3748',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#4A5568',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  modalStats: {
    fontSize: 16,
    fontWeight: '600',
    color: '#48BB78',
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: '#48BB78',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  levelContainer: {
    width: '100%',
    marginBottom: 24,
  },
  levelButton: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  beginnerButton: {
    backgroundColor: '#C6F6D5',
  },
  intermediateButton: {
    backgroundColor: '#FEEBC8',
  },
  advancedButton: {
    backgroundColor: '#FED7D7',
  },
  levelTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2D3748',
    marginBottom: 8,
  },
  levelSubtitle: {
    fontSize: 16,
    color: '#4A5568',
    marginBottom: 12,
    lineHeight: 20,
  },
  levelDuration: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
  },
  poseList: {
    width: '100%',
    maxHeight: 320,
    marginBottom: 24,
  },
  poseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  poseHeader: {
    flex: 1,
  },
  poseName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 4,
  },
  poseSanskrit: {
    fontSize: 14,
    color: '#718096',
    fontStyle: 'italic',
  },
  poseDuration: {
    fontSize: 16,
    fontWeight: '600',
    color: '#48BB78',
  },
  poseContainer: {
    alignItems: 'center',
    marginVertical: 20,
    width: '100%',
  },
  poseNameLarge: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2D3748',
    marginBottom: 8,
    textAlign: 'center',
  },
  poseSanskritLarge: {
    fontSize: 18,
    color: '#718096',
    fontStyle: 'italic',
    marginBottom: 16,
    textAlign: 'center',
  },
  instructionsText: {
    fontSize: 16,
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#48BB78',
    borderRadius: 4,
  },
  sequenceInfo: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  infoText: {
    fontSize: 16,
    color: '#4A5568',
    marginBottom: 8,
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
});