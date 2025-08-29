import { Dimensions } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Helper function to calculate Euclidean distance between two points
function euclideanDistance(p1, p2) {
  return Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2));
}

// Helper function to calculate the centroid of a set of points
function calculateCentroid(points) {
  if (points.length === 0) return [0, 0];
  const sumX = points.reduce((sum, p) => sum + p[0], 0);
  const sumY = points.reduce((sum, p) => sum + p[1], 0);
  return [sumX / points.length, sumY / points.length];
}

// EyeFeatureExtractor: Calculates eye metrics from landmarks
class EyeFeatureExtractor {
  constructor() {
    this.fixationRadius = 50; // Pixels
    this.fixationDuration = 100; // Milliseconds
    this.saccadeThreshold = 30; // Pixels
    this.gazeHistory = [];
    this.fixations = [];
    this.saccades = [];
    this.lastGazePoint = null;
    this.lastGazeTimestamp = null;
    this.lastFixationStart = null;
    this.lastFixationPoint = null;
  }

  reset() {
    this.gazeHistory = [];
    this.fixations = [];
    this.saccades = [];
    this.lastGazePoint = null;
    this.lastGazeTimestamp = null;
    this.lastFixationStart = null;
    this.lastFixationPoint = null;
  }

  processGaze(gazePoint, timestamp) {
    this.gazeHistory.push({ point: gazePoint, timestamp: timestamp });

    if (this.lastGazePoint) {
      const distance = euclideanDistance(this.lastGazePoint, gazePoint);
      if (distance > this.saccadeThreshold) {
        this.saccades.push({
          start: this.lastGazePoint,
          end: gazePoint,
          distance: distance,
          duration: timestamp - this.lastGazeTimestamp,
        });
        // If a saccade occurred, end any ongoing fixation
        if (this.lastFixationStart) {
          this.endFixation(this.lastGazePoint, this.lastGazeTimestamp);
        }
        this.lastFixationStart = null;
        this.lastFixationPoint = null;
      } else {
        // Possible fixation
        if (!this.lastFixationStart) {
          this.lastFixationStart = timestamp;
          this.lastFixationPoint = gazePoint;
        } else if (timestamp - this.lastFixationStart >= this.fixationDuration) {
          // Confirm fixation if duration met and still within radius
          if (euclideanDistance(this.lastFixationPoint, gazePoint) <= this.fixationRadius) {
            // Fixation continues, update point to average
            this.lastFixationPoint = [
              (this.lastFixationPoint[0] + gazePoint[0]) / 2,
              (this.lastFixationPoint[1] + gazePoint[1]) / 2,
            ];
          } else {
            // Fixation ended, new one might start
            this.endFixation(this.lastFixationPoint, timestamp);
            this.lastFixationStart = timestamp;
            this.lastFixationPoint = gazePoint;
          }
        }
      }
    }

    this.lastGazePoint = gazePoint;
    this.lastGazeTimestamp = timestamp;
  }

  endFixation(point, timestamp) {
    if (this.lastFixationStart) {
      const duration = timestamp - this.lastFixationStart;
      if (duration >= this.fixationDuration) {
        this.fixations.push({
          point: point,
          duration: duration,
          start: this.lastFixationStart,
          end: timestamp,
        });
      }
    }
    this.lastFixationStart = null;
    this.lastFixationPoint = null;
  }

  getMetrics() {
    // Ensure any ongoing fixation is ended before getting metrics
    if (this.lastFixationStart && this.lastGazePoint && this.lastGazeTimestamp) {
      this.endFixation(this.lastGazePoint, this.lastGazeTimestamp);
    }

    const totalGazeDuration = this.gazeHistory.length > 1
      ? this.gazeHistory[this.gazeHistory.length - 1].timestamp - this.gazeHistory[0].timestamp
      : 0;

    const fixationCount = this.fixations.length;
    const totalSaccades = this.saccades.length;

    // Simplified dwell time (sum of fixation durations)
    const dwellTime = this.fixations.reduce((sum, f) => sum + f.duration, 0);

    // Simplified refixation ratio (needs more complex logic with AOIs, for now just a placeholder)
    const refixationRatio = fixationCount > 0 ? (fixationCount - 1) / fixationCount : 0;

    // Simplified distractor saccades (needs AOI definition, for now placeholder)
    const distractorSaccades = 0; 

    // Simplified saccade length (average saccade distance)
    const saccadeLength = totalSaccades > 0 
      ? this.saccades.reduce((sum, s) => sum + s.distance, 0) / totalSaccades 
      : 0;

    return {
      gazeDuration: totalGazeDuration,
      dwellTime: dwellTime,
      saccadeLength: saccadeLength,
      distractorSaccades: distractorSaccades,
      fixationCount: fixationCount,
      refixationRatio: refixationRatio,
    };
  }
}

