import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Animated, Button } from 'react-native';
import { Image } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { db, auth } from '../../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

// Sample list of 15 predefined goals with associated image paths
const predefinedGoals = [
  { id: '1', title: 'Reduce 1 kg in 1 week', image: require('../../assets/scale.png') },
  { id: '2', title: 'Burn 500 calories daily', image: require('../../assets/fire.png') },
  { id: '3', title: 'Walk 10,000 steps daily', image: require('../../assets/shoes.png') },
  { id: '4', title: 'Run 5 km in under 30 minutes', image: require('../../assets/training.png') },
  { id: '6', title: 'Lose 1 inch off waist in 2 weeks', image: require('../../assets/slim-body.png') },
  { id: '7', title: 'Drink 3 liters of water daily', image: require('../../assets/drop.png') },
  { id: '8', title: 'Cycle 20 km weekly', image: require('../../assets/school.png') },
  { id: '9', title: 'Do 30 minutes of yoga daily', image: require('../../assets/lotus.png') },
  { id: '11', title: 'Plank for 2 minutes daily', image: require('../../assets/plank.png') },
  { id: '15', title: 'Hike 10 km every weekend', image: require('../../assets/hiking.png') },
];

interface GoalStatus {
  stepCount: number;
  milestones: string[];
}

interface GoalItemProps {
  id: string;
  title: string;
  image: any;
  goalStatus: GoalStatus | null;
}

const GoalItem = ({ id, title, image, goalStatus }: GoalItemProps) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const router = useRouter();

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      speed: 20,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      speed: 20,
      useNativeDriver: true,
    }).start();
  };

  const handleExplore = () => {
    // Use direct string path with TypeScript ignore as a workaround
  // @ts-ignore
  router.push(`/goal/${id}`); // e.g., /goal/1 for 1.tsx
  };

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} style={{ marginBottom: 10 }}>
      <Animated.View
        style={[
          styles.goalItem,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image source={image} style={styles.icon} />
        <View style={styles.textContainer}>
          <Text style={styles.goalText}>{title}</Text>
          
          <Pressable onPress={handleExplore} style={styles.exploreButton}>
            <Text style={styles.exploreText}>Explore</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Pressable>
  );
};

export default function Goals() {
  const [goalStatuses, setGoalStatuses] = useState<{ [key: string]: GoalStatus }>({});
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      setUser(user);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchGoalStatuses = async () => {
      try {
        const goalsRef = collection(db, 'users', user.uid, 'goals');
        const goalsSnapshot = await getDocs(goalsRef);

        const statuses: { [key: string]: GoalStatus } = {};
        goalsSnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
          const data = doc.data();
          statuses[doc.id] = {
            stepCount: data.stepCount || 0,
            milestones: data.milestones || [],
          };
        });
        setGoalStatuses(statuses);
      } catch (error) {
        console.error('Error fetching goal statuses:', error);
      }
    };

    fetchGoalStatuses();
  }, [user]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <Text style={styles.header}>Your Fitness Goals</Text>
        <FlatList
          data={predefinedGoals}
          renderItem={({ item }) => (
            <GoalItem
              id={item.id}
              title={item.title}
              image={item.image}
              goalStatus={goalStatuses[item.id] || null}
            />
          )}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#000',
    textAlign: 'center',
  },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f9f9f9',
    padding: 50,
    borderRadius: 12,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  icon: {
    width: 70,
    height: 70,
    resizeMode: 'contain',
    marginRight: 40,
    marginInlineStart: -25,
  },
  textContainer: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  goalText: {
    fontSize: 18,
    color: '#333',
    marginBottom: 5,
  },
  goalStatus: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  exploreButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
    width: 85,
    height: 50,
    marginLeft: 20,
  },
  exploreText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});









