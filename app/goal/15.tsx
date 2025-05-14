import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { db, auth } from '../../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import * as Location from 'expo-location';

interface Session {
  distance: number;
  duration: number; // in seconds
  timestamp: string;
  notes: string;
  route?: { latitude: number; longitude: number }[];
}

export default function HikingGoalScreen() {
  const router = useRouter();
  const [weeklyDistance, setWeeklyDistance] = useState(0); // In km
  const [sessions, setSessions] = useState<Session[]>([]);
  const weeklyTarget = 10; // km for hiking
  const progressPercentage = Math.min((weeklyDistance / weeklyTarget) * 100, 100);
  
  // Active challenge tracking states
  const [isTracking, setIsTracking] = useState(false);
  const [currentDistance, setCurrentDistance] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [locationSubscription, setLocationSubscription] = useState<any>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<{latitude: number; longitude: number}[]>([]);
  const [lastPosition, setLastPosition] = useState<{latitude: number; longitude: number} | null>(null);

  useEffect(() => {
    const loadHikingData = async () => {
      if (!auth.currentUser) return;

      try {
        const userGoalRef = doc(db, 'users', auth.currentUser.uid, 'goals', '15');
        const goalDoc = await getDoc(userGoalRef);

        if (goalDoc.exists()) {
          const data = goalDoc.data();
          setWeeklyDistance(data.weeklyDistance || 0);
          setSessions(data.sessions || []);
        }
      } catch (error) {
        console.error('Error loading hiking data:', error);
      }
    };

    loadHikingData();
  }, []);

  // Timer for tracking elapsed time during active challenge
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (isTracking && startTime) {
      intervalId = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isTracking, startTime]);

  const startChallenge = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to track your hike');
        return;
      }

      // Get initial position
      const initialPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      
      const initialCoords = {
        latitude: initialPosition.coords.latitude,
        longitude: initialPosition.coords.longitude,
      };
      
      setRouteCoordinates([initialCoords]);
      setLastPosition(initialCoords);
      setStartTime(new Date());
      setIsTracking(true);
      setCurrentDistance(0);
      setElapsedTime(0);

      // Subscribe to location updates
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 10,
          timeInterval: 5000,
        },
        (location) => {
          const newCoords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          
          setRouteCoordinates(prev => [...prev, newCoords]);
          
          if (lastPosition) {
            const incrementalDistance = calculateDistance(
              lastPosition.latitude,
              lastPosition.longitude,
              newCoords.latitude,
              newCoords.longitude
            );
            
            setCurrentDistance(prev => prev + incrementalDistance);
          }
          
          setLastPosition(newCoords);
        }
      );
      
      setLocationSubscription(subscription);
      
    } catch (error) {
      console.error('Error starting tracking:', error);
      Alert.alert('Error', 'Failed to start tracking. Please try again.');
    }
  };

  const stopChallenge = async () => {
    if (locationSubscription) {
      locationSubscription.remove();
    }
    
    setIsTracking(false);
    const endTime = new Date();
    const duration = startTime ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000) : 0;
    const finalDistance = parseFloat(currentDistance.toFixed(2));
    
    const newSession: Session = {
      distance: finalDistance,
      duration: duration,
      timestamp: new Date().toISOString(),
      notes: '',
      route: routeCoordinates,
    };
    
    const newTotalDistance = weeklyDistance + finalDistance;
    setWeeklyDistance(newTotalDistance);
    
    const updatedSessions = [...sessions, newSession];
    setSessions(updatedSessions);
    
    if (finalDistance >= 10) {
      Alert.alert(
        '🏆 Congratulations!', 
        `You've completed a ${finalDistance.toFixed(2)} km hike and reached your goal!`,
        [{ text: 'Awesome!', style: 'default' }]
      );
    } else {
      Alert.alert(
        'Hike Completed', 
        `You've hiked ${finalDistance.toFixed(2)} km. Keep going to reach your 10 km weekly goal!`,
        [{ text: 'OK', style: 'default' }]
      );
    }
    
    try {
      if (auth.currentUser) {
        await setDoc(
          doc(db, 'users', auth.currentUser.uid, 'goals', '15'),
          {
            weeklyDistance: newTotalDistance,
            sessions: updatedSessions,
            lastUpdated: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch (error) {
      console.error('Error saving hiking session:', error);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
  };

  const deg2rad = (deg: number) => {
    return deg * (Math.PI/180);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string): string => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const resetWeekly = async () => {
    setWeeklyDistance(0);
    setSessions([]);

    try {
      if (auth.currentUser) {
        await setDoc(
          doc(db, 'users', auth.currentUser.uid, 'goals', '15'),
          {
            weeklyDistance: 0,
            sessions: [],
            lastUpdated: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch (error) {
      console.error('Error resetting hiking data:', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>← Back</Text>
      </Pressable>

      <Image source={require('../../assets/hiking.png')} style={styles.headerImage} />
      <Text style={styles.title}>Weekend Hiking Challenge</Text>

      <View style={styles.progressContainer}>
        <Text style={styles.progressLabel}>
          Weekly Progress: {weeklyDistance.toFixed(1)} / {weeklyTarget} km
        </Text>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBar, { width: `${progressPercentage}%` }]} />
        </View>
        <Text style={styles.progressText}>{progressPercentage.toFixed(0)}% Complete</Text>
      </View>

      {progressPercentage >= 100 && (
        <View style={styles.achievementBanner}>
          <Text style={styles.achievementText}>🏆 Weekend Goal Achieved! 🏆</Text>
        </View>
      )}

      {isTracking ? (
        <View style={styles.trackingContainer}>
          <View style={styles.trackingStats}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Distance</Text>
              <Text style={styles.statValue}>{currentDistance.toFixed(2)} km</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Time</Text>
              <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
            </View>
          </View>
          <Pressable style={styles.stopButton} onPress={stopChallenge}>
            <Text style={styles.buttonText}>Stop Challenge</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.challengeContainer}>
          <Pressable style={styles.startButton} onPress={startChallenge}>
            <Text style={styles.buttonText}>Start Challenge</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>This Weekend's Activity</Text>

        {sessions.length === 0 ? (
          <Text style={styles.noSessionsText}>No hiking sessions recorded yet this weekend</Text>
        ) : (
          sessions.map((session, index) => (
            <View key={index} style={styles.sessionItem}>
              <View style={styles.sessionHeader}>
                <Text style={styles.sessionDistance}>{session.distance.toFixed(1)} km</Text>
                <Text style={styles.sessionDate}>{formatDate(session.timestamp)}</Text>
              </View>
              {session.duration > 0 && (
                <Text style={styles.sessionDuration}>Duration: {formatTime(session.duration)}</Text>
              )}
              {session.notes ? (
                <Text style={styles.sessionNotes}>{session.notes}</Text>
              ) : null}
            </View>
          ))
        )}
      </View>

      <View style={styles.tipsContainer}>
        <Text style={styles.tipsTitle}>Hiking Tips</Text>
        <Text style={styles.tipText}>• Plan your route in advance</Text>
        <Text style={styles.tipText}>• Wear appropriate footwear</Text>
        <Text style={styles.tipText}>• Carry enough water and snacks</Text>
        <Text style={styles.tipText}>• Check weather conditions before hiking</Text>
      </View>

      <Pressable style={styles.resetButton} onPress={resetWeekly}>
        <Text style={styles.resetButtonText}>Reset Weekly Progress</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '500',
  },
  headerImage: {
    width: 100,
    height: 100,
    alignSelf: 'center',
    marginBottom: 16,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    color: '#333',
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressLabel: {
    fontSize: 16,
    marginBottom: 8,
    color: '#555',
  },
  progressBarBackground: {
    height: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'right',
  },
  achievementBanner: {
    backgroundColor: '#FFD700',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    alignItems: 'center',
  },
  achievementText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  challengeContainer: {
    marginBottom: 24,
  },
  startButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  trackingContainer: {
    marginBottom: 24,
  },
  trackingStats: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  stopButton: {
    backgroundColor: '#F44336',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  summaryContainer: {
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  noSessionsText: {
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  sessionItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    alignItems: 'center',
  },
  sessionDistance: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  sessionDate: {
    fontSize: 14,
    color: '#666',
    maxWidth: '60%', // Prevent overlap
    textAlign: 'right',
  },
  sessionDuration: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
    marginTop: 8, // Add spacing to avoid overlap
  },
  sessionNotes: {
    fontSize: 14,
    color: '#555',
    fontStyle: 'italic',
  },
  tipsContainer: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  tipText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
    lineHeight: 20,
  },
  resetButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 32,
  },
  resetButtonText: {
    color: '#FF6666', // Light red color
    fontSize: 14,
    textAlign: 'center',
  },
});