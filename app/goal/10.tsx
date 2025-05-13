import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SugarTracker() {
  const [sugarIntake, setSugarIntake] = useState<number>(0);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    saveData();
  }, [sugarIntake]);

  const loadData = async () => {
    try {
      const savedData = await AsyncStorage.getItem('sugarTrackerData');
      if (savedData) {
        const data = JSON.parse(savedData);
        setSugarIntake(data.sugarIntake || 0);
        setLastUpdate(data.lastUpdate);
      }
    } catch (error) {
      console.log('Error loading sugar data:', error);
    }
  };

  const saveData = async () => {
    try {
      const now = new Date().toISOString();
      await AsyncStorage.setItem('sugarTrackerData', JSON.stringify({
        sugarIntake,
        lastUpdate: now,
      }));
    } catch (error) {
      console.log('Error saving sugar data:', error);
    }
  };

  const checkForNewDay = () => {
    if (!lastUpdate) {
      setLastUpdate(new Date().toISOString());
      return;
    }
    const lastDate = new Date(lastUpdate);
    const today = new Date();
    if (lastDate.getDate() !== today.getDate() || lastDate.getMonth() !== today.getMonth() || lastDate.getFullYear() !== today.getFullYear()) {
      setSugarIntake(0);
      setLastUpdate(today.toISOString());
    }
  };

  const addSugarIntake = (value: string) => { // Added type annotation for string from TextInput
    checkForNewDay();
    const intake = parseInt(value) || 0;
    const target = 50; // 50% of assumed 100g baseline
    setSugarIntake(intake);
    if (intake <= target) Alert.alert("Great Job!", "You've hit your 50% sugar reduction goal!");
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#E0F7FA', '#B2EBF2', '#80DEEA']} style={styles.background} />
      <Text style={styles.title}>Sugar Tracker</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        placeholder="Enter daily sugar intake (g)"
        onChangeText={addSugarIntake}
        value={sugarIntake.toString()}
      />
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.min((sugarIntake / 100) * 100, 100)}%` }]} />
        </View>
        <Text style={styles.progressText}>Target: 50g (50% reduction)</Text>
      </View>
      <Text style={styles.infoText}>Track your intake daily. Aim to reduce by 10% weekly until you hit 50g!</Text>
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
  input: {
    height: 40,
    width: '80%',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  progressBarContainer: {
    width: '80%',
    marginBottom: 10,
  },
  progressBar: {
    height: 20,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#03A9F4',
    borderRadius: 10,
  },
  progressText: {
    fontSize: 16,
    color: '#01579B',
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#0277BD',
    textAlign: 'center',
    marginTop: 10,
  },
});