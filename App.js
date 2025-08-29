import { StyleSheet, Text, View, TouchableOpacity, StatusBar } from 'react-native';
import { useState, useEffect } from 'react';
import HelloWorldModule from './HelloWorldModule';
import CameraScreen from './CameraScreen';

export default function App() {
  const [message, setMessage] = useState('Loading...');
  const [showCamera, setShowCamera] = useState(false);

  useEffect(() => {
    // Call the native Kotlin module
    HelloWorldModule.getHelloWorld()
      .then((result) => {
        setMessage(result);
      })
      .catch((error) => {
        setMessage('Error: ' + error.message);
      });
  }, []);

  if (showCamera) {
    return <CameraScreen onClose={() => setShowCamera(false)} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
      <TouchableOpacity 
        style={styles.calibrationButton} 
        onPress={() => setShowCamera(true)}
      >
        <Text style={styles.buttonText}>Start Eye Calibration</Text>
      </TouchableOpacity>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 30,
  },
  calibrationButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
