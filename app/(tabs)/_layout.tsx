import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';

export default function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#ff4500',
        headerRight: () => (
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
          >
            {({ pressed }) => (
              <Ionicons
                name="person-circle"
                size={30}
                color={pressed ? 'gray' : 'black'}
                style={{ marginRight: 15 }}
              />
            )}
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: 'Goals',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="activity" // New tab
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="walk" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          href: null, // Hide Profile from tab bar
        }}
      />
    </Tabs>
  );
}