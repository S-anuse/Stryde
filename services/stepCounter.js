import { Pedometer } from 'expo-sensors';
import { Accelerometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, auth } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

// Change keys to be user-specific
const getStepCountKey = (userId) => `pedometer_step_count_${userId}`;
const getLastResetTimeKey = (userId) => `pedometer_last_reset_time_${userId}`;
const MAX_STEPS_PER_UPDATE = 20;

class StepCounter {
  constructor() {
    this.currentStepCount = 0;
    this.rawStepCount = 0;
    this.isShaking = false;
    this.lastStepTime = Date.now();
    this.initialStepCount = null;
    this.sessionStartTime = Date.now();
    this.lastSavedStepCount = 0;
    this.stepBuffer = 0;
    this.accelerometerData = { x: 0, y: 0, z: 0 };
    this.lastAccelSamples = [];
    this.lastShakeCheck = 0;
    this.lastProcessedStep = 0;
    this.listeners = [];
    this.pedometerSubscription = null;
    this.accelerometerSubscription = null;
    this.userId = null; // Track current user ID
    this.saveInterval = null;
    this.shakeTimeout = null;
  }

  setUserId(userId) {
    const oldUserId = this.userId;
    this.userId = userId;

    if (userId && (oldUserId !== userId || !oldUserId)) {
      this.initialStepCount = null;
      this.lastProcessedStep = 0;
      this.currentStepCount = 0;
      this.lastSavedStepCount = 0;
      this.stepBuffer = 0;
      this.sessionStartTime = Date.now();
      this.loadSavedData();
      if (this.pedometerSubscription) {
        this.stop();
        this.start();
      }
    }
  }

  notifyListeners() {
    this.listeners.forEach((listener) => listener(this.currentStepCount));
  }

