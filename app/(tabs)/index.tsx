// E:\Stryde\app\(tabs)\index.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';

interface GoalData {
  goalId: string;
  started: boolean;
  startDate: string;
  longestStreak?: number;
  userId: string;
  stepCount?: number;
  milestones?: string[];
}

interface GoalItemProps {
  goalId: string;
  title: string;
  image: any;
  goalStatus: { stepCount: number; milestones: string[] } | null;
}

const GoalItem = ({ goalId, title, image, goalStatus }: GoalItemProps) => {
  const router = useRouter();

  const handleTrack = () => {
    router.push(`./goal/${goalId}`);
  };

  return (
    <View style={styles.goalItem}>
      <Image source={image} style={styles.icon} />
      <View style={styles.textContainer}>
        <Text style={styles.goalText}>{title}</Text>
        {goalStatus && (
          <Text style={styles.goalStatus}>
            Steps: {goalStatus.stepCount} | Milestones: {goalStatus.milestones.join(', ') || 'None'}
          </Text>
        )}
        <TouchableOpacity style={styles.trackButton} onPress={handleTrack}>
          <Text style={styles.trackText}>Track</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function Index() {
  const [startedGoals, setStartedGoals] = useState<GoalData[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
        setStartedGoals([]);
        router.push('/(auth)/login');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchStartedGoals = async () => {
      if (!userId) return;

      try {
        const goalsQuery = query(
          collection(db, 'goals'),
          where('userId', '==', userId),
          where('started', '==', true)
        );
        const querySnapshot = await getDocs(goalsQuery);
        const goalsData: GoalData[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data() as GoalData;
          const goalId = doc.id.split('_')[1];
          goalsData.push({ ...data, goalId });
        });
        setStartedGoals(goalsData);
      } catch (error) {
        console.error('Error fetching data:', error);
        setStartedGoals([]);
      }
    };

    fetchStartedGoals();
  }, [userId]);

  const predefinedGoals = [
    { id: '1', title: 'Reduce 1 kg in 1 week', image: require('../../assets/scale.png') },
    { id: '2', title: 'Burn 500 calories daily', image: require('../../assets/fire.png') },
    { id: '3', title: 'Walk 10,000 steps daily', image: require('../../assets/shoes.png') },
    { id: '4', title: 'Run 5 km in under 30 minutes', image: require('../../assets/training.png') },
    { id: '5', title: 'Complete 50 push-ups daily', image: require('../../assets/push-up.png') },
    { id: '6', title: 'Lose 1 inch off waist in 2 weeks', image: require('../../assets/slim-body.png') },
    { id: '7', title: 'Drink 3 liters of water daily', image: require('../../assets/drop.png') },
    { id: '8', title: 'Cycle 20 km weekly', image: require('../../assets/school.png') },
    { id: '9', title: 'Do 30 minutes of yoga daily', image: require('../../assets/lotus.png') },
    { id: '10', title: 'Cut sugar intake by 50%', image: require('../../assets/diet.png') },
    { id: '11', title: 'Plank for 2 minutes daily', image: require('../../assets/plank.png') },
    { id: '12', title: 'Swim 500 meters weekly', image: require('../../assets/swimming.png') },
    { id: '13', title: 'Lift weights 3 times a week', image: require('../../assets/dumbbells.png') },
    { id: '14', title: 'Reduce 5% body fat in 1 month', image: require('../../assets/body.png') },
    { id: '15', title: 'Hike 10 km every weekend', image: require('../../assets/hiking.png') },
  ];

  const getGoalStatus = (goal: GoalData) => {
    return goal ? { stepCount: goal.stepCount || 0, milestones: goal.milestones || [] } : null;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Started Goals</Text>
      {startedGoals.length === 0 ? (
        <Text style={styles.noGoalsText}>No goals started yet.</Text>
      ) : (
        <FlatList
          data={startedGoals}
          renderItem={({ item }) => {
            const goal = predefinedGoals.find(g => g.id === item.goalId);
            if (!goal) return null;
            return (
              <GoalItem
                goalId={item.goalId}
                title={goal.title}
                image={goal.image}
                goalStatus={getGoalStatus(item)}
              />
            );
          }}
          keyExtractor={(item) => item.goalId}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
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
  noGoalsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f9f9f9',
    padding: 50,
    borderRadius: 12,
    marginHorizontal: 5,
    marginBottom: 10,
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
  trackButton: {
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
  trackText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});