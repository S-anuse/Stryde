import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import * as Location from 'expo-location';
import { db, auth } from '../../firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

// Types
type RideData = {
  date: Date | Timestamp;
  distance: number; // in km
  duration: number; // in seconds
};

type Badge = {
  id: string;
  name: string;
  description: string;
  image: any;
  requirement: number;
  unlocked: boolean;
  unlockedAt?: Date | Timestamp;
};

type GoalData = {
  weeklyTarget: number;
  currentProgress: number;
  rides: RideData[];
  lastUpdated: Date | Timestamp | null;
  badges: Badge[];
  streakDays: number;
};

// Badges
const CYCLING_BADGES: Badge[] = [
  {
    id: 'badge1',
    name: 'First Ride',
    description: 'Complete your first ride',
    image: require('../../assets/logo.png'), // Replace with actual badge image
    requirement: 1, // sessions
    unlocked: false,
  },
  {
    id: 'badge2',
    name: 'Weekly Goal',
    description: 'Reach 20 km in a week',
    image: require('../../assets/logo.png'),
    requirement: 20, // km
    unlocked: false,
  },
  {
    id: 'badge3',
    name: 'Speed Star',
    description: 'Log a ride of 5 km or more',
    image: require('../../assets/logo.png'),
    requirement: 5, // km per ride
    unlocked: false,
  },
];