  subscribe(listener) {
    this.listeners.push(listener);
    listener(this.currentStepCount);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  async loadSavedData() {
    if (!this.userId) {
      console.log('No user ID available, cannot load data');
      return;
    }

    try {
      const savedStepCount = await AsyncStorage.getItem(getStepCountKey(this.userId));
      const lastResetTime = await AsyncStorage.getItem(getLastResetTimeKey(this.userId));
      const userDocRef = doc(db, 'users', this.userId);
      const docSnap = await getDoc(userDocRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const firestoreStepCount = data.stepCount || 0;
        this.currentStepCount = firestoreStepCount;
        this.lastSavedStepCount = firestoreStepCount;
      } else {
        this.currentStepCount = 0;
        this.lastSavedStepCount = 0;
        await setDoc(userDocRef, { stepCount: 0, lastUpdated: new Date().toISOString() }, { merge: true });
      }

      if (savedStepCount && lastResetTime) {
        const parsedStepCount = parseInt(savedStepCount, 10);
        const parsedResetTime = parseInt(lastResetTime, 10);
        if (!isNaN(parsedStepCount)) {
          this.sessionStartTime = parsedResetTime || Date.now();
        }
      } else {
        this.sessionStartTime = Date.now();
      }

      await AsyncStorage.setItem(getStepCountKey(this.userId), this.currentStepCount.toString());
      await AsyncStorage.setItem(getLastResetTimeKey(this.userId), this.sessionStartTime.toString());
      this.notifyListeners();
    } catch (err) {
      console.error('Error loading saved data:', err);
    }
  }

  async saveData() {
    if (!this.userId) {
      console.log('No user ID available, cannot save data');
      return;
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    try {
      const lastReset = new Date(this.sessionStartTime);
      const lastResetDay = lastReset.toISOString().split('T')[0];

      if (today !== lastResetDay && this.lastSavedStepCount > 0) {
        const docRef = doc(db, 'users', this.userId, 'step_data', lastResetDay);
        await setDoc(docRef, { date: lastResetDay, steps: this.lastSavedStepCount }, { merge: true });
        console.log('Data saved to Firestore for user:', this.userId, 'date:', lastResetDay);

        this.sessionStartTime = now.getTime();
        this.lastSavedStepCount = 0;
        this.currentStepCount = 0;
        this.initialStepCount = null;
        this.lastProcessedStep = 0;
        this.notifyListeners();
      }

      const userDocRef = doc(db, 'users', this.userId);
      await setDoc(userDocRef, { stepCount: this.currentStepCount, lastUpdated: now.toISOString() }, { merge: true });

      await AsyncStorage.setItem(getStepCountKey(this.userId), this.currentStepCount.toString());
      await AsyncStorage.setItem(getLastResetTimeKey(this.userId), this.sessionStartTime.toString());

      this.lastSavedStepCount = this.currentStepCount;
    } catch (err) {
      console.error('Error saving step count:', err);
    }
  }

  detectShake() {
    const now = Date.now();
    const MIN_SHAKE_CHECK_INTERVAL = 250;

    if (now - this.lastShakeCheck < MIN_SHAKE_CHECK_INTERVAL || this.lastAccelSamples.length < 5) return;

    this.lastShakeCheck = now;

    let xTotal = 0, yTotal = 0, zTotal = 0;
    this.lastAccelSamples.forEach((sample) => {
      xTotal += sample.x;
      yTotal += sample.y;
      zTotal += sample.z;
    });

    const xAvg = xTotal / this.lastAccelSamples.length;
    const yAvg = yTotal / this.lastAccelSamples.length;
    const zAvg = zTotal / this.lastAccelSamples.length;

    let xVariance = 0, yVariance = 0, zVariance = 0;
    this.lastAccelSamples.forEach((sample) => {
      xVariance += Math.pow(sample.x - xAvg, 2);
      yVariance += Math.pow(sample.y - yAvg, 2);
      zVariance += Math.pow(sample.z - zAvg, 2);
    });

    xVariance /= this.lastAccelSamples.length;
    yVariance /= this.lastAccelSamples.length;
    zVariance /= this.lastAccelSamples.length;

    const combinedVariance = xVariance + yVariance + zVariance;
    const SHAKE_THRESHOLD = 2.0;

    if (combinedVariance > SHAKE_THRESHOLD) {
      this.isShaking = true;
      if (this.shakeTimeout) clearTimeout(this.shakeTimeout);
      this.shakeTimeout = setTimeout(() => (this.isShaking = false), 2000);
    }
  }

  handleStepDetected(result) {
    const now = Date.now();
    console.log('Raw step update:', result.steps, 'Time:', now);

    if (this.initialStepCount === null) {
      this.initialStepCount = result.steps;
      this.lastProcessedStep = result.steps;
      console.log('Initialized initialStepCount:', this.initialStepCount);
      return;
    }

    const newSteps = result.steps - this.lastProcessedStep;
    this.lastProcessedStep = result.steps;

    if (newSteps <= 0) {
      console.log('No new steps detected or negative steps:', newSteps);
      return;
    }

    const validatedStepsDelta = Math.min(newSteps, MAX_STEPS_PER_UPDATE);
    const timeSinceLastStep = now - this.lastStepTime;

    const stepRate = validatedStepsDelta / (timeSinceLastStep / 1000);

    const stepAnalysis = {
      rawSteps: this.rawStepCount,
      newSteps: newSteps,
      validatedDelta: validatedStepsDelta,
      totalStepsTaken: result.steps - this.initialStepCount,
      timeSinceLastStep: timeSinceLastStep,
      stepRate: stepRate,
      isShaking: this.isShaking,
    };
    console.log('Step analysis:', JSON.stringify(stepAnalysis));

    if (this.isShaking) {
      console.log('Steps ignored due to shaking');
      return;
    }

    this.rawStepCount += validatedStepsDelta;
    this.stepBuffer += validatedStepsDelta;
    const wholeSteps = Math.floor(this.stepBuffer);
    this.stepBuffer -= wholeSteps;

    if (wholeSteps > 0) {
      this.currentStepCount += wholeSteps;
      this.lastStepTime = now;
      console.log('UI update - Added:', wholeSteps, 'New total:', this.currentStepCount);
      this.notifyListeners();
      this.checkAndSaveData();
    }
  }

  async checkAndSaveData() {
    if (this.currentStepCount !== this.lastSavedStepCount && this.userId) {
      await this.saveData();
    }
  }

  async start() {
    this.userId = auth.currentUser ? auth.currentUser.uid : null;

    if (!this.userId) {
      console.log('No user logged in, steps will not be saved to Firestore');
    } else {
      await this.loadSavedData();
    }

    const pedometerAvailable = await Pedometer.isAvailableAsync();
    if (!pedometerAvailable) {
      console.error('Pedometer not available');
      return;
    }

    const { status } = await Pedometer.requestPermissionsAsync();
    if (status !== 'granted') {
      console.error('Pedometer permission denied');
      return;
    }

    this.initialStepCount = null;
    this.lastProcessedStep = 0;
    this.lastStepTime = Date.now();
    this.stepBuffer = 0;

    this.pedometerSubscription = Pedometer.watchStepCount(this.handleStepDetected.bind(this));

    const accelerometerAvailable = await Accelerometer.isAvailableAsync();
    if (!accelerometerAvailable) {
      console.error('Accelerometer not available');
      return;
    }

    Accelerometer.setUpdateInterval(100);
    this.accelerometerSubscription = Accelerometer.addListener((data) => {
      this.lastAccelSamples.push(data);
      while (this.lastAccelSamples.length > 10) this.lastAccelSamples.shift();
      this.accelerometerData = data;
      this.detectShake();
    });

    this.saveInterval = setInterval(() => this.checkAndSaveData(), 5000); // Every 5 seconds
  }

  stop() {
    if (this.pedometerSubscription) {
      this.pedometerSubscription.remove();
      this.pedometerSubscription = null;
    }
    if (this.accelerometerSubscription) {
      this.accelerometerSubscription.remove();
      this.accelerometerSubscription = null;
    }
    if (this.shakeTimeout) {
      clearTimeout(this.shakeTimeout);
    }
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
  }
}

const stepCounter = new StepCounter();
export default stepCounter;