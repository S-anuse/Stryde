import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';

export default function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#ff4500',
        tabBarLabelStyle: { 
          fontSize: 12, 
          fontWeight: 'bold',
        },
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
          tabBarLabel: ({ focused, color }) => (
            <Text style={{ color, fontSize: 12, fontWeight: focused ? 'bold' : 'normal' }}>
              Home
            </Text>
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
          tabBarLabel: ({ focused, color }) => (
            <Text style={{ color, fontSize: 12, fontWeight: focused ? 'bold' : 'normal' }}>
              Goals
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: 'Record',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="play-circle" size={size} color={color} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <Text style={{ color, fontSize: 12, fontWeight: focused ? 'bold' : 'normal' }}>
              Record
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="walk" size={size} color={color} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <Text style={{ color, fontSize: 12, fontWeight: focused ? 'bold' : 'normal' }}>
              Activity
            </Text>
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