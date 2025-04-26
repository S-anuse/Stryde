declare class StepCounter {
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
    listeners: Array<(stepCount: number) => void>;
    pedometerSubscription: any;
    accelerometerSubscription: any;
    shakeTimeout?: NodeJS.Timeout;
    saveInterval?: NodeJS.Timeout;
  
    constructor();
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
  
  declare const stepCounter: StepCounter;
  export default stepCounter;