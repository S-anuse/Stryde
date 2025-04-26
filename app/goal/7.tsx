import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, Animated, StyleSheet, Vibration, Dimensions, Alert, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesome5 } from '@expo/vector-icons';
import { ACHIEVEMENTS } from '../../constants/achievements';

const dropImage = require('../../assets/drop.png');
const waterDropAnimation = require('../../assets/water-drop.json');
const celebrationAnimation = require('../../assets/celebration.json');
const { width } = Dimensions.get('window');

// Extend ACHIEVEMENTS to include the new 4th achievement
const ACHIEVEMENTS_WITH_NEW = {
  ...ACHIEVEMENTS,
  HYDRATION_MASTER: 'hydration_master',
};

export default function WaterChallenge() {
  const [waterCount, setWaterCount] = useState(0);
  const [showBadge, setShowBadge] = useState(false);
  const [streak, setStreak] = useState(0);
  const [lastDrink, setLastDrink] = useState<string | null>(null); // Explicitly type as string | null
  const [goal, setGoal] = useState(3000); // Default 3 liters
  const [glassSize, setGlassSize] = useState(250); // Default 250ml
  const [showAnimation, setShowAnimation] = useState(false);
  const [achievements, setAchievements] = useState<Array<'first_glass' | 'halfway' | 'daily_goal' | 'three_day_streak' | 'hydration_master'>>([]);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fillAnim = useRef(new Animated.Value(0)).current;
  const dropAnim = useRef(new Animated.Value(0)).current;
  const lottieRef = useRef<LottieView>(null);
  const celebrationRef = useRef<LottieView>(null);

  useEffect(() => {
    loadData();
    checkForNewDay();
  }, []);

  useEffect(() => {
    saveData();

    const progress = (waterCount * glassSize) / goal;
    Animated.timing(fillAnim, {
      toValue: progress > 1 ? 1 : progress,
      duration: 500,
      useNativeDriver: false,
    }).start();

    checkAchievements();
  }, [waterCount]);

  const loadData = async () => {
    try {
      const savedData = await AsyncStorage.getItem('waterChallengeData');
      if (savedData) {
        const data = JSON.parse(savedData);
        setWaterCount(data.waterCount || 0);
        setStreak(data.streak || 0);
        setLastDrink(data.lastDrink); // Can be null or string
        setGoal(data.goal || 3000);
        setAchievements(data.achievements || []);

        const progress = (data.waterCount * glassSize) / (data.goal || 3000);
        fillAnim.setValue(progress > 1 ? 1 : progress);
      }
    } catch (error) {
      console.log('Error loading data:', error);
    }
  };

  const saveData = async () => {
    try {
      const now = new Date().toISOString();
      await AsyncStorage.setItem('waterChallengeData', JSON.stringify({
        waterCount,
        streak,
        lastDrink: now,
        goal,
        achievements,
      }));
    } catch (error) {
      console.log('Error saving data:', error);
    }
  };

  const checkForNewDay = () => {
    if (!lastDrink) {
      setLastDrink(new Date().toISOString()); // Initialize lastDrink if null
      return;
    }

    const lastDate = new Date(lastDrink);
    const today = new Date();

    if (lastDate.getDate() !== today.getDate() || 
        lastDate.getMonth() !== today.getMonth() || 
        lastDate.getFullYear() !== today.getFullYear()) {
      // Reset everything for a fresh start on a new day
      setWaterCount(0);
      setStreak(0); // Reset streak if day is skipped
      setAchievements([]);
      fillAnim.setValue(0);
      setShowBadge(false);
      setLastDrink(today.toISOString()); // Update lastDrink to today
    } else if (lastDate.getDate() === today.getDate() - 1 && 
               lastDate.getMonth() === today.getMonth() && 
               lastDate.getFullYear() === today.getFullYear()) {
      // Increment streak if used on the next day
      setStreak(prev => prev + 1);
      setLastDrink(today.toISOString()); // Update lastDrink to today
    }
  };

  const checkAchievements = () => {
    const newAchievements = [...achievements];
    const waterAmount = waterCount * glassSize;

    if (waterCount === 1 && !achievements.includes('first_glass')) {
      newAchievements.push('first_glass');
    }

    if (waterAmount >= goal / 2 && !achievements.includes('halfway')) {
      newAchievements.push('halfway');
    }

    if (waterAmount >= goal && !achievements.includes('daily_goal')) {
      newAchievements.push('daily_goal');
      if (streak === 2 && !achievements.includes('three_day_streak')) {
        newAchievements.push('three_day_streak');
      }
      if (streak === 4 && !achievements.includes('hydration_master')) {
        newAchievements.push('hydration_master');
      }
    }

    setAchievements(newAchievements);
  };

  const addGlass = () => {
    dropAnim.setValue(0);
    Animated.timing(dropAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    setShowAnimation(true);
    if (lottieRef.current) {
      lottieRef.current.play();
    }

    const waterAmount = waterCount * glassSize;
    if (waterAmount >= goal) {
      Alert.alert("Goal Achieved!", "No more increments needed today.");
      return;
    }

    const newCount = waterCount + 1;
    setWaterCount(newCount);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (newCount * glassSize >= goal && !showBadge) {
      setShowBadge(true);
      // Streak increment is handled in checkForNewDay, not here

      if (celebrationRef.current) {
        celebrationRef.current.play();
      }
      Vibration.vibrate([0, 80, 60, 80]);

      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => {
          setShowBadge(false);
          scaleAnim.setValue(0);
        }, 3000);
      });
    }

    setTimeout(() => {
      setShowAnimation(false);
    }, 1500);
  };

  const resetCount = () => {
    setWaterCount(0);
    setShowBadge(false);
    setStreak(0);
    setAchievements([]);
    scaleAnim.setValue(0);
  };

  const progress = (waterCount * glassSize) / goal;
  const glassesLeft = Math.max(0, Math.ceil((goal - waterCount * glassSize) / glassSize));

  const renderAchievementBadge = (type: 'first_glass' | 'halfway' | 'daily_goal' | 'three_day_streak' | 'hydration_master') => {
    const isUnlocked = achievements.includes(type);
    const icons = {
      'first_glass': "tint",
      'halfway': "flag-checkered",
      'daily_goal': "trophy",
      'three_day_streak': "fire",
      'hydration_master': "crown",
    };

    const names = {
      'first_glass': "First Sip",
      'halfway': "Halfway There",
      'daily_goal': "Goal Crusher",
      'three_day_streak': "On Fire",
      'hydration_master': "Hydration Master",
    };

    return (
      <View style={[styles.achievementBadge, !isUnlocked && styles.lockedBadge]}>
        <FontAwesome5 
          name={icons[type]} 
          size={24} 
          color={isUnlocked ? "#2196F3" : "#ccc"} 
        />
        <Text style={[styles.badgeName, !isUnlocked && styles.lockedText]}>
          {names[type]}
        </Text>
      </View>
    );
  };

  const getMotivationalMessage = () => {
    if (progress >= 1) return "Excellent job! You've hit your daily goal!";
    if (progress >= 0.75) return "Almost there! Keep going strong!";
    if (progress >= 0.5) return "Halfway there! You're doing great!";
    if (progress >= 0.25) return "Good start! Keep drinking!";
    return "Time to hydrate! Your body will thank you.";
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <LinearGradient
        colors={['#E0F7FA', '#B2EBF2', '#80DEEA']}
        style={styles.background}
      />
      
      <View style={styles.headerContainer}>
        <Image source={dropImage} style={styles.image} />
        <Text style={styles.title}>Hydration Challenge</Text>
      </View>
      
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Today</Text>
          <Text style={styles.statValue}>{waterCount * glassSize}ml</Text>
          <Text style={styles.statSubtext}>of {goal}ml</Text>
        </View>
        
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Streak</Text>
          <Text style={styles.statValue}>{streak}</Text>
          <Text style={styles.statSubtext}>days</Text>
        </View>
        
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Left</Text>
          <Text style={styles.statValue}>{glassesLeft}</Text>
          <Text style={styles.statSubtext}>glasses</Text>
        </View>
      </View>
      
      <Text style={styles.motivationText}>{getMotivationalMessage()}</Text>
      
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBar}>
          <Animated.View 
            style={[
              styles.progressFill, 
              { width: fillAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%']
              }) }
            ]} 
          />
        </View>
        <View style={styles.progressMarkersContainer}>
          {[0.25, 0.5, 0.75, 1].map((marker, index) => (
            <View 
              key={index}
              style={[
                styles.progressMarker,
                { left: `${marker * 100}%` },
                progress >= marker && styles.achievedMarker
              ]}
            />
          ))}
        </View>
      </View>
      
      {showBadge && (
        <Animated.View 
          style={[
            styles.badge, 
            { transform: [{ scale: scaleAnim }] }
          ]}
        >
          <Text style={styles.badgeText}>Water Warrior!</Text>
          <Text style={styles.badgeSubtext}>Daily Goal Achieved</Text>
          
          {celebrationRef && (
            <LottieView
              ref={celebrationRef}
              source={celebrationAnimation}
              style={styles.celebrationAnimation}
              autoPlay={false}
              loop={false}
            />
          )}
        </Animated.View>
      )}
      
      <TouchableOpacity 
        style={styles.addButton}
        onPress={addGlass}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={['#4FC3F7', '#29B6F6', '#03A9F4']}
          style={styles.buttonGradient}
        >
          <FontAwesome5 name="plus" size={16} color="#fff" style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Add Glass ({glassSize}ml)</Text>
        </LinearGradient>
      </TouchableOpacity>
      
      {showAnimation && lottieRef && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <LottieView
            ref={lottieRef}
            source={waterDropAnimation}
            style={styles.waterAnimation}
            autoPlay={false}
            loop={false}
          />
        </View>
      )}
      
      <Animated.View 
        style={[
          styles.floatingDrop,
          {
            transform: [
              { 
                translateY: dropAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 100]
                })
              },
              {
                scale: dropAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [1, 1.2, 0]
                })
              }
            ],
            opacity: dropAnim.interpolate({
              inputRange: [0, 0.8, 1],
              outputRange: [1, 1, 0]
            })
          }
        ]}
      >
        <FontAwesome5 name="tint" size={24} color="#29B6F6" />
      </Animated.View>
      
      <View style={styles.achievementsContainer}>
        <Text style={styles.achievementsTitle}>Achievements</Text>
        <View style={styles.badgesContainer}>
          {renderAchievementBadge('first_glass')}
          {renderAchievementBadge('halfway')}
          {renderAchievementBadge('daily_goal')}
          {renderAchievementBadge('three_day_streak')}
          {renderAchievementBadge('hydration_master')}
        </View>
      </View>
      
      <TouchableOpacity 
        style={styles.resetButton}
        onPress={resetCount}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={['#87CEEB', '#00B7EB', '#00BFFF']} // Sky blue gradient
          style={styles.buttonGradient}
        >
          <Text style={styles.resetButtonText}>Reset Today's Count</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    // Removed padding to eliminate extra space
  },
  contentContainer: {
    alignItems: 'center',
    paddingHorizontal: 20, // Added horizontal padding only where needed
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  image: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0277BD',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 10,
    padding: 10,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statLabel: {
    fontSize: 14,
    color: '#0277BD',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#01579B',
  },
  statSubtext: {
    fontSize: 12,
    color: '#0288D1',
  },
  motivationText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#01579B',
    marginBottom: 15,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    marginBottom: 30,
  },
  progressBar: {
    height: 20,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#03A9F4',
    borderRadius: 10,
  },
  progressMarkersContainer: {
    position: 'relative',
    height: 20,
    width: '100%',
  },
  progressMarker: {
    position: 'absolute',
    width: 8,
    height: 8,
    backgroundColor: '#B3E5FC',
    borderRadius: 4,
    bottom: 10,
    marginLeft: -4,
  },
  achievedMarker: {
    backgroundColor: '#0288D1',
  },
  addButton: {
    width: '80%',
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
  },
  buttonGradient: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonIcon: {
    marginRight: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  waterAnimation: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  floatingDrop: {
    position: 'absolute',
    top: '40%',
  },
  badge: {
    position: 'absolute',
    top: '40%',
    zIndex: 10,
    backgroundColor: '#FFD54F',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  badgeText: {
    color: '#E65100',
    fontSize: 24,
    fontWeight: 'bold',
  },
  badgeSubtext: {
    color: '#E65100',
    fontSize: 16,
  },
  celebrationAnimation: {
    position: 'absolute',
    width: 200,
    height: 200,
  },
  achievementsContainer: {
    width: '100%',
    marginTop: 10,
    marginBottom: 20,
  },
  achievementsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0277BD',
    marginBottom: 10,
  },
  badgesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  achievementBadge: {
    width: width / 2 - 30,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  lockedBadge: {
    backgroundColor: 'rgba(240, 240, 240, 0.8)',
  },
  badgeName: {
    marginTop: 5,
    fontSize: 14,
    fontWeight: '500',
    color: '#0277BD',
  },
  lockedText: {
    color: '#9E9E9E',
  },
  resetButton: {
    width: '80%',
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    marginTop: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});