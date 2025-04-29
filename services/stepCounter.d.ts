// E:\Stryde\services\stepCounter.d.ts
// Type definitions for stepCounter

export interface StepCounter {
  currentStepCount: number;
  rawStepCount: number;
  isShaking: boolean;
  lastStepTime: number;
  initialStepCount: number | null;
  sessionStartTime: number;
  lastSavedStepCount: number;
  stepBuffer: number;
  accelerometerData: { x: number; y: number; z: number };
  lastAccelSamples: { x: number; y: number; z: number }[];
  lastShakeCheck: number;
  lastProcessedStep: number;
  listeners: ((stepCount: number) => void)[];
  pedometerSubscription: any | null;
  accelerometerSubscription: any | null;
  userId: string | null;
  saveInterval: any | null;
  shakeTimeout: any | null;
  
  setUserId(userId: string): void;
  notifyListeners(): void;
  subscribe(listener: (stepCount: number) => void): () => void;
  loadSavedData(): Promise<void>;
  saveData(): Promise<void>;
  detectShake(): void;
  handleStepDetected(result: { steps: number }): void;
  checkAndSaveData(): Promise<void>;
  start(): Promise<void>;
  stop(): void;
}

// Default export of the stepCounter instance
declare const stepCounter: StepCounter;
export default stepCounter;