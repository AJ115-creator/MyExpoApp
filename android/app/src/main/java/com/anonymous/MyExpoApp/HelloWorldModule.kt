package com.anonymous.MyExpoApp

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.Arguments
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarkerOptions
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarkerResult
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.util.concurrent.Executors

class HelloWorldModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var faceLandmarker: FaceLandmarker? = null
    private val executor = Executors.newSingleThreadExecutor()
    private val TAG = "HelloWorldModule"

    override fun getName(): String {
        return "HelloWorldModule"
    }

    init {
        initializeFaceLandmarker()
    }

    private fun initializeFaceLandmarker() {
        try {
            val baseOptionsBuilder = BaseOptions.builder()
                .setModelAssetPath("face_landmarker.task")

            val optionsBuilder = FaceLandmarkerOptions.builder()
                .setBaseOptions(baseOptionsBuilder.build())
                .setRunningMode(RunningMode.IMAGE)
                .setNumFaces(1)
                .setMinFaceDetectionConfidence(0.5f)
                .setMinFacePresenceConfidence(0.5f)
                .setMinTrackingConfidence(0.5f)

            faceLandmarker = FaceLandmarker.createFromOptions(reactApplicationContext, optionsBuilder.build())
            Log.d(TAG, "FaceLandmarker initialized successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Error initializing FaceLandmarker: ${e.message}", e)
        }
    }

    @ReactMethod
    fun getHelloWorld(promise: Promise) {
        try {
            val message = getHelloWorldMessage()
            promise.resolve(message)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun processFrameData(frameData: ReadableArray, width: Int, height: Int, promise: Promise) {
        try {
            val frameArray = frameData.toArrayList()
            val totalPixels = frameArray.size
            
            val brightPixels = frameArray.count { 
                when (it) {
                    is Int -> it > 128
                    is Number -> it.toInt() > 128
                    else -> false
                }
            }
            val brightnessRatio = if (totalPixels > 0) brightPixels.toDouble() / totalPixels else 0.0
            
            val result: WritableMap = Arguments.createMap()
            result.putInt("processedPixels", totalPixels)
            result.putInt("brightPixels", brightPixels)
            result.putDouble("brightnessRatio", brightnessRatio)
            result.putString("status", "success")
            
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("PROCESSING_ERROR", e.message)
        }
    }

    @ReactMethod
    fun processCameraFrame(frameData: ReadableArray, width: Int, height: Int, pixelFormat: String, promise: Promise) {
        executor.execute {
            try {
                if (faceLandmarker == null) {
                    promise.reject("MEDIAPIPE_ERROR", "FaceLandmarker not initialized")
                    return@execute
                }

                // Convert frame data to bitmap
                val bitmap = convertFrameDataToBitmap(frameData, width, height, pixelFormat)
                if (bitmap == null) {
                    promise.reject("CONVERSION_ERROR", "Failed to convert frame data to bitmap")
                    return@execute
                }

                // Create MPImage from bitmap
                val mpImage = BitmapImageBuilder(bitmap).build()

                // Detect face landmarks
                val result = faceLandmarker!!.detect(mpImage)
                
                // Convert result to JavaScript format
                val jsResult = convertFaceLandmarkerResult(result)
                promise.resolve(jsResult)

            } catch (e: Exception) {
                Log.e(TAG, "Error processing camera frame: ${e.message}", e)
                promise.reject("PROCESSING_ERROR", e.message)
            }
        }
    }

    private fun convertFrameDataToBitmap(frameData: ReadableArray, width: Int, height: Int, pixelFormat: String): Bitmap? {
        return try {
            val frameArray = frameData.toArrayList()
            val byteArray = ByteArray(frameArray.size)
            
            for (i in frameArray.indices) {
                byteArray[i] = when (val value = frameArray[i]) {
                    is Number -> value.toByte()
                    else -> 0
                }
            }

            when (pixelFormat.lowercase()) {
                "yuv420", "yuv_420_888" -> {
                    // Convert YUV to RGB bitmap
                    convertYuvToBitmap(byteArray, width, height)
                }
                "rgba", "rgba_8888" -> {
                    // Create bitmap from RGBA data
                    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                    val buffer = java.nio.ByteBuffer.wrap(byteArray)
                    bitmap.copyPixelsFromBuffer(buffer)
                    bitmap
                }
                else -> {
                    // Fallback: try to decode as compressed image
                    BitmapFactory.decodeByteArray(byteArray, 0, byteArray.size)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error converting frame data to bitmap: ${e.message}", e)
            null
        }
    }

    private fun convertYuvToBitmap(yuvData: ByteArray, width: Int, height: Int): Bitmap? {
        return try {
            val yuvImage = YuvImage(yuvData, ImageFormat.NV21, width, height, null)
            val out = ByteArrayOutputStream()
            yuvImage.compressToJpeg(Rect(0, 0, width, height), 100, out)
            val jpegData = out.toByteArray()
            BitmapFactory.decodeByteArray(jpegData, 0, jpegData.size)
        } catch (e: Exception) {
            Log.e(TAG, "Error converting YUV to bitmap: ${e.message}", e)
            null
        }
    }

    private fun convertFaceLandmarkerResult(result: FaceLandmarkerResult): WritableMap {
        val jsResult = Arguments.createMap()
        val faceLandmarksArray = Arguments.createArray()

        for (faceLandmarks in result.faceLandmarks()) {
            val landmarksArray = Arguments.createArray()
            
            for (landmark in faceLandmarks) {
                val landmarkMap = Arguments.createMap()
                landmarkMap.putDouble("x", landmark.x().toDouble())
                landmarkMap.putDouble("y", landmark.y().toDouble())
                landmarkMap.putDouble("z", landmark.z().toDouble())
                landmarksArray.pushMap(landmarkMap)
            }
            
            faceLandmarksArray.pushArray(landmarksArray)
        }

        jsResult.putArray("faceLandmarks", faceLandmarksArray)
        jsResult.putInt("numFaces", result.faceLandmarks().size)
        jsResult.putString("status", "success")
        jsResult.putLong("timestamp", System.currentTimeMillis())

        return jsResult
    }

    @ReactMethod
    fun startEyeCalibration(promise: Promise) {
        try {
            val result: WritableMap = Arguments.createMap()
            result.putString("status", "started")
            result.putString("message", "Eye calibration initialized successfully")
            result.putLong("timestamp", System.currentTimeMillis())
            
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("CALIBRATION_ERROR", e.message)
        }
    }

    private fun getHelloWorldMessage(): String {
        return "Hello world from Kotlin native module with MediaPipe Face Landmarker!"
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        faceLandmarker?.close()
        executor.shutdown()
    }
}
