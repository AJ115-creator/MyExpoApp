# Eye Tracking Logic and 6 Eye Metrics Calculation

## Overview

This document provides a comprehensive analysis of the eye tracking implementation across two codebases:
1. **Main React Native App** - Using Vision Camera and MediaPipe integration
2. **EGLV4 Library** - Web-based eye tracking with MediaPipe Face Mesh

Both implementations extract 6 key eye tracking metrics using different approaches but similar mathematical principles.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Eye Tracking Pipeline](#eye-tracking-pipeline)
3. [The 6 Eye Metrics](#the-6-eye-metrics)
4. [Implementation Details](#implementation-details)
5. [Code Analysis](#code-analysis)
6. [Mathematical Formulas](#mathematical-formulas)
7. [Performance Considerations](#performance-considerations)

---

## Architecture Overview

### Main React Native App Architecture

```
Vision Camera → Frame Processor → MediaPipe Face Mesh → Eye Tracking Processor → Metrics Calculation
```

**Key Components:**
- `CameraView.tsx` - Camera interface and permissions
- `eyeTrackingProcessor.ts` - Frame processing and metrics calculation
- `eyeStore.ts` - Global state management
- `MediaPipeFrameProcessor.ts` - MediaPipe integration (currently disabled)

### EGLV4 Library Architecture

```
Web Camera → MediaPipe Face Mesh → Calibration → Feature Extraction → 6 Metrics
```

**Key Components:**
- `eyegestures.js` - Main eye tracking library
- `eye_features.js` - Feature extraction and metrics calculation
- `calibration.js` - Calibration system
- `fixation.js` - Fixation detection

---

## Eye Tracking Pipeline

### 1. Camera Initialization

**Main App:**
```typescript
// CameraView.tsx
const device = useCameraDevice('front');
const { hasPermission, requestPermission } = useCameraPermission();

// Frame processor setup
const frameProcessor = useFrameProcessor((frame) => {
  'worklet';
  // MediaPipe processing will be added here
}, []);
```

**EGLV4:**
```javascript
// eyegestures.js
async function createCameraStream() {
    const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 15 }
        }
    });
    return stream;
}
```

### 2. MediaPipe Face Mesh Integration

**Main App (Planned):**
```typescript
// MediaPipeFrameProcessor.ts (currently disabled)
export function mediaPipeFaceLandmarks(frame: any): MediaPipeFrameResult | null {
  // Will process frames with MediaPipe Face Mesh
  // Extract 468 facial landmarks
  // Focus on eye region landmarks (33-159 for left eye, 362-386 for right eye)
}
```

**EGLV4 (Active):**
```javascript
// eyegestures.js
const faceMesh = new FaceMesh({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

// Eye landmark indices
const LEFT_EYE_KEYPOINTS = [33, 133, 160, 159, 158, 157, 173, 155, 154, 153, 144, 145, 153, 246, 468];
const RIGHT_EYE_KEYPOINTS = [362, 263, 387, 386, 385, 384, 398, 382, 381, 380, 374, 373, 374, 466, 473];
```

### 3. Landmark Processing

**EGLV4 Landmark Extraction:**
```javascript
// eyegestures.js - onFaceMeshResults()
for (var landmarks of results.multiFaceLandmarks) {
    // Calculate face bounding box
    landmarks.forEach(landmark => {
        offset_x = Math.min(offset_x, landmark.x);
        offset_y = Math.min(offset_y, landmark.y);
        max_x = Math.max(max_x, landmark.x);
        max_y = Math.max(max_y, landmark.y);
    });

    // Extract eye coordinates
    let l_landmarks = LEFT_EYE_KEYPOINTS.map(index => landmarks[index]);
    let r_landmarks = RIGHT_EYE_KEYPOINTS.map(index => landmarks[index]);
    
    // Normalize coordinates
    left_eye_coordinates.push([
        (((landmark.x - offset_x) / width) * scale_x),
        (((landmark.y - offset_y) / height) * scale_y)
    ]);
}
```

### 4. Calibration System

**EGLV4 Calibration:**
```javascript
// calibration.js
class Calibrator {
    constructor(CALIBRATION_RADIUS = 1000) {
        this.X = []; // Input features
        this.Y_y = []; // Target Y coordinates
        this.Y_x = []; // Target X coordinates
        this.reg_x = null; // X regression model
        this.reg_y = null; // Y regression model
    }

    add(x, y) {
        // Add calibration point
        const flatX = [].concat(x.flat());
        this.__tmp_X.push(flatX);
        this.__tmp_Y_y.push([y[0]]);
        this.__tmp_Y_x.push([y[1]]);
        
        // Train regression models
        this.reg_x = new ML.MultivariateLinearRegression(this.__tmp_X, this.__tmp_Y_y);
        this.reg_y = new ML.MultivariateLinearRegression(this.__tmp_X, this.__tmp_Y_x);
    }

    predict(x) {
        if (this.fitted) {
            const flatX = [].concat(x.flat());
            const yx = this.reg_x.predict(flatX)[0];
            const yy = this.reg_y.predict(flatX)[0];
            return [yx, yy];
        }
        return [0.0, 0.0];
    }
}
```

---

## The 6 Eye Metrics

### 1. Gaze Duration
**Definition:** Total time spent looking at any point on screen

**Calculation:**
```javascript
// eye_features.js
updateGazeDuration(timestamp) {
    if (this.lastTimestamp) {
        const timeDiff = timestamp - this.lastTimestamp;
        this.totalGazeDuration += timeDiff;
    }
}
```

**Formula:** `Gaze Duration = Σ(timeDiff between consecutive gaze points)`

### 2. Dwell Time
**Definition:** Time spent in specific areas of interest

**Calculation:**
```javascript
// eye_features.js
updateDwellTime(gazePoint) {
    const currentArea = this.getCurrentArea(gazePoint);
    
    if (currentArea && this.currentArea === currentArea) {
        if (this.lastTimestamp) {
            const timeDiff = gazePoint.timestamp - this.lastTimestamp;
            this.totalDwellTime += timeDiff;
        }
    }
    
    this.currentArea = currentArea;
}
```

**Formula:** `Dwell Time = Σ(timeDiff while gaze is within defined areas)`

### 3. Saccade Length
**Definition:** Average distance of rapid eye movements

**Calculation:**
```javascript
// eye_features.js
detectSaccade(gazePoint) {
    if (!this.lastGazePoint) return;
    
    const distance = this.calculateDistance(this.lastGazePoint, gazePoint);
    const timeDiff = gazePoint.timestamp - this.lastGazePoint.timestamp;
    
    if (distance > this.saccadeThreshold && timeDiff < 100) {
        this.saccades.push({
            start: this.lastGazePoint,
            end: gazePoint,
            length: distance,
            duration: timeDiff
        });
        
        this.totalSaccadeLength += distance;
    }
}
```

**Formula:** `Saccade Length = Σ(distance between consecutive points) / number of saccades`

### 4. Distractor Saccades
**Definition:** Count of saccades to non-interest areas

**Calculation:**
```javascript
// eye_features.js
isDistractorSaccade(gazePoint) {
    const currentArea = this.getCurrentArea(gazePoint);
    return !currentArea; // Returns true if gaze is outside all areas of interest
}

// In detectSaccade()
if (this.isDistractorSaccade(gazePoint)) {
    this.distractorSaccadeCount++;
}
```

**Formula:** `Distractor Saccades = Count(saccades where end point is outside areas of interest)`

### 5. Fixation Count
**Definition:** Number of distinct fixations (stable gaze periods)

**Calculation:**
```javascript
// eye_features.js
detectFixation(gazePoint) {
    if (!this.currentFixation) {
        // Start new fixation
        this.currentFixation = {
            start: gazePoint,
            center: { x: gazePoint.x, y: gazePoint.y },
            duration: 0
        };
    } else {
        const distance = this.calculateDistance(this.currentFixation.center, gazePoint);
        
        if (distance <= this.fixationRadius) {
            // Continue current fixation
            this.currentFixation.duration = gazePoint.timestamp - this.currentFixation.start.timestamp;
        } else {
            // End current fixation if it meets minimum duration
            if (this.currentFixation.duration >= this.fixationDuration) {
                this.fixations.push(this.currentFixation);
                this.fixationCount++;
            }
            
            // Start new fixation
            this.currentFixation = {
                start: gazePoint,
                center: { x: gazePoint.x, y: gazePoint.y },
                duration: 0
            };
        }
    }
}
```

**Formula:** `Fixation Count = Count(fixations with duration ≥ minimum threshold)`

### 6. Refixation Ratio
**Definition:** Ratio of revisits to areas of interest

**Calculation:**
```javascript
// eye_features.js
updateRefixationRatio(gazePoint) {
    const currentArea = this.getCurrentArea(gazePoint);
    
    if (currentArea) {
        const visitCount = this.visitedAreas.get(currentArea.id) || 0;
        this.visitedAreas.set(currentArea.id, visitCount + 1);
        
        if (visitCount > 0) {
            this.refixationCount++;
        }
    }
}

// In getFeatures()
const refixationRatio = this.fixationCount > 0 ? 
    this.refixationCount / this.fixationCount : 0;
```

**Formula:** `Refixation Ratio = Number of revisits / Total fixations`

---

## Implementation Details

### Main App Implementation

**Frame Processing Loop:**
```typescript
// eyeTrackingProcessor.ts
const processFrame = useCallback(() => {
    const startTime = Date.now();
    
    try {
        // TODO: Replace with actual MediaPipe Face Mesh processing
        const mockFrame: EyeTrackingFrame = {
            timestamp: Date.now(),
            faceId: 0,
            landmarks: generateMockLandmarks(),
            leftEye: {
                center: [0.3, 0.4],
                bbox: [0.25, 0.35, 0.35, 0.45],
                landmarks: generateMockEyeLandmarks(0.3, 0.4)
            },
            rightEye: {
                center: [0.7, 0.4],
                bbox: [0.65, 0.35, 0.75, 0.45],
                landmarks: generateMockEyeLandmarks(0.7, 0.4)
            },
            faceOval: generateMockFaceOval(),
            gaze: [0, 0, -1],
            confidence: 0.9
        };
        
        setCurrentFrame(mockFrame);
        frameProcessorManager.recordProcessingTime(Date.now() - startTime, true);
        
    } catch (error) {
        console.error('Frame processing error:', error);
        frameProcessorManager.recordProcessingTime(Date.now() - startTime, false);
    }
}, []);
```

**Performance Management:**
```typescript
// eyeTrackingProcessor.ts
class FrameProcessorManager {
    private maxFps = 30;
    private frameInterval = 1000 / 30; // 33.33ms between frames
    
    canProcessFrame(): boolean {
        if (!this.isRunning) return false;
        
        const now = Date.now();
        const timeSinceLastFrame = now - this.lastFrameTime;
        
        if (timeSinceLastFrame >= this.frameInterval) {
            this.lastFrameTime = now;
            return true;
        }
        
        return false;
    }
}
```

### EGLV4 Implementation

**Real-time Processing:**
```javascript
// eyegestures.js
async function processFrame() {
    const videoElement = document.getElementById("video");
    if (videoElement.readyState !== videoElement.HAVE_ENOUGH_DATA) {
        requestAnimationFrame(processFrame);
        return;
    }

    const canvas = document.getElementById("output_canvas");
    const ctx = canvas.getContext("2d");
    
    try {
        ctx.save();
        ctx.scale(-1, 1); // Flip horizontally
        ctx.translate(-canvas.width, 0);
        faceMesh.send({ image: videoElement });
        ctx.restore();
    } catch (error) {
        console.error('Error processing frame:', error);
    }
    
    requestAnimationFrame(processFrame);
}
```

**Feature Extraction Integration:**
```javascript
// eyegestures.js
processKeyPoints(left_eye_coordinates, right_eye_coordinates, offset_x, offset_y, scale_x, scale_y, width, height) {
    let keypoints = left_eye_coordinates;
    keypoints = keypoints.concat(right_eye_coordinates);
    keypoints = keypoints.concat([[scale_x, scale_y]]);
    keypoints = keypoints.concat([[width, height]]);
    
    let point = this.calibrator.predict(keypoints);
    this.buffor.push(point);
    
    // Apply smoothing
    if (this.buffor_max < this.buffor.length) {
        this.buffor.shift();
    }
    
    let average_point = [0, 0];
    if (this.buffor.length > 0) {
        average_point = this.buffor.reduce(
            (sum, current) => [sum[0] + current[0], sum[1] + current[1]],
            [0, 0]
        ).map(coord => coord / this.buffor.length);
    }
    
    this.onGaze(average_point, calibration);
}
```

---

## Code Analysis

### Key Differences Between Implementations

| Aspect | Main App | EGLV4 |
|--------|----------|-------|
| **Platform** | React Native | Web Browser |
| **Camera** | Vision Camera | WebRTC getUserMedia |
| **Processing** | Frame processor (planned) | RequestAnimationFrame |
| **Calibration** | Not implemented | ML-based regression |
| **Metrics** | Mock data (planned) | Real-time calculation |
| **Performance** | 30 FPS throttled | 60 FPS target |

### Common Mathematical Principles

Both implementations use these core algorithms:

1. **Euclidean Distance:**
```javascript
calculateDistance(point1, point2) {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
}
```

2. **Moving Average Smoothing:**
```javascript
// EGLV4 implementation
let average_point = this.buffor.reduce(
    (sum, current) => [sum[0] + current[0], sum[1] + current[1]],
    [0, 0]
).map(coord => coord / this.buffor.length);
```

3. **Threshold-based Detection:**
```javascript
// Fixation detection
if (distance <= this.fixationRadius) {
    // Continue fixation
} else {
    // End fixation
}

// Saccade detection
if (distance > this.saccadeThreshold && timeDiff < 100) {
    // Detect saccade
}
```

---

## Mathematical Formulas

### 1. Gaze Point Calculation
```
Normalized_X = (landmark.x - offset_x) / width * scale_x
Normalized_Y = (landmark.y - offset_y) / height * scale_y
```

### 2. Calibration Regression
```
Predicted_X = reg_x.predict([eye_landmarks, face_scale, head_offset])
Predicted_Y = reg_y.predict([eye_landmarks, face_scale, head_offset])
```

### 3. Fixation Detection
```
Distance = √((x₂ - x₁)² + (y₂ - y₁)²)
Is_Fixation = Distance ≤ fixation_radius AND Duration ≥ min_duration
```

### 4. Saccade Detection
```
Distance = √((x₂ - x₁)² + (y₂ - y₁)²)
Is_Saccade = Distance > saccade_threshold AND Time_diff < 100ms
```

### 5. Moving Average Smoothing
```
Smoothed_X = Σ(x_i) / n
Smoothed_Y = Σ(y_i) / n
where n = buffer_size (typically 20)
```

### 6. Refixation Ratio
```
Refixation_Ratio = Number_of_revisits / Total_fixations
```

---

## Performance Considerations

### Main App Performance

**Frame Rate Management:**
- Target: 30 FPS for battery efficiency
- Frame interval: 33.33ms between frames
- Processing time tracking for optimization

**Memory Management:**
```typescript
// Keep only last 30 processing times for average calculation
if (this.processingTimes.length > 30) {
    this.processingTimes.shift();
}
```

### EGLV4 Performance

**Real-time Processing:**
- Target: 60 FPS using RequestAnimationFrame
- Buffer management: 20-point moving average
- Canvas optimization for rendering

**Memory Optimization:**
```javascript
// Keep only last 1000 gaze points to prevent memory issues
if (this.gazeHistory.length > 1000) {
    this.gazeHistory.shift();
}
```

### Optimization Strategies

1. **Throttling:** Limit processing frequency to conserve resources
2. **Buffering:** Use moving averages to smooth noisy data
3. **Caching:** Store calculated metrics to avoid recomputation
4. **Lazy Loading:** Only process frames when needed
5. **Error Handling:** Graceful degradation when processing fails

---

## Conclusion

Both implementations follow similar mathematical principles for eye tracking metrics calculation, but differ in their execution environment and current implementation status:

- **EGLV4** provides a complete, working implementation with real-time metrics
- **Main App** has the infrastructure in place but requires MediaPipe integration completion

The 6 eye metrics (Gaze Duration, Dwell Time, Saccade Length, Distractor Saccades, Fixation Count, and Refixation Ratio) are calculated using traditional signal processing techniques without requiring machine learning, making them computationally efficient and suitable for real-time applications.

The mathematical foundation is sound and can be adapted across different platforms and camera systems while maintaining consistent metric calculations.
