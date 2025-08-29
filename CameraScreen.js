import React, { useState, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import 'react-native-worklets-core';
import HelloWorldModule from './HelloWorldModule';
import { EyeTracker } from './EyeTracker';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function CameraScreen({ onClose }) {
  const device = useCameraDevice('front'); // Use front camera for eye tracking
  const { hasPermission, requestPermission } = useCameraPermission();
  const [isProcessing, setIsProcessing] = useState(false);
  const [calibrationStatus, setCalibrationStatus] = useState('Initializing...');
  const [frameStats, setFrameStats] = useState({});
  const [eyeTrackingData, setEyeTrackingData] = useState(null);
  const [gazePoint, setGazePoint] = useState({ x: 0, y: 0 });
  const [calibrationPoint, setCalibrationPoint] = useState(null);
  const [showCalibrationInstructions, setShowCalibrationInstructions] = useState(false);
  
  const eyeTrackerRef = useRef(null);

  // Initialize EyeTracker
  useEffect(() => {
    eyeTrackerRef.current = new EyeTracker(screenWidth, screenHeight);
    setCalibrationStatus('Eye tracker initialized');
  }, []);

  // Create worklet function for processing MediaPipe results
  const processMediaPipeResultJS = Worklets.createRunOnJS((result) => {
    if (!eyeTrackerRef.current || !result || result.status !== 'success') {
      return;
    }

    try {
      const landmarks = result.faceLandmarks && result.faceLandmarks.length > 0 
        ? result.faceLandmarks[0] 
        : null;

      if (landmarks) {
        const timestamp = Date.now();
        const trackingResult = eyeTrackerRef.current.processLandmarks(landmarks, timestamp);
        
        if (trackingResult) {
          setEyeTrackingData(trackingResult);
          
          if (trackingResult.isCalibrating) {
            setCalibrationPoint(trackingResult.currentCalibPoint);
            setCalibrationStatus(`Calibration: ${Math.round(trackingResult.calibrationProgress * 100)}%`);
          } else {
            setGazePoint({ x: trackingResult.gaze[0], y: trackingResult.gaze[1] });
            setCalibrationStatus('Eye tracking active');
          }
        }
      }
    } catch (error) {
      console.error('Error processing eye tracking data:', error);
    }
  });

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

      // Process frame with MediaPipe
      if (frameData) {
        const frameArray = Array.from(new Uint8Array(frameData));
        
        HelloWorldModule.processCameraFrame(frameArray, width, height, pixelFormat)
        .then((result) => {
          processMediaPipeResultJS(result);
          setFrameStats(prev => ({
            ...prev,
            status: 'success',
            numFaces: result.numFaces || 0
          }));
        })
        .catch((error) => {
          console.error('MediaPipe processing error:', error);
          setFrameStats(prev => ({
            ...prev,
            status: 'error'
          }));
        })
        .finally(() => {
          setIsProcessing(false);
        });
      } else {
        setFrameStats(prev => ({
          ...prev,
          status: 'frame_data_unavailable'
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

  // Real-time frame processor for VisionCamera V4
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    const width = frame.width;
    const height = frame.height;
    const pixelFormat = frame.pixelFormat;
    
    try {
      const frameData = frame.toArrayBuffer();
      processFrameDataJS(frameData, width, height, pixelFormat);
    } catch (error) {
      processFrameDataJS(null, width, height, pixelFormat);
    }
  }, [processFrameDataJS]);

  const startCalibration = () => {
    if (eyeTrackerRef.current) {
      setShowCalibrationInstructions(true);
    }
  };

  const beginCalibration = () => {
    setShowCalibrationInstructions(false);
    if (eyeTrackerRef.current) {
      eyeTrackerRef.current.startCalibration();
      setCalibrationStatus('Starting calibration...');
    }
  };

  const moveToNextCalibrationPoint = () => {
    if (eyeTrackerRef.current) {
      eyeTrackerRef.current.moveToNextCalibrationPoint();
    }
  };

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
        <Text style={styles.text}>No front camera device found</Text>
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
      
      {/* Calibration Instructions Overlay */}
      {showCalibrationInstructions && (
        <View style={styles.instructionsOverlay}>
          <View style={styles.instructionsContent}>
            <Text style={styles.instructionsTitle}>Eye Tracking Calibration</Text>
            <Text style={styles.instructionsText}>
              To calibrate properly you need to gaze at 25 red circles.
            </Text>
            <Text style={styles.instructionsText}>
              The blue circle is your estimated gaze. With every calibration point, 
              the tracker will gradually improve accuracy.
            </Text>
            <TouchableOpacity style={styles.continueButton} onPress={beginCalibration}>
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Gaze Cursor */}
      {!eyeTrackingData?.isCalibrating && gazePoint.x > 0 && gazePoint.y > 0 && (
        <View 
          style={[
            styles.gazeCursor, 
            { 
              left: gazePoint.x - 10, 
              top: gazePoint.y - 10 
            }
          ]} 
        />
      )}

      {/* Calibration Point */}
      {eyeTrackingData?.isCalibrating && calibrationPoint && (
        <View>
          <View 
            style={[
              styles.calibrationPoint, 
              { 
                left: calibrationPoint[0] - 15, 
                top: calibrationPoint[1] - 15 
              }
            ]} 
          />
          <TouchableOpacity 
            style={styles.nextPointButton}
            onPress={moveToNextCalibrationPoint}
          >
            <Text style={styles.buttonText}>Next Point</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.overlay}>
        <View style={styles.header}>
          <Text style={styles.headerText}>Eye Tracking</Text>
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
                Faces: {frameStats.numFaces || 0}
              </Text>
              <Text style={styles.statsText}>
                Status: {frameStats.status || 'processing'}
              </Text>
            </View>
          )}

          {eyeTrackingData?.features && (
            <View style={styles.metricsContainer}>
              <Text style={styles.metricsTitle}>Eye Metrics:</Text>
              <Text style={styles.metricsText}>
                Fixations: {eyeTrackingData.features.fixationCount}
              </Text>
              <Text style={styles.metricsText}>
                Saccades: {eyeTrackingData.features.totalSaccades}
              </Text>
              <Text style={styles.metricsText}>
                Gaze Duration: {Math.round(eyeTrackingData.features.gazeDuration)}ms
              </Text>
            </View>
          )}

          {!eyeTrackingData?.isCalibrating && (
            <TouchableOpacity style={styles.calibrateButton} onPress={startCalibration}>
              <Text style={styles.buttonText}>Start Calibration</Text>
            </TouchableOpacity>
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
  metricsContainer: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    minWidth: 200,
  },
  metricsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  metricsText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 2,
  },
  calibrateButton: {
    backgroundColor: '#34C759',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  gazeCursor: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#5e17eb',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 1000,
  },
  calibrationPoint: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ff5757',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 1000,
  },
  nextPointButton: {
    position: 'absolute',
    bottom: 100,
    left: '50%',
    marginLeft: -50,
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    width: 100,
  },
  instructionsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  instructionsContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
    maxWidth: '80%',
  },
  instructionsTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  instructionsText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  continueButton: {
    backgroundColor: '#5e17eb',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
    minWidth: 120,
  },
});
