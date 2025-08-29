package com.anonymous.MyExpoApp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments

class HelloWorldModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "HelloWorldModule"
    }

    @ReactMethod
    fun getHelloWorld(promise: Promise) {
        try {
            // This is where we call your Kotlin function
            val message = getHelloWorldMessage()
            promise.resolve(message)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun processFrameData(frameData: ReadableArray, width: Int, height: Int, promise: Promise) {
        try {
            // Process frame data from camera
            val frameArray = frameData.toArrayList()
            val totalPixels = frameArray.size
            
            // Simple brightness calculation (example processing)
            // Use safe casting to avoid ClassCastException
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
    fun startEyeCalibration(promise: Promise) {
        try {
            // Initialize eye calibration process
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
        // This simulates your Kotlin hello world function
        return "hello world from Kotlin native module!"
    }
}
