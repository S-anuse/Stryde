declare module 'iotStepCounter' {
  interface IoTStepCounter {
    steps: number;
    start: (onUpdate: (newSteps: number) => void) => void;
    getSteps: () => number;
  }

  const IoTStepCounter: IoTStepCounter;
  export default IoTStepCounter;
}