// Calibrator: Handles calibration points and gaze prediction
class Calibrator {
  constructor(screenWidth, screenHeight) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.calibrationPoints = [];
    this.gazeData = [];
    this.model = null; // Stores the linear regression model
    this.isCalibrating = false;
    this.currentCalibrationIndex = 0;
    this.calibrationTargets = this._generateCalibrationTargets();
    this.samplesPerPoint = 30; // Number of gaze samples to collect per calibration point
    this.currentSamples = 0;
  }

  _generateCalibrationTargets() {
    const targets = [];
    const numRows = 5;
    const numCols = 5;
    const xStep = this.screenWidth / (numCols + 1);
    const yStep = this.screenHeight / (numRows + 1);

    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        targets.push([(c + 1) * xStep, (r + 1) * yStep]);
      }
    }
    return targets;
  }

  startCalibration() {
    this.isCalibrating = true;
    this.currentCalibrationIndex = 0;
    this.gazeData = [];
    this.model = null;
    this.currentSamples = 0;
    console.log("Starting calibration with targets:", this.calibrationTargets);
  }

  addGazeSample(faceLandmarks, screenGazePoint) {
    if (!this.isCalibrating) return;

    const targetPoint = this.calibrationTargets[this.currentCalibrationIndex];
    if (!targetPoint) return; // Should not happen if calibration is managed correctly

    // For simplicity, we'll use the raw landmark data as features.
    // In a real scenario, you'd extract specific eye-related features.
    const features = this._extractFeatures(faceLandmarks);

    this.gazeData.push({
      features: features,
      gaze: screenGazePoint, // This is the raw gaze from the eye model
      target: targetPoint,
    });
    this.currentSamples++;

    if (this.currentSamples >= this.samplesPerPoint) {
      this.currentCalibrationIndex++;
      this.currentSamples = 0;
      if (this.currentCalibrationIndex >= this.calibrationTargets.length) {
        this.finishCalibration();
      }
    }
  }

  moveToNextCalibrationPoint() {
    if (this.isCalibrating && this.currentCalibrationIndex < this.calibrationTargets.length) {
      this.currentCalibrationIndex++;
      this.currentSamples = 0;
      if (this.currentCalibrationIndex >= this.calibrationTargets.length) {
        this.finishCalibration();
      }
    }
  }

  finishCalibration() {
    this.isCalibrating = false;
    console.log("Finishing calibration. Collected data:", this.gazeData.length, "samples");
    this._trainModel();
  }

  _extractFeatures(landmarks) {
    // Extract specific landmarks for the eyes and create a feature vector.
    // These indices correspond to MediaPipe Face Mesh landmarks for eyes.
    const leftEyeOuterCorner = landmarks[33];
    const leftEyeInnerCorner = landmarks[133];
    const rightEyeOuterCorner = landmarks[362];
    const rightEyeInnerCorner = landmarks[263];
    const leftIrisCenter = landmarks[468]; // Assuming iris landmarks are available
    const rightIrisCenter = landmarks[473];

    if (!leftEyeOuterCorner || !leftEyeInnerCorner || !rightEyeOuterCorner || !rightEyeInnerCorner || !leftIrisCenter || !rightIrisCenter) {
      // Fallback or error handling if crucial landmarks are missing
      console.warn("Missing crucial eye landmarks for feature extraction.");
      return new Array(10).fill(0); // Return a dummy feature vector
    }

    // Example features: distances and relative positions
    const features = [
      leftIrisCenter.x - leftEyeOuterCorner.x,
      leftIrisCenter.y - leftEyeOuterCorner.y,
      rightIrisCenter.x - rightEyeOuterCorner.x,
      rightIrisCenter.y - rightEyeOuterCorner.y,
      euclideanDistance([leftEyeOuterCorner.x, leftEyeOuterCorner.y], [leftEyeInnerCorner.x, leftEyeInnerCorner.y]),
      euclideanDistance([rightEyeOuterCorner.x, rightEyeOuterCorner.y], [rightEyeInnerCorner.x, rightEyeInnerCorner.y]),
      leftIrisCenter.x,
      leftIrisCenter.y,
      rightIrisCenter.x,
      rightIrisCenter.y,
    ];
    return features;
  }

  _trainModel() {
    if (this.gazeData.length === 0) {
      console.warn("No gaze data collected for training.");
      this.model = null;
      return;
    }

    // Simple linear regression model (placeholder - in a real app, use a library like `ml-matrix` or `brain.js`)
    // This is a very basic implementation and will likely not be very accurate.
    // For a robust solution, consider a proper machine learning library.

    // We need to map features (X) to target screen coordinates (Y)
    const X = this.gazeData.map(d => d.features);
    const Y_x = this.gazeData.map(d => d.target[0]);
    const Y_y = this.gazeData.map(d => d.target[1]);

    // For simplicity, we'll just store the average offset for now.
    // A real linear regression would calculate weights for each feature.
    let sumOffsetX = 0;
    let sumOffsetY = 0;
    for (let i = 0; i < this.gazeData.length; i++) {
      sumOffsetX += (this.gazeData[i].target[0] - this.gazeData[i].gaze[0]);
      sumOffsetY += (this.gazeData[i].target[1] - this.gazeData[i].gaze[1]);
    }

    this.model = {
      offsetX: sumOffsetX / this.gazeData.length,
      offsetY: sumOffsetY / this.gazeData.length,
      // In a real model, you'd have coefficients for each feature
      // For example: weightsX: [...], weightsY: [...], interceptX, interceptY
    };
    console.log("Calibration model trained:", this.model);
  }

  predictGaze(faceLandmarks) {
    if (!this.model) {
      console.warn("Calibration model not trained. Cannot predict gaze.");
      return null;
    }

    const features = this._extractFeatures(faceLandmarks);

    // Apply the simple offset model
    // In a real model, you'd multiply features by weights and add intercept
    const predictedX = features[6] + this.model.offsetX; // Using leftIrisCenter.x as base
    const predictedY = features[7] + this.model.offsetY; // Using leftIrisCenter.y as base

    // Clamp to screen boundaries
    const clampedX = Math.max(0, Math.min(this.screenWidth, predictedX));
    const clampedY = Math.max(0, Math.min(this.screenHeight, predictedY));

    return [clampedX, clampedY];
  }

  getCurrentCalibrationPoint() {
    return this.calibrationTargets[this.currentCalibrationIndex];
  }

  getCalibrationProgress() {
    if (!this.isCalibrating) return 1; // 100% if not calibrating
    const totalSamplesNeeded = this.calibrationTargets.length * this.samplesPerPoint;
    const collectedSamples = this.currentCalibrationIndex * this.samplesPerPoint + this.currentSamples;
    return collectedSamples / totalSamplesNeeded;
  }
}

