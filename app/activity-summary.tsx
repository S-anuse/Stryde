import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Pressable,
  ScrollView,
  Share,
  Dimensions,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WebView from 'react-native-webview';

// Define the type for coordinates
type Coordinate = {
  latitude: number;
  longitude: number;
  altitude?: number;
};

// Define the type for activity data
type ActivityData = {
  id: string;
  type: 'Walk' | 'Run' | 'Ride';
  date: string;
  distance: number;
  duration: number;
  steps: number;
  pace: string;
  calories: number;
  elevation: number;
  routeCoordinates: Coordinate[];
};

// Define color type for clarity
type ColorPair = [string, string];

export default function ActivitySummary() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [useMetric, setUseMetric] = useState(true);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settingsJson = await AsyncStorage.getItem('settings');
        if (settingsJson) {
          const settings = JSON.parse(settingsJson);
          const useMetricSetting = settings.find((s: any) => s.key === 'useMetric')?.value;
          setUseMetric(useMetricSetting !== undefined ? useMetricSetting : true);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    loadSettings();

    const parsedRouteCoordinates = params.routeCoordinates
      ? JSON.parse(params.routeCoordinates as string)
      : [];

    const mockActivity: ActivityData = {
      id: '1234567890',
      type: (params.type as 'Walk' | 'Run' | 'Ride') || 'Walk',
      date: new Date().toISOString(),
      distance: isNaN(parseFloat(params.distance as string)) ? 2.5 : parseFloat(params.distance as string),
      duration: isNaN(parseInt(params.duration as string, 10)) ? 1200 : parseInt(params.duration as string, 10),
      steps: isNaN(parseInt(params.steps as string, 10)) ? 3500 : parseInt(params.steps as string, 10),
      pace: typeof params.pace === 'string' && params.pace ? params.pace : '8:00',
      calories: isNaN(parseInt(params.calories as string, 10)) ? 210 : parseInt(params.calories as string, 10),
      elevation: isNaN(parseInt(params.elevation as string, 10)) ? 42 : parseInt(params.elevation as string, 10),
      routeCoordinates: parsedRouteCoordinates,
    };

    console.log('useEffect: mockActivity=', mockActivity);

    setTimeout(() => {
      setActivity(mockActivity);
      setLoading(false);
      console.log('useEffect: activity set, loading=false');
    }, 500);
  }, [params]);

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

  const formatDistance = (distance: number) => {
    if (useMetric) {
      return `${distance.toFixed(2)} km`;
    } else {
      const miles = distance * 0.621371;
      return `${miles.toFixed(2)} mi`;
    }
  };

  const getActivityIcon = (): string => {
    if (!activity) return 'fitness-outline';
    switch (activity.type) {
      case 'Walk':
        return 'walk-outline';
      case 'Run':
        return 'fitness-outline';
      case 'Ride':
        return 'bicycle-outline';
      default:
        return 'fitness-outline';
    }
  };

  const getActivityColor = (): ColorPair => {
    const defaultColors: ColorPair = ['#4CAF50', '#2E7D32'];
    if (!activity) {
      console.log('getActivityColor: activity is null, returning default');
      return defaultColors;
    }
    console.log('getActivityColor: activity type=', activity.type);
    switch (activity.type) {
      case 'Walk':
        return ['#4CAF50', '#2E7D32'];
      case 'Run':
        return ['#FF9800', '#F57C00'];
      case 'Ride':
        return ['#2196F3', '#1976D2'];
      default:
        console.log('getActivityColor: default case triggered');
        return defaultColors;
    }
  };

  const handleSaveActivity = async () => {
    try {
      if (!activity) return;
      const existingActivitiesJson = await AsyncStorage.getItem('activities');
      let activities: ActivityData[] = [];
      if (existingActivitiesJson) {
        activities = JSON.parse(existingActivitiesJson);
      }
      activities.push(activity);
      await AsyncStorage.setItem('activities', JSON.stringify(activities));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Activity saved successfully!');
      router.push('/(tabs)');
    } catch (error) {
      console.error('Error saving activity:', error);
      Alert.alert('Error', 'Failed to save activity. Please try again.');
    }
  };

  const handleShare = async () => {
    if (!activity) return;
    try {
      const result = await Share.share({
        message: `I just completed a ${activity.distance.toFixed(2)}km ${activity.type.toLowerCase()} with Stryde! 🏃‍♂️`,
      });
      if (result.action === Share.sharedAction) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error sharing activity:', error);
      Alert.alert('Error', 'Failed to share activity.');
    }
  };

  // HTML content for the WebView to display the route map
  const mapHtml = activity?.routeCoordinates && activity.routeCoordinates.length > 1
  ? `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Route Map</title>
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
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        var map = L.map('map', {
          zoomControl: false,
          attributionControl: false
        });
        
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

        var routePoints = ${JSON.stringify(activity.routeCoordinates.map(coord => [coord.latitude, coord.longitude]))};
        
        if (routePoints.length > 1) {
          var routePolyline = L.polyline(routePoints, { 
            color: '#ff5722', 
            weight: 4,
            opacity: 0.8,
            lineJoin: 'round'
          }).addTo(map);
          
          // Fit map to route bounds
          var bounds = routePolyline.getBounds();
          map.fitBounds(bounds, { padding: [50, 50] });
        } else {
          map.setView([0, 0], 2); // Default view if no route
        }
      </script>
    </body>
    </html>
  `
  : '';

  console.log('Render: loading=', loading, 'activity=', activity);

  if (loading || !activity) {
    console.log('Render: showing loading screen');
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#4CAF50" />
        <Text style={styles.loadingText}>Loading activity summary...</Text>
      </SafeAreaView>
    );
  }

  const colors = getActivityColor();
  console.log('Render: colors=', colors);
  if (!Array.isArray(colors) || colors.length !== 2 || !colors.every(c => typeof c === 'string' && c.startsWith('#'))) {
    console.error('Render: Invalid colors array:', colors);
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#4CAF50" />
        <Text style={styles.loadingText}>Error: Invalid color data</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors[0]} />
      <LinearGradient colors={colors} style={styles.header}>
        <View style={styles.headerContent}>
          <Pressable style={styles.backButton} onPress={() => router.push('/(tabs)')}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <View style={styles.activityIconContainer}>
            <Ionicons name="fitness-outline" size={32} color="#fff" />
          </View>
          <Text style={styles.headerTitle}>{activity.type} Summary</Text>
          <Text style={styles.headerDate}>
            {new Date(activity.date).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>
      </LinearGradient>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="speedometer-outline" size={24} color="#333" style={styles.statIcon} />
            <Text style={styles.statValue}>{formatDistance(activity.distance)}</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={24} color="#333" style={styles.statIcon} />
            <Text style={styles.statValue}>{formatTime(activity.duration)}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="footsteps-outline" size={24} color="#333" style={styles.statIcon} />
            <Text style={styles.statValue}>{activity.steps.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Steps</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="flame-outline" size={24} color="#333" style={styles.statIcon} />
            <Text style={styles.statValue}>{activity.calories}</Text>
            <Text style={styles.statLabel}>Calories</Text>
          </View>
        </View>
        <View style={styles.mapPreviewContainer}>
  <Text style={styles.sectionTitle}>Your Route</Text>
  {activity?.routeCoordinates.length > 1 ? (
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
      <Ionicons name="map-outline" size={48} color="#ccc" />
      <Text style={styles.mapPlaceholderText}>Route map preview would appear here</Text>
    </View>
  )}
</View>
        <View style={styles.notesContainer}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <View style={styles.notesInputContainer}>
            <Text style={styles.notesPlaceholder}>
              Add notes about how you felt during this activity...
            </Text>
          </View>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Pressable style={[styles.footerButton, styles.shareButton]} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={20} color="#fff" />
          <Text style={styles.footerButtonText}>Share</Text>
        </Pressable>
        <Pressable style={[styles.footerButton, styles.saveButton]} onPress={handleSaveActivity}>
          <Ionicons name="checkmark" size={20} color="#fff" />
          <Text style={styles.footerButtonText}>Save Activity</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  loadingText: {
    fontSize: 16,
    color: '#555',
  },
  header: {
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  headerContent: {
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 10,
    padding: 8,
  },
  activityIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerDate: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    width: cardWidth,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  statIcon: {
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#888',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  mapPreviewContainer: {
    marginBottom: 20,
  },
  map: {
    height: 180,
    borderRadius: 12,
  },
  mapPlaceholder: {
    height: 180,
    backgroundColor: '#fff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  mapPlaceholderText: {
    marginTop: 8,
    color: '#888',
  },
  notesContainer: {
    marginBottom: 20,
  },
  notesInputContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  notesPlaceholder: {
    color: '#aaa',
    fontSize: 14,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
  },
  shareButton: {
    backgroundColor: '#607D8B',
    marginRight: 8,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    marginLeft: 8,
  },
  footerButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
});