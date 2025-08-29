import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import 'react-native-worklets-core';
import HelloWorldModule from './HelloWorldModule';

export default function CameraScreen({ onClose }) {
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [isProcessing, setIsProcessing] = useState(false);
  const [calibrationStatus, setCalibrationStatus] = useState('Initializing...');
  const [frameStats, setFrameStats] = useState({});

  // Create worklet function for processing frame data
  const processFrameDataJS = Worklets.createRunOnJS((frameData, width, height, pixelFormat) => {
    if (!isProcessing) {
      setIsProcessing(true);
      
      setFrameStats({
        width: width,
        height: height,
        pixelFormat: pixelFormat,
        processingTime: Date.now()
      });

      // Only process frame data if available (requires minSdkVersion 26)
      if (frameData) {
        // Convert frame data to array for native processing
        const frameArray = Array.from(new Uint8Array(frameData));
        
        setFrameStats(prev => ({
          ...prev,
          totalPixels: frameArray.length
        }));

        // Process frame with native module
        HelloWorldModule.processFrameData(frameArray, width, height)
        .then((nativeResult) => {
          console.log('Native processing result:', nativeResult);
          setFrameStats(prev => ({
            ...prev,
            processedPixels: nativeResult.processedPixels,
            status: nativeResult.status
          }));
        })
        .catch((error) => {
          console.error('Native processing error:', error);
          setFrameStats(prev => ({
            ...prev,
            status: 'error'
          }));
        })
        .finally(() => {
          setIsProcessing(false);
        });
      } else {
        // Frame data not available (older Android version)
        setFrameStats(prev => ({
          ...prev,
          status: 'frame_data_unavailable',
          totalPixels: 0
        }));
        setIsProcessing(false);
      }
    }
  });

  const requestCameraPermission = useCallback(async () => {
    const permission = await requestPermission();
    if (permission !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is required to use this feature.');
    }
  }, [requestPermission]);

  // Initialize eye calibration
  useEffect(() => {
    HelloWorldModule.startEyeCalibration()
      .then((result) => {
        console.log('Calibration started:', result);
        setCalibrationStatus(result.message || 'Calibration active');
      })
      .catch((error) => {
        console.error('Calibration error:', error);
        setCalibrationStatus('Calibration failed');
      });
  }, []);

  // Real-time frame processor for VisionCamera V4
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    // Process frame data and send to native module
    const width = frame.width;
    const height = frame.height;
    const pixelFormat = frame.pixelFormat;
    
    // Get frame data as array buffer - this requires minSdkVersion 26
    try {
      const frameData = frame.toArrayBuffer();
      processFrameDataJS(frameData, width, height, pixelFormat);
    } catch (error) {
      // Fallback for older Android versions
      processFrameDataJS(null, width, height, pixelFormat);
    }
  }, [processFrameDataJS]);



  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Camera permission is required</Text>
        <TouchableOpacity style={styles.button} onPress={requestCameraPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.buttonText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No camera device found</Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.buttonText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        frameProcessor={frameProcessor}
      />
      <View style={styles.overlay}>
        <View style={styles.header}>
          <Text style={styles.headerText}>Eye Calibration</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.footer}>
          <Text style={styles.statusText}>
            {calibrationStatus}
          </Text>
          {frameStats.width && (
            <View style={styles.statsContainer}>
              <Text style={styles.statsText}>
                Frame: {frameStats.width}x{frameStats.height}
              </Text>
              <Text style={styles.statsText}>
                Total Pixels: {frameStats.totalPixels || 0}
              </Text>
              <Text style={styles.statsText}>
                Processed: {frameStats.processedPixels || 0}
              </Text>
              <Text style={styles.statsText}>
                Status: {frameStats.status || 'processing'}
              </Text>
            </View>
          )}
          <Text style={styles.statusText}>
            {isProcessing ? 'Processing frame...' : 'Camera active'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  text: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    margin: 20,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#FF3B30',
    padding: 10,
    borderRadius: 8,
    margin: 10,
    alignItems: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
  },
  headerText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 5,
  },
  statsContainer: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    minWidth: 200,
  },
  statsText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 2,
  },
});
