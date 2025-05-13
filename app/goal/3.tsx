import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Linking, Platform, SafeAreaView, StatusBar } from 'react-native';
import * as Progress from 'react-native-progress';
import Modal from 'react-native-modal';
import { Share } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/firebase';
import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import stepCounter from '../../services/stepCounter';
import { useRouter } from 'expo-router';
import { Pedometer } from 'expo-sensors';
import { Ionicons } from '@expo/vector-icons';
import WebView from 'react-native-webview';
import * as Location from 'expo-location';

// Define a type for location objects with specific icon names
type LocationType = {
  name: string;
  stepsrequired: number;
  lat: number;
  lng: number;
  icon: 'leaf' | 'heart' | 'walk' | 'checkmark-circle';
};

// Define a type for coordinates
type Coordinate = {
  latitude: number;
  longitude: number;
};

export default function Goal3() {
  const [steps, setSteps] = useState(90); // Setting initial steps for demo
  const [isModalVisible, setModalVisible] = useState(false);
  const [unlockedLocation, setUnlockedLocation] = useState('');
  const [hasPedometerPermission, setHasPedometerPermission] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [distance, setDistance] = useState(0);
  const [pace, setPace] = useState('0:00');
  const [workoutStartTime, setWorkoutStartTime] = useState<Date | null>(null);
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const locations: LocationType[] = [
    { name: 'Yosemite', stepsrequired: 10000, lat: 37.8651, lng: -119.5383, icon: 'leaf' },
    { name: 'Paris', stepsrequired: 25000, lat: 48.8566, lng: 2.3522, icon: 'heart' },
  ];

  // Request pedometer permissions
  useEffect(() => {
    const requestPedometerPermission = async () => {
      try {
        const { granted } = await Pedometer.requestPermissionsAsync();
        if (granted) {
          setHasPedometerPermission(true);
          console.log('Pedometer permission granted');
        } else {
          setHasPedometerPermission(false);
          console.log('Pedometer permission denied');
          Alert.alert(
            'Permission Required',
            'This feature requires pedometer access to count your steps. Please enable it in settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => {
                  if (Platform.OS === 'android') {
                    Linking.openSettings();
                  } else {
                    Linking.openURL('app-settings:');
                  }
                },
              },
            ]
          );
        }
      } catch (error) {
        console.error('Error requesting pedometer permission:', error);
        setHasPedometerPermission(false);
        Alert.alert('Error', 'Failed to request pedometer permission. Please try again.');
      }
    };
    requestPedometerPermission();
  }, []);

  // Request location permissions
  useEffect(() => {
    const requestLocationPermission = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          setHasLocationPermission(true);
          console.log('Location permission granted');
          const location = await Location.getCurrentPositionAsync({});
          setCurrentLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        } else {
          setHasLocationPermission(false);
          console.log('Location permission denied');
          Alert.alert(
            'Permission Required',
            'This feature requires location access to show your position on the map. Please enable it in settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => {
                  if (Platform.OS === 'android') {
                    Linking.openSettings();
                  } else {
                    Linking.openURL('app-settings:');
                  }
                },
              },
            ]
          );
        }
      } catch (error) {
        console.error('Error requesting location permission:', error);
        setHasLocationPermission(false);
        Alert.alert('Error', 'Failed to request location permission. Please try again.');
      }
    };
    requestLocationPermission();
  }, []);

  // Subscribe to step counter updates
  useEffect(() => {
    if (!hasPedometerPermission) return;

    const subscription = stepCounter.subscribe((stepCount: number) => {
      console.log('Step count updated:', stepCount);
      setSteps(stepCount);
    });

    const loadLocations = async () => {
      try {
        await loadUnlockedLocations();
      } catch (error) {
        console.error('Error loading unlocked locations:', error);
      }
    };
    loadLocations();

    return () => subscription();
  }, [hasPedometerPermission]);

  // Track location updates during activity
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    let timerInterval: NodeJS.Timeout | null = null;

    if (isTracking && hasLocationPermission) {
      // Start the timer
      const startTime = new Date().getTime();

      timerInterval = setInterval(() => {
        const now = new Date().getTime();
        const elapsed = Math.floor((now - startTime) / 1000);
        setElapsedTime(elapsed);

        // Calculate pace if we have distance
        if (distance > 0) {
          const minutesPerKm = elapsed / 60 / (distance / 1000);
          const minutes = Math.floor(minutesPerKm);
          const seconds = Math.floor((minutesPerKm - minutes) * 60);
          setPace(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        }
      }, 1000);

      // Track location
      Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 5,
          timeInterval: 3000,
        },
        (location) => {
          const newCoord: Coordinate = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };

          setCurrentLocation(newCoord);

          // Add to route and calculate distance
          if (routeCoordinates.length > 0) {
            const lastCoord = routeCoordinates[routeCoordinates.length - 1];
            const segmentDistance = calculateDistance(
              lastCoord.latitude,
              lastCoord.longitude,
              newCoord.latitude,
              newCoord.longitude
            );
            setDistance((prevDistance) => prevDistance + segmentDistance);
          }

          setRouteCoordinates((prev) => [...prev, newCoord]);

          // Update WebView with new coordinates
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(`
              if (window.updateUserLocation) {
                window.updateUserLocation(${newCoord.latitude}, ${newCoord.longitude});
              }
              if (window.addRoutePoint) {
                window.addRoutePoint(${newCoord.latitude}, ${newCoord.longitude});
              }
            `);
          }
        }
      ).then((subscription) => {
        locationSubscription = subscription;
      });
    }

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [isTracking, hasLocationPermission, distance]);

  // Calculate distance between two coordinates in kilometers
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
  };

  const deg2rad = (deg: number): number => {
    return deg * (Math.PI / 180);
  };

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = (seconds: number): string => {
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  };

  // Load unlocked locations from Firebase
  const loadUnlockedLocations = async () => {
    try {
      for (const location of locations) {
        const docRef = doc(db, 'unlocked_locations', location.name);
        const docSnap = await getDoc(docRef);
        const docData = docSnap.data() as { unlocked?: boolean; timestamp?: Date } | undefined;
        if (docSnap.exists() && docData?.unlocked) {
          await AsyncStorage.setItem(`unlocked_${location.name}`, 'true');
          console.log(`Loaded unlocked location: ${location.name}`);
        }
      }
    } catch (err) {
      console.error('Error loading unlocked locations:', err);
    }
  };

  // Check for milestone achievements
  useEffect(() => {
    const checkMilestones = async () => {
      for (const location of locations) {
        if (steps >= location.stepsrequired && !(await AsyncStorage.getItem(`unlocked_${location.name}`))) {
          await AsyncStorage.setItem(`unlocked_${location.name}`, 'true');
          const docRef = doc(db, 'unlocked_locations', location.name);
          await setDoc(docRef, { unlocked: true, timestamp: new Date() }, { merge: true });
          setUnlockedLocation(location.name);
          setModalVisible(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          console.log(`Unlocked location: ${location.name}`);
        }
      }
    };
    checkMilestones();
  }, [steps]);

  // Share progress
  const shareProgress = async () => {
    try {
      const message = isTracking
        ? `I've walked ${steps} steps (${distance.toFixed(2)}km) in Stryde! 🏃‍♂️`
        : `I walked ${steps} steps and unlocked ${unlockedLocation || 'new milestones'} in Stryde! 🥾`;

      await Share.share({ message });
    } catch (error) {
      console.error('Error sharing progress:', error);
    }
  };

  // Start or stop tracking
  const toggleTracking = () => {
    if (isTracking) {
      // Stop tracking
      setIsTracking(false);
      setWorkoutStartTime(null);
      setElapsedTime(0); // Reset elapsed time
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Clear the route on the map
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          if (window.clearRoute) {
            window.clearRoute();
          }
        `);
      }
    } else {
      // Start tracking
      if (!hasLocationPermission) {
        Alert.alert('Permission Required', 'Please enable location permissions to track your activity.');
        return;
      }

      setIsTracking(true);
      setWorkoutStartTime(new Date());
      setDistance(0);
      setPace('0:00');
      setElapsedTime(0);
      setRouteCoordinates([]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (currentLocation && webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          if (window.centerMap) {
            window.centerMap(${currentLocation.latitude}, ${currentLocation.longitude});
          }
        `);
      }
    }
  };

  // HTML content for the WebView to display an OSM map with Leaflet
  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Activity Map</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        #map { height: 100%; width: 100%; }
        html, body { margin: 0; padding: 0; height: 100%; }
        
        /* Strava-like map styling */
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2) !important;
        }
        .leaflet-control-zoom a {
          border-radius: 50% !important;
          width: 36px !important;
          height: 36px !important;
          line-height: 36px !important;
          color: #333 !important;
          font-weight: bold !important;
          margin-bottom: 6px !important;
          box-shadow: 0 1px 4px rgba(0,0,0,0.2) !important;
        }
        .user-marker {
          border-radius: 50%;
        }
        .destination-marker {
          border-radius: 4px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
        .strava-popup .leaflet-popup-content-wrapper {
          border-radius: 8px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }
        .strava-popup .leaflet-popup-content {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          color: #333;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        // Strava-like light blue map style
        var map = L.map('map', {
          zoomControl: false, // Disable default zoom controls
          attributionControl: false // Remove attribution for cleaner look
        }).setView([${currentLocation?.latitude || 0}, ${currentLocation?.longitude || 0}], 15);
        
        // Add custom zoom control in bottom right
        L.control.zoom({
          position: 'bottomright'
        }).addTo(map);
        
        // Add a custom light map style similar to Strava
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          subdomains: 'abcd',
        }).addTo(map);
        
        // Custom attribution in custom position
        L.control.attribution({
          position: 'bottomleft'
        }).addAttribution('© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>').addTo(map);

        // Goal markers with custom icons
        ${locations
          .map(
            (loc) => `
          var ${loc.name.toLowerCase()}Icon = L.divIcon({
            className: 'destination-marker',
            html: '<div style="background-color: #4fc14f; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: bold; border: 2px solid white;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V6l-8-4-8 4v6c0 6 8 10 8 10z"/></svg></div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -15]
          });
          
          L.marker([${loc.lat}, ${loc.lng}], {
            icon: ${loc.name.toLowerCase()}Icon
          }).addTo(map)
            .bindPopup("<b>${loc.name}</b><br>${loc.stepsrequired.toLocaleString()} steps to unlock", {
              className: 'strava-popup'
            });
        `
          )
          .join('')}

        // User location marker
        var userMarker = null;
        var routePolyline = null;
        var routePoints = [];

        window.updateUserLocation = function(lat, lng) {
          if (userMarker) {
            userMarker.setLatLng([lat, lng]);
          } else {
            userMarker = L.marker([lat, lng], {
              icon: L.divIcon({
                className: 'user-marker',
                html: '<div style="background-color: #0078ff; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              })
            }).addTo(map);
          }
          
          // Only auto pan if we're zoomed in significantly
          if (map.getZoom() > 14) {
            map.panTo([lat, lng]);
          }
        };

        window.addRoutePoint = function(lat, lng) {
          routePoints.push([lat, lng]);
          if (routePolyline) {
            routePolyline.setLatLngs(routePoints);
          } else {
            routePolyline = L.polyline(routePoints, { 
              color: '#ff5722', 
              weight: 4,
              opacity: 0.8,
              lineJoin: 'round'
            }).addTo(map);
          }
        };

        window.clearRoute = function() {
          if (routePolyline) {
            map.removeLayer(routePolyline);
            routePolyline = null;
            routePoints = [];
          }
        };

        window.centerMap = function(lat, lng) {
          map.setView([lat, lng], 16);
        };

        // Initial center
        ${currentLocation ? `
          window.updateUserLocation(${currentLocation.latitude}, ${currentLocation.longitude});
        ` : ''}
      </script>
    </body>
    </html>
  `;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f7fa" />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </Pressable>
          <Text style={styles.title}>Step Quest Adventure</Text>
          <View style={styles.headerRight}>
            <Pressable onPress={shareProgress}>
              <Ionicons name="share-outline" size={24} color="#333" />
            </Pressable>
          </View>
        </View>

        {/* Main content area with map */}
        <View style={styles.content}>
          {/* Map section with WebView */}
          <View style={styles.mapContainer}>
            {hasLocationPermission && currentLocation ? (
              <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: mapHtml }}
                style={styles.map}
                javaScriptEnabled
                domStorageEnabled
                onMessage={(event) => console.log('WebView message:', event.nativeEvent.data)}
              />
            ) : (
              <View style={styles.mapPlaceholder}>
                <Text style={styles.mapPlaceholderText}>Map unavailable. Please enable location permissions.</Text>
              </View>
            )}
          </View>

          {/* Stats panel */}
          <View style={styles.statsPanel}>
            {isTracking ? (
              // Active workout stats
              <View style={styles.activeStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
                  <Text style={styles.statLabel}>Time</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{distance.toFixed(2)}</Text>
                  <Text style={styles.statLabel}>km</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{pace}</Text>
                  <Text style={styles.statLabel}>Pace</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{steps}</Text>
                  <Text style={styles.statLabel}>Steps</Text>
                </View>
              </View>
            ) : (
              // Progress stats
              <View style={styles.progressContainer}>
                <Progress.Circle
                  size={100}
                  progress={Math.min(steps / 10000, 1)}
                  showsText
                  formatText={() => `${Math.round((steps / 10000) * 100)}%`}
                  color="#4CAF50"
                  borderWidth={0}
                  thickness={8}
                  style={styles.progress}
                  textStyle={styles.progressTextStyle}
                  strokeCap="round"
                  unfilledColor="#e0e0e0"
                />
                <View style={styles.progressDetails}>
                  <View style={styles.progressRow}>
                    <Ionicons name="walk" size={24} color="#4CAF50" />
                    <Text style={styles.progressText}>
                      {steps.toLocaleString()}<Text style={styles.progressSubText}>/10,000 Steps</Text>
                    </Text>
                  </View>
                  <Text style={styles.motivationText}>
                    {steps < 10000 ? "Keep walking to unlock Yosemite!" : "Great job! Keep going!"}
                  </Text>
                  
                  {/* Location goal list */}
                  <View style={styles.locationList}>
                    {locations.map((loc) => {
                      const isUnlocked = steps >= loc.stepsrequired;
                      return (
                        <View key={loc.name} style={styles.locationRow}>
                          <Ionicons
                            name={loc.icon}
                            size={18}
                            color={isUnlocked ? '#4CAF50' : '#888'}
                          />
                          <Text style={[styles.locationText, isUnlocked && styles.unlockedText]}>
                            {loc.name}: {loc.stepsrequired.toLocaleString()} steps
                          </Text>
                          {isUnlocked && (
                            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Action button */}
        <View style={styles.actionButtonContainer}>
          <Pressable 
            onPress={toggleTracking} 
            style={[styles.actionButton, isTracking ? styles.stopButton : styles.startButton]}
            android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: false }}
          >
            <Text style={styles.actionText}>{isTracking ? 'Stop' : 'Start'}</Text>
          </Pressable>
        </View>

        {/* Modal for unlocking locations */}
        <Modal 
          isVisible={isModalVisible}
          animationIn="bounceIn"
          animationOut="fadeOut"
          backdropOpacity={0.5}
        >
          <View style={styles.modalContent}>
            <Ionicons name="trophy" size={50} color="#FFD700" style={styles.modalIcon} />
            <Text style={styles.modalText}>Achievement Unlocked! 🎉</Text>
            <Text style={styles.modalSubText}>You've reached {unlockedLocation}!</Text>
            <Text style={styles.modalDetails}>
              Congratulations on walking {steps.toLocaleString()} steps and unlocking this milestone. 
              Keep walking to discover more destinations!
            </Text>
            <Pressable 
              onPress={() => {
                setModalVisible(false);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }} 
              style={styles.modalButton}
            >
              <Text style={styles.modalButtonText}>Continue</Text>
            </Pressable>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  content: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  mapPlaceholderText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    padding: 20,
  },
  statsPanel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    marginTop: -20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  activeStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e0e0e0',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  progress: {
    marginRight: 20,
  },
  progressTextStyle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  progressDetails: {
    flex: 1,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
  },
  progressSubText: {
    fontSize: 14,
    color: '#666',
    fontWeight: 'normal',
  },
  motivationText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  locationList: {
    marginTop: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  unlockedText: {
    color: '#4CAF50',
    fontWeight: '500',
  },
  actionButtonContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#FF5252',
  },
  actionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalIcon: {
    marginBottom: 16,
  },
  modalText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalSubText: {
    fontSize: 18,
    color: '#4CAF50',
    marginBottom: 12,
  },
  modalDetails: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});