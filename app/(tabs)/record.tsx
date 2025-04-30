import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  Alert, 
  Linking, 
  Platform, 
  SafeAreaView, 
  StatusBar, 
  Dimensions 
} from 'react-native';
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

// Define a type for coordinates
type Coordinate = {
  latitude: number;
  longitude: number;
  altitude?: number;
};

// Define sport type
type SportType = 'Walk' | 'Run' | 'Ride';

export default function Record() {
  const [steps, setSteps] = useState(0);
  const [selectedSport, setSelectedSport] = useState<SportType>('Walk');
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [distance, setDistance] = useState(0);
  const [pace, setPace] = useState('0:00');
  const [elevationGain, setElevationGain] = useState(0);
  const [workoutStartTime, setWorkoutStartTime] = useState<Date | null>(null);
  const [hasPedometerPermission, setHasPedometerPermission] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
            altitude: location.coords.altitude || 0,
          });
        } else {
          setHasLocationPermission(false);
          console.log('Location permission denied');
          Alert.alert(
            'Permission Required',
            'This feature requires location access to track your activity. Please enable it in settings.',
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

    return () => subscription();
  }, [hasPedometerPermission]);

  // Track location updates during activity
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    let timerInterval: NodeJS.Timeout | null = null;

    if (isTracking && hasLocationPermission) {
      const startTime = new Date().getTime();

      timerInterval = setInterval(() => {
        const now = new Date().getTime();
        const elapsed = Math.floor((now - startTime) / 1000);
        setElapsedTime(elapsed);

        // Calculate pace
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
            altitude: location.coords.altitude || 0,
          };

          setCurrentLocation(newCoord);

          // Calculate distance and elevation
          if (routeCoordinates.length > 0) {
            const lastCoord = routeCoordinates[routeCoordinates.length - 1];
            const segmentDistance = calculateDistance(
              lastCoord.latitude,
              lastCoord.longitude,
              newCoord.latitude,
              newCoord.longitude
            );
            setDistance((prevDistance) => prevDistance + segmentDistance);

            if (lastCoord.altitude !== undefined && newCoord.altitude !== undefined) {
              const elevationChange = newCoord.altitude - lastCoord.altitude;
              if (elevationChange > 0) {
                setElevationGain((prev) => prev + elevationChange);
              }
            }
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

  // Start or stop tracking
  const toggleTracking = () => {
    if (isTracking) {
      setIsTracking(false);
      setWorkoutStartTime(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          if (window.clearRoute) {
            window.clearRoute();
          }
        `);
      }
      
      const calories = Math.round(steps * 0.04);
  
      // Only pass routeCoordinates if there’s meaningful movement
      const finalRouteCoordinates = routeCoordinates.length > 1 ? routeCoordinates : [];
  
      router.push({
        pathname: '/activity-summary',
        params: {
          type: selectedSport,
          distance: distance.toString(),
          duration: elapsedTime.toString(),
          steps: steps.toString(),
          pace: pace,
          calories: calories.toString(),
          elevation: elevationGain.toString(),
          routeCoordinates: JSON.stringify(finalRouteCoordinates), // Empty array if no movement
        },
      });
    } else {
      if (!hasLocationPermission) {
        Alert.alert('Permission Required', 'Please enable location permissions to track your activity.');
        return;
      }
  
      setIsTracking(true);
      setWorkoutStartTime(new Date());
      setDistance(0);
      setPace('0:00');
      setElapsedTime(0);
      setElevationGain(0);
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
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        var map = L.map('map', {
          zoomControl: false,
          attributionControl: false
        }).setView([${currentLocation?.latitude || 0}, ${currentLocation?.longitude || 0}], 15);
        
        L.control.zoom({
          position: 'bottomright'
        }).addTo(map);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          subdomains: 'abcd',
        }).addTo(map);
        
        L.control.attribution({
          position: 'bottomleft'
        }).addAttribution('© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>').addTo(map);

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
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </Pressable>
          <Text style={styles.title}>Record Activity</Text>
          <View style={styles.headerRight}>
            <Pressable onPress={() => router.push('/settings')}>
              <Ionicons name="settings-outline" size={24} color="#333" />
            </Pressable>
          </View>
        </View>

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
          
          {isTracking && (
            <View style={styles.statsOverlay}>
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
                <Text style={styles.statValue}>{steps}</Text>
                <Text style={styles.statLabel}>Steps</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.controlsContainer}>
          {!isTracking && (
            <View style={styles.sportSelector}>
              <Text style={styles.sectionTitle}>Choose a Sport</Text>
              <View style={styles.segmentedControl}>
                {(['Walk', 'Run', 'Ride'] as SportType[]).map((sport) => (
                  <Pressable
                    key={sport}
                    style={[
                      styles.segmentButton,
                      selectedSport === sport && styles.selectedSegment,
                    ]}
                    onPress={() => {
                      setSelectedSport(sport);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Ionicons
                      name={
                        sport === 'Walk'
                          ? 'walk-outline'
                          : sport === 'Run'
                          ? 'fitness-outline'
                          : 'bicycle-outline'
                      }
                      size={20}
                      color={selectedSport === sport ? '#fff' : '#555'}
                      style={styles.sportIcon}
                    />
                    <Text
                      style={[
                        styles.segmentText,
                        selectedSport === sport && styles.selectedSegmentText,
                      ]}
                    >
                      {sport}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <Pressable
            onPress={toggleTracking}
            style={[
              styles.actionButton,
              isTracking ? styles.stopButton : styles.startButton,
            ]}
            android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: false }}
          >
            <Text style={styles.actionText}>
              {isTracking ? 'Stop Activity' : 'Start Activity'}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');

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
  statsOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e0e0e0',
  },
  controlsContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  sportSelector: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    marginBottom: 12,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  selectedSegment: {
    backgroundColor: '#2F80ED',
  },
  segmentText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#555',
  },
  selectedSegmentText: {
    color: '#fff',
  },
  sportIcon: {
    marginRight: 6,
  },
  actionButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
});