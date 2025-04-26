import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function YogaTracker() {
  const [yogaSessions, setYogaSessions] = useState<{ morning: number; midday: number; evening: number }>({
    morning: 0,
    midday: 0,
    evening: 0,
  });
  const [lastYoga, setLastYoga] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    saveData();
  }, [yogaSessions]);

  const loadData = async () => {
    try {
      const savedData = await AsyncStorage.getItem('yogaTrackerData');
      if (savedData) {
        const data = JSON.parse(savedData);
        setYogaSessions(data.yogaSessions || { morning: 0, midday: 0, evening: 0 });
        setLastYoga(data.lastYoga);
      }
    } catch (error) {
      console.log('Error loading yoga data:', error);
    }
  };

  const saveData = async () => {
    try {
      const now = new Date().toISOString();
      await AsyncStorage.setItem('yogaTrackerData', JSON.stringify({
        yogaSessions,
        lastYoga: now,
      }));
    } catch (error) {
      console.log('Error saving yoga data:', error);
    }
  };

  const checkForNewDay = () => {
    if (!lastYoga) {
      setLastYoga(new Date().toISOString());
      return;
    }
    const lastDate = new Date(lastYoga);
    const today = new Date();
    if (lastDate.getDate() !== today.getDate() || lastDate.getMonth() !== today.getMonth() || lastDate.getFullYear() !== today.getFullYear()) {
      setYogaSessions({ morning: 0, midday: 0, evening: 0 });
      setLastYoga(today.toISOString());
    }
  };

  const startYogaSession = (time: 'morning' | 'midday' | 'evening') => { // Added union type
    checkForNewDay();
    setYogaSessions(prev => {
      const updated = { ...prev, [time]: prev[time] + 10 }; // Explicitly typed access
      return updated;
    });
    const totalTime = yogaSessions.morning + yogaSessions.midday + yogaSessions.evening + 10;
    if (totalTime >= 30) Alert.alert("Yoga Goal Achieved!", "You've completed 30 minutes of yoga today!");
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#E0F7FA', '#B2EBF2', '#80DEEA']} style={styles.background} />
      <Text style={styles.title}>Yoga Tracker</Text>
      <TouchableOpacity style={styles.button} onPress={() => startYogaSession('morning')}>
        <Text style={styles.buttonText}>Morning (10m)</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={() => startYogaSession('midday')}>
        <Text style={styles.buttonText}>Midday (10m)</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={() => startYogaSession('evening')}>
        <Text style={styles.buttonText}>Evening (10m)</Text>
      </TouchableOpacity>
      <Text style={styles.timeText}>Total: {yogaSessions.morning + yogaSessions.midday + yogaSessions.evening} minutes</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0277BD',
    marginBottom: 20,
  },
  button: {
    width: '80%',
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4FC3F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  timeText: {
    fontSize: 20,
    color: '#01579B',
    marginTop: 20,
  },
});