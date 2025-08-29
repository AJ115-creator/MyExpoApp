# Mobile Eye Tracking Implementation

This document provides comprehensive information about the mobile eye tracking solution implemented in MyExpoApp, which integrates React Native Vision Camera with MediaPipe Face Landmarker to enable real-time eye tracking functionality.

## Overview

The mobile eye tracking solution adapts the web-based eye tracking logic to work with React Native, providing the same 6 key eye tracking metrics:

1.  **Gaze Duration** - Total time spent looking at any point
2.  **Dwell Time** - Time spent in specific areas of interest
3.  **Saccade Length** - Distance of rapid eye movements
4.  **Distractor Saccades** - Saccades to non-interest areas
5.  **Fixation Count** - Number of distinct fixations
6.  **Refixation Ratio** - Ratio of revisits to areas

## Architecture

### Data Flow

1.  **Camera Capture**: React Native Vision Camera captures frames from the front camera
2.  **Frame Processing**: Vision Camera Frame Processor sends frames to native module
3.  **MediaPipe Processing**: Native Kotlin module uses MediaPipe Face Landmarker to detect face landmarks
4.  **Eye Tracking Logic**: JavaScript EyeTracker processes landmarks to calculate gaze and metrics
5.  **UI Updates**: React Native UI displays gaze cursor, calibration points, and metrics

### Key Components

#### 1. Native Module (`HelloWorldModule.kt`)

**Location**: `android/app/src/main/java/com/anonymous/MyExpoApp/HelloWorldModule.kt`

**Key Features**:
- MediaPipe Face Landmarker initialization
- Camera frame processing with bitmap conversion
- Face landmark detection and extraction
- Asynchronous processing to avoid UI blocking

**Key Methods**:
- `initializeFaceLandmarker()`: Initializes MediaPipe with face_landmarker.task model
- `processCameraFrame()`: Processes camera frames and returns face landmarks
- `convertFrameDataToBitmap()`: Converts various pixel formats to Bitmap
- `convertFaceLandmarkerResult()`: Converts MediaPipe results to JavaScript format

#### 2. EyeTracker Module (`EyeTracker.js`)

**Location**: `EyeTracker.js`

**Key Classes**:
- `EyeTracker`: Main class orchestrating eye tracking
- `Calibrator`: Handles calibration and gaze prediction using linear regression
- `EyeFeatureExtractor`: Calculates the 6 eye tracking metrics
- `Fixation`: Detects fixation at specific points

**Key Features**:
- Extracts eye features from MediaPipe face landmarks (468 points)
- Implements simplified linear regression for mobile (no ML.js dependency)
- Processes landmarks to calculate gaze direction vectors
- Manages calibration state and progress

#### 3. Camera Screen (`CameraScreen.js`)

**Location**: `CameraScreen.js`

**Key Features**:
- Front camera integration for eye tracking
- Real-time frame processing with worklets
- Calibration UI with instructions and visual feedback
- Gaze cursor display and eye metrics visualization
- Calibration point management

## Installation and Setup

### Prerequisites

- React Native development environment
- Android SDK (API level 26+)
- Node.js and npm/yarn

### Dependencies Added

```gradle
// MediaPipe dependencies in android/app/build.gradle
implementation \'com.google.mediapipe:tasks-vision:0.10.8\'
implementation \'androidx.camera:camera-core:1.3.1\'
implementation \'androidx.camera:camera-camera2:1.3.1\'
implementation \'androidx.camera:camera-lifecycle:1.3.1\'