export default function CyclingGoal() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);
  const [currentRide, setCurrentRide] = useState<{
    distance: number;
    startTime: number;
    locations: Location.LocationObject[];
  } | null>(null);
  const [goalData, setGoalData] = useState<GoalData>({
    weeklyTarget: 20,
    currentProgress: 0,
    rides: [],
    lastUpdated: null,
    badges: CYCLING_BADGES,
    streakDays: 0,
  });
  const [roadWidth, setRoadWidth] = useState(0); // State to store roadContainer width

  const progressAnim = useSharedValue(0);

  const progressAnimStyle = useAnimatedStyle(() => ({
    width: `${(progressAnim.value / 20) * 100}%`,
  }));

  // Request location permissions
  useEffect(() => {
    const requestPermissions = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to track cycling.');
        setLocationPermission(false);
        return;
      }
      setLocationPermission(true);
    };
    requestPermissions();
  }, []);

  // Fetch goal data from Firebase
  useEffect(() => {
    const fetchGoalData = async () => {
      try {
        if (!auth.currentUser) {
          setLoading(false);
          return;
        }
        const userId = auth.currentUser.uid;
        const goalRef = doc(db, 'users', userId, 'goals', 'cycling');
        const goalSnap = await getDoc(goalRef);

        if (goalSnap.exists()) {
          const data = goalSnap.data();
          setGoalData({
            weeklyTarget: data.weeklyTarget || 20,
            currentProgress: data.currentProgress || 0,
            rides: data.rides || [],
            lastUpdated: data.lastUpdated || null,
            badges: data.badges || CYCLING_BADGES,
            streakDays: data.streakDays || 0,
          });
          progressAnim.value = withTiming(data.currentProgress || 0, { duration: 1000 });
        } else {
          const initialData = {
            weeklyTarget: 20,
            currentProgress: 0,
            rides: [],
            lastUpdated: serverTimestamp(),
            badges: CYCLING_BADGES,
            streakDays: 0,
          };
          await setDoc(goalRef, initialData);
          setGoalData({
            ...initialData,
            lastUpdated: new Date(),
          });
        }
      } catch (error) {
        console.error('Error fetching goal data:', error);
        Alert.alert('Error', 'Failed to load cycling goal.');
      } finally {
        setLoading(false);
      }
    };

    fetchGoalData();

    // Check for weekly reset
    const checkWeeklyReset = () => {
      if (goalData.lastUpdated) {
        const lastUpdated = goalData.lastUpdated instanceof Date
          ? goalData.lastUpdated
          : new Date((goalData.lastUpdated as Timestamp).toDate());
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        if (lastUpdated < oneWeekAgo) {
          resetWeeklyProgress();
        }
      }
    };

    checkWeeklyReset();
  }, []);

  // Start tracking
  const startTracking = async () => {
    if (!locationPermission) {
      Alert.alert('Permission Required', 'Please enable location permissions.');
      return;
    }
    try {
      setTracking(true);
      setCurrentRide({
        distance: 0,
        startTime: Date.now(),
        locations: [],
      });
      // Start location updates
      await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10, // Update every 10 meters
        },
        (location) => {
          setCurrentRide((prev) => {
            if (!prev) return prev;
            const newLocations = [...prev.locations, location];
            const newDistance = calculateDistance(newLocations);
            return {
              ...prev,
              locations: newLocations,
              distance: newDistance,
            };
          });
        }
      );
    } catch (error) {
      console.error('Error starting tracking:', error);
      Alert.alert('Error', 'Failed to start tracking.');
      setTracking(false);
    }
  };

  // Stop tracking
  const stopTracking = async () => {
    try {
      setTracking(false);
      if (!currentRide) return;

      const distance = currentRide.distance;
      const duration = (Date.now() - currentRide.startTime) / 1000; // in seconds

      if (distance < 0.1) {
        Alert.alert('Short Ride', 'Ride too short to log.');
        setCurrentRide(null);
        return;
      }

      const sessionData: RideData = {
        date: new Date(),
        distance,
        duration,
      };

      const newProgress = goalData.currentProgress + distance;

      if (auth.currentUser) {
        const userId = auth.currentUser.uid;
        const goalRef = doc(db, 'users', userId, 'goals', 'cycling');
        await updateDoc(goalRef, {
          currentProgress: newProgress,
          rides: arrayUnion(sessionData),
          lastUpdated: serverTimestamp(),
        });
      }

      setGoalData((prev) => ({
        ...prev,
        currentProgress: newProgress,
        rides: [...prev.rides, sessionData],
        lastUpdated: new Date(),
      }));

      progressAnim.value = withTiming(newProgress, { duration: 500 });
      setCurrentRide(null);

      // Check badges
      if (newProgress >= goalData.weeklyTarget) {
        unlockBadge('badge2');
        Alert.alert('Goal Achieved!', 'You reached 20 km this week!');
      }
      if (distance >= 5) {
        unlockBadge('badge3');
      }
      if (goalData.rides.length === 0) {
        unlockBadge('badge1');
      }

      checkStreak();
    } catch (error) {
      console.error('Error stopping tracking:', error);
      Alert.alert('Error', 'Failed to log ride.');
    }
  };

  // Calculate distance from locations
  const calculateDistance = (locations: Location.LocationObject[]): number => {
    if (locations.length < 2) return 0;
    let totalDistance = 0;

    for (let i = 1; i < locations.length; i++) {
      const prev = locations[i - 1];
      const curr = locations[i];
      const distance = getDistance(
        prev.coords.latitude,
        prev.coords.longitude,
        curr.coords.latitude,
        curr.coords.longitude
      );
      totalDistance += distance;
    }

    return totalDistance / 1000; // Convert to km
  };

  // Haversine formula to calculate distance between two points
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // Reset weekly progress
  const resetWeeklyProgress = async () => {
    try {
      if (!auth.currentUser) return;
      const userId = auth.currentUser.uid;
      const goalRef = doc(db, 'users', userId, 'goals', 'cycling');
      await updateDoc(goalRef, {
        currentProgress: 0,
        rides: [],
        lastUpdated: serverTimestamp(),
      });

      setGoalData((prev) => ({
        ...prev,
        currentProgress: 0,
        rides: [],
        lastUpdated: new Date(),
      }));

      progressAnim.value = withTiming(0, { duration: 500 });

      if (goalData.currentProgress >= goalData.weeklyTarget) {
        unlockBadge('badge2');
      }
    } catch (error) {
      console.error('Error resetting progress:', error);
      Alert.alert('Error', 'Failed to reset progress.');
    }
  };

  // Unlock badge
  const unlockBadge = async (badgeId: string) => {
    try {
      const badgeIndex = goalData.badges.findIndex((badge) => badge.id === badgeId);
      if (badgeIndex === -1 || goalData.badges[badgeIndex].unlocked) return;

      const updatedBadges = [...goalData.badges];
      updatedBadges[badgeIndex] = {
        ...updatedBadges[badgeIndex],
        unlocked: true,
        unlockedAt: new Date(),
      };

      setGoalData((prev) => ({ ...prev, badges: updatedBadges }));

      if (auth.currentUser) {
        const userId = auth.currentUser.uid;
        const goalRef = doc(db, 'users', userId, 'goals', 'cycling');
        await updateDoc(goalRef, { badges: updatedBadges });
      }

      Alert.alert(
        'Badge Unlocked!',
        `You earned "${updatedBadges[badgeIndex].name}": ${updatedBadges[badgeIndex].description}`
      );
    } catch (error) {
      console.error('Error unlocking badge:', error);
    }
  };

  // Check streak
  const checkStreak = async () => {
    try {
      if (!auth.currentUser) return;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      const ridesToday = goalData.rides.some((ride) => {
        const rideDate = getRideDate(ride);
        return rideDate.toDateString() === today.toDateString();
      });

      const ridesYesterday = goalData.rides.some((ride) => {
        const rideDate = getRideDate(ride);
        return rideDate.toDateString() === yesterday.toDateString();
      });

      let newStreakDays = goalData.streakDays;
      if (ridesToday && (ridesYesterday || goalData.streakDays === 0)) {
        newStreakDays = goalData.streakDays + 1;
      } else if (!ridesYesterday) {
        newStreakDays = 0;
      }

      if (newStreakDays !== goalData.streakDays) {
        setGoalData((prev) => ({ ...prev, streakDays: newStreakDays }));
        const userId = auth.currentUser.uid;
        const goalRef = doc(db, 'users', userId, 'goals', 'cycling');
        await updateDoc(goalRef, {
          streakDays: newStreakDays,
          lastUpdated: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error checking streak:', error);
    }
  };

  // Helper function to handle Date/Timestamp
  const getRideDate = (ride: RideData): Date => {
    if (ride.date instanceof Date) {
      return ride.date;
    } else if ('seconds' in ride.date) {
      return new Date(ride.date.seconds * 1000);
    }
    return new Date();
  };

  // Format date
  const formatDate = (date: Date | Timestamp): string => {
    const dateObj = date instanceof Date ? date : new Date((date as Timestamp).seconds * 1000);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    };
    return dateObj.toLocaleString('en-US', options);
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours ? `${hours}h ` : ''}${minutes}m ${secs}s`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Cycle 20 km Weekly</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Motivational Quote */}
        <View style={styles.quoteContainer}>
          <Text style={styles.quoteText}>
            "Keep pedaling, you're closer to your goal!"
          </Text>
        </View>

        {/* Progress Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Progress</Text>
          <View
            style={styles.roadContainer}
            onLayout={(event) => setRoadWidth(event.nativeEvent.layout.width)} // Measure width dynamically
          >
            <Animated.View style={[styles.roadProgress, progressAnimStyle]}>
              <LinearGradient
                colors={['#4CAF50', '#81C784']}
                style={{ width: '100%', height: '100%' }}
              />
            </Animated.View>
            {[5, 10, 15, 20].map((km) => {
              // Adjust left position to center the milestone and keep it within bounds
              const baseLeft = (km / 20) * 100;
              let adjustedLeft = baseLeft;
              const milestoneWidth = 50; // Width of milestone
              // Center the milestone by subtracting half its width (in percentage)
              adjustedLeft = baseLeft - ((milestoneWidth / 2) / (roadWidth || 1)) * 100;
              // Ensure the milestone stays within bounds
              if (km === 20) {
                adjustedLeft = Math.min(adjustedLeft, 94); // Pull 20 km milestone inward
              } else if (km === 5) {
                adjustedLeft = Math.max(adjustedLeft, 2); // Keep 5 km milestone from going too far left
              }
              return (
                <View
                  key={km}
                  style={[styles.milestone, { left: `${adjustedLeft}%` }]}
                >
                  <Ionicons
                    name={goalData.currentProgress >= km ? 'bicycle' : 'flag-outline'}
                    size={20}
                    color={goalData.currentProgress >= km ? '#4CAF50' : '#666'}
                  />
                  <Text style={styles.milestoneText}>{km} km</Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.progressText}>
            {goalData.currentProgress.toFixed(1)} / 20 km
          </Text>
          <Text style={styles.streakText}>
            Streak: {goalData.streakDays} days 🔥
          </Text>
        </View>

        {/* Tracking Control */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Track Your Ride</Text>
          {tracking && currentRide ? (
            <View style={styles.trackingInfo}>
              <Text style={styles.trackingText}>
                Distance: {currentRide.distance.toFixed(2)} km
              </Text>
              <Text style={styles.trackingText}>
                Time: {formatDuration((Date.now() - currentRide.startTime) / 1000)}
              </Text>
            </View>
          ) : null}
          <Pressable
            style={[styles.trackButton, tracking && styles.stopButton]}
            onPress={tracking ? stopTracking : startTracking}
          >
            <Text style={styles.buttonText}>
              {tracking ? 'Stop Tracking' : 'Start Tracking'}
            </Text>
          </Pressable>
        </View>

        {/* Badges Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Achievements</Text>
          <View style={styles.badgesRow}>
            {goalData.badges.map((badge) => (
              <View key={badge.id} style={styles.badgeItem}>
                <Image
                  source={badge.image}
                  style={[styles.badgeImage, !badge.unlocked && styles.lockedBadge]}
                />
                <Text style={styles.badgeName}>{badge.name}</Text>
                {!badge.unlocked && (
                  <Text style={styles.badgeProgress}>
                    {badge.id === 'badge1' &&
                      `Rides: ${goalData.rides.length}/${badge.requirement}`}
                    {badge.id === 'badge2' &&
                      `Progress: ${goalData.currentProgress.toFixed(1)}/${
                        badge.requirement
                      } km`}
                    {badge.id === 'badge3' &&
                      `Max Ride: ${Math.max(
                        ...goalData.rides.map((r) => r.distance || 0),
                        0
                      ).toFixed(1)}/${badge.requirement} km`}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* History Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ride History</Text>
          {goalData.rides.length === 0 ? (
            <Text style={styles.emptyText}>No rides yet. Start tracking!</Text>
          ) : (
            goalData.rides.map((ride, index) => (
              <View key={index} style={styles.historyItem}>
                <Text style={styles.historyDate}>{formatDate(ride.date)}</Text>
                <Text style={styles.historyDetail}>
                  Distance: {ride.distance.toFixed(2)} km
                </Text>
                <Text style={styles.historyDetail}>
                  Duration: {formatDuration(ride.duration)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Reset Button */}
      <Pressable style={styles.resetButton} onPress={resetWeeklyProgress}>
        <Text style={styles.resetButtonText}>Reset Weekly Progress</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#4CAF50',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  quoteContainer: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    margin: 16,
  },
  quoteText: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#4CAF50',
    textAlign: 'center',
  },
  roadContainer: {
    height: 40,
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    position: 'relative',
    overflow: 'visible',
  },
  roadProgress: {
    height: '100%',
    borderRadius: 8,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  milestone: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
    width: 50,
    zIndex: 1,
  },
  milestoneText: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'bold',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  progressText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginTop: 12,
  },
  streakText: {
    fontSize: 14,
    color: '#FFA726',
    textAlign: 'center',
    marginTop: 8,
  },
  trackButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#FF6666',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  trackingInfo: {
    marginBottom: 12,
  },
  trackingText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  badgeItem: {
    alignItems: 'center',
    width: '30%',
  },
  badgeImage: {
    width: 50,
    height: 50,
    marginBottom: 8,
  },
  lockedBadge: {
    opacity: 0.5,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  badgeProgress: {
    fontSize: 10,
    color: '#4CAF50',
    textAlign: 'center',
  },
  historyItem: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  historyDetail: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  resetButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: 16,
  },
  resetButtonText: {
    color: '#FF6666',
    fontSize: 14,
    paddingLeft:50,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
});