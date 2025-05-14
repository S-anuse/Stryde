const IoTStepCounter = {
  steps: 0,
  ws: null, // Store the WebSocket instance
  start: (onUpdate) => {
    // Use the native WebSocket API (built into JavaScript/Expo)
    const ws = new WebSocket('ws://192.168.0.105:81'); // Added port 81
    IoTStepCounter.ws = ws; // Store the WebSocket instance

    ws.onopen = () => {
      console.log('Connected to IoT device');
    };
    ws.onmessage = (e) => {
      // Validate the incoming data
      const newSteps = parseInt(e.data, 10);
      if (!isNaN(newSteps)) {
        IoTStepCounter.steps = newSteps;
        onUpdate(newSteps);
      } else {
        console.log('Invalid step data received:', e.data);
      }
    };
    ws.onerror = (e) => {
      console.error('IoT WebSocket error:', e);
    };
    ws.onclose = () => {
      console.log('IoT WebSocket closed');
    };
  },
  getSteps: () => IoTStepCounter.steps,
  stop: () => {
    if (IoTStepCounter.ws) {
      IoTStepCounter.ws.close();
      IoTStepCounter.ws = null;
      console.log('WebSocket connection closed manually');
    }
  },
};

export default IoTStepCounter;