// Main EyeTracker class
export class EyeTracker {
  constructor(screenWidth, screenHeight) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.calibrator = new Calibrator(screenWidth, screenHeight);
    this.featureExtractor = new EyeFeatureExtractor();
    this.isCalibrating = false;
    this.gaze = [screenWidth / 2, screenHeight / 2]; // Default gaze to center
    this.currentCalibPoint = null;
    this.calibrationProgress = 0;
  }

  startCalibration() {
    this.isCalibrating = true;
    this.calibrator.startCalibration();
    this.featureExtractor.reset();
    this.currentCalibPoint = this.calibrator.getCurrentCalibrationPoint();
    this.calibrationProgress = this.calibrator.getCalibrationProgress();
  }

  moveToNextCalibrationPoint() {
    this.calibrator.moveToNextCalibrationPoint();
    this.currentCalibPoint = this.calibrator.getCurrentCalibrationPoint();
    this.calibrationProgress = this.calibrator.getCalibrationProgress();
    if (!this.isCalibrating) {
      // Calibration finished
      this.currentCalibPoint = null;
    }
  }

  processLandmarks(landmarks, timestamp) {
    // Extract raw eye positions from landmarks
    const leftIrisCenter = landmarks[468];
    const rightIrisCenter = landmarks[473];

    if (!leftIrisCenter || !rightIrisCenter) {
      console.warn("Iris landmarks not found. Cannot estimate gaze.");
      return null;
    }

    // Simple average of iris centers for raw gaze estimation (in camera frame coordinates)
    const rawGazeX = (leftIrisCenter.x + rightIrisCenter.x) / 2;
    const rawGazeY = (leftIrisCenter.y + rightIrisCenter.y) / 2;

    // Map camera coordinates to screen coordinates (simple scaling for now)
    // This mapping needs to be more sophisticated with proper camera intrinsics and head pose
    // For now, assume camera frame is roughly proportional to screen
    const screenGazeX = rawGazeX * this.screenWidth; // Assuming landmarks are normalized 0-1
    const screenGazeY = rawGazeY * this.screenHeight;

    const rawGazePoint = [screenGazeX, screenGazeY];

    if (this.isCalibrating) {
      this.calibrator.addGazeSample(landmarks, rawGazePoint);
      this.currentCalibPoint = this.calibrator.getCurrentCalibrationPoint();
      this.calibrationProgress = this.calibrator.getCalibrationProgress();
      if (!this.calibrator.isCalibrating) {
        this.isCalibrating = false; // Calibration finished
      }
    }

    let predictedGaze = rawGazePoint;
    if (this.calibrator.model) {
      predictedGaze = this.calibrator.predictGaze(landmarks);
    }

    if (predictedGaze) {
      this.gaze = predictedGaze;
      this.featureExtractor.processGaze(this.gaze, timestamp);
    }

    return {
      gaze: this.gaze,
      isCalibrating: this.isCalibrating,
      currentCalibPoint: this.currentCalibPoint,
      calibrationProgress: this.calibrationProgress,
      features: this.featureExtractor.getMetrics(),
    };
  }
}
