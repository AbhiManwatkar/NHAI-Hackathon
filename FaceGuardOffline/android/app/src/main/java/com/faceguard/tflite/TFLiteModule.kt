package com.faceguard.tflite

import android.content.res.AssetFileDescriptor
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONArray
import org.json.JSONObject
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

class TFLiteModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val executor: ExecutorService = Executors.newSingleThreadExecutor()
  private val interpreters = mutableMapOf<String, Interpreter>()

  override fun getName(): String = "TFLiteModule"

  @ReactMethod
  fun loadModel(modelName: String, promise: Promise) {
    executor.execute {
      try {
        val options = Interpreter.Options().apply {
          setNumThreads(4)
          try {
            setUseNNAPI(true)
          } catch (_: Throwable) {
            setUseNNAPI(false)
          }
        }
        val buffer = loadMappedModel(modelName)
        interpreters[modelKey(modelName)]?.close()
        interpreters[modelKey(modelName)] = Interpreter(buffer, options)
        promise.resolve("Loaded $modelName")
      } catch (error: Throwable) {
        promise.reject(
          "MODEL_LOAD_FAILED",
          "FaceGuard could not load $modelName. Please reinstall the offline model pack.",
          error,
        )
      }
    }
  }

  @ReactMethod
  fun runBlazeFace(base64Frame: String, promise: Promise) {
    executor.execute {
      try {
        val interpreter = requireInterpreter("blazeface")
        val startedAt = System.nanoTime()
        val bitmap = decodeBase64Jpeg(base64Frame)
        val input = bitmapToFloatBuffer(bitmap, 128, NormalizeMode.MINUS_ONE_TO_ONE)
        val boxes = Array(1) { Array(896) { FloatArray(16) } }
        val scores = Array(1) { Array(896) { FloatArray(1) } }
        interpreter.runForMultipleInputsOutputs(arrayOf(input), mapOf(0 to boxes, 1 to scores))
        val result = postProcessBlazeFace(boxes[0], scores[0], bitmap.width, bitmap.height)
        result.put("inferenceMs", elapsedMs(startedAt))
        promise.resolve(result.toString())
      } catch (error: Throwable) {
        promise.reject("INFERENCE_FAILED", "Face detection failed. Please hold the camera steady.", error)
      }
    }
  }

  @ReactMethod
  fun runMobileFaceNet(base64Face: String, promise: Promise) {
    executor.execute {
      try {
        val interpreter = requireInterpreter("mobilefacenet")
        val startedAt = System.nanoTime()
        val bitmap = decodeBase64Jpeg(base64Face)
        val input = bitmapToFloatBuffer(bitmap, 112, NormalizeMode.IMAGENET)
        val output = Array(1) { FloatArray(128) }
        interpreter.run(input, output)
        val normalized = l2Normalize(output[0])
        val json = JSONObject()
          .put("embedding", JSONArray(normalized.toList()))
          .put("inferenceMs", elapsedMs(startedAt))
        promise.resolve(json.toString())
      } catch (error: Throwable) {
        promise.reject("INFERENCE_FAILED", "Face embedding failed. Please retry with a clearer face crop.", error)
      }
    }
  }

  @ReactMethod
  fun runMiniFASNet(base64Face: String, promise: Promise) {
    executor.execute {
      try {
        val interpreter = requireInterpreter("minifasnet")
        val startedAt = System.nanoTime()
        val bitmap = decodeBase64Jpeg(base64Face)
        val input = bitmapToFloatBuffer(bitmap, 80, NormalizeMode.MINUS_ONE_TO_ONE)
        val output = Array(1) { FloatArray(2) }
        interpreter.run(input, output)
        val spoofScore = softmax(output[0][0], output[0][1])
        val realScore = softmax(output[0][1], output[0][0])
        val json = JSONObject()
          .put("isReal", realScore >= 0.5f)
          .put("realScore", realScore)
          .put("spoofScore", spoofScore)
          .put("spoofType", if (realScore >= 0.5f) JSONObject.NULL else "presentation_attack")
          .put("inferenceMs", elapsedMs(startedAt))
        promise.resolve(json.toString())
      } catch (error: Throwable) {
        promise.reject("INFERENCE_FAILED", "Passive liveness check failed. Please retry.", error)
      }
    }
  }

  override fun invalidate() {
    executor.execute {
      interpreters.values.forEach { it.close() }
      interpreters.clear()
    }
    executor.shutdown()
    super.invalidate()
  }

  private fun loadMappedModel(modelName: String): MappedByteBuffer {
    val fd: AssetFileDescriptor = reactContext.assets.openFd(modelName)
    FileInputStream(fd.fileDescriptor).use { input ->
      val channel = input.channel
      return channel.map(FileChannel.MapMode.READ_ONLY, fd.startOffset, fd.declaredLength)
    }
  }

  private fun requireInterpreter(key: String): Interpreter {
    interpreters[key]?.let { return it }
    val match = interpreters.entries.firstOrNull { it.key.contains(key, ignoreCase = true) }
    return match?.value ?: throw IllegalStateException("$key model is not loaded")
  }

  private fun modelKey(modelName: String): String =
    modelName.removeSuffix(".tflite").lowercase()

  private fun decodeBase64Jpeg(base64Frame: String): Bitmap {
    val comma = base64Frame.indexOf(',')
    val payload = if (comma >= 0) base64Frame.substring(comma + 1) else base64Frame
    val bytes = Base64.decode(payload, Base64.DEFAULT)
    return BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
      ?: throw IllegalArgumentException("Invalid JPEG frame")
  }

  private fun bitmapToFloatBuffer(bitmap: Bitmap, inputSize: Int, mode: NormalizeMode): ByteBuffer {
    val scaled = Bitmap.createScaledBitmap(bitmap, inputSize, inputSize, true)
    val buffer = ByteBuffer.allocateDirect(1 * inputSize * inputSize * 3 * 4)
    buffer.order(ByteOrder.nativeOrder())
    val pixels = IntArray(inputSize * inputSize)
    scaled.getPixels(pixels, 0, inputSize, 0, 0, inputSize, inputSize)

    for (pixel in pixels) {
      val r = (pixel shr 16) and 0xFF
      val g = (pixel shr 8) and 0xFF
      val b = pixel and 0xFF
      putNormalized(buffer, r, 0, mode)
      putNormalized(buffer, g, 1, mode)
      putNormalized(buffer, b, 2, mode)
    }
    buffer.rewind()
    return buffer
  }

  private fun putNormalized(buffer: ByteBuffer, value: Int, channel: Int, mode: NormalizeMode) {
    val normalized = when (mode) {
      NormalizeMode.MINUS_ONE_TO_ONE -> value / 127.5f - 1f
      NormalizeMode.IMAGENET -> {
        val means = floatArrayOf(0.485f, 0.456f, 0.406f)
        val stds = floatArrayOf(0.229f, 0.224f, 0.225f)
        (value / 255f - means[channel]) / stds[channel]
      }
    }
    buffer.putFloat(normalized)
  }

  private fun postProcessBlazeFace(
    boxes: Array<FloatArray>,
    scores: Array<FloatArray>,
    frameWidth: Int,
    frameHeight: Int,
  ): JSONObject {
    var bestIndex = -1
    var bestScore = 0f
    for (i in scores.indices) {
      val score = sigmoid(scores[i][0])
      if (score > bestScore) {
        bestScore = score
        bestIndex = i
      }
    }

    if (bestIndex < 0 || bestScore < 0.65f) {
      return JSONObject()
        .put("detected", false)
        .put("bbox", JSONObject.NULL)
        .put("keypoints", JSONArray())
        .put("confidence", bestScore)
        .put("frameWidth", frameWidth)
        .put("frameHeight", frameHeight)
    }

    val raw = boxes[bestIndex]
    val cx = raw[0] / 128f
    val cy = raw[1] / 128f
    val w = max(0.01f, raw[2] / 128f)
    val h = max(0.01f, raw[3] / 128f)
    val bbox = JSONObject()
      .put("x", clamp01(cx - w / 2f))
      .put("y", clamp01(cy - h / 2f))
      .put("width", clamp01(w))
      .put("height", clamp01(h))

    val keypoints = JSONArray()
    for (i in 0 until 6) {
      keypoints.put(
        JSONObject()
          .put("x", clamp01(raw[4 + i * 2] / 128f))
          .put("y", clamp01(raw[5 + i * 2] / 128f)),
      )
    }

    return JSONObject()
      .put("detected", true)
      .put("bbox", bbox)
      .put("keypoints", keypoints)
      .put("confidence", bestScore)
      .put("frameWidth", frameWidth)
      .put("frameHeight", frameHeight)
  }

  private fun l2Normalize(vector: FloatArray): FloatArray {
    var sum = 0f
    for (value in vector) sum += value * value
    val norm = sqrt(sum)
    if (norm < 1e-8f) return vector
    return FloatArray(vector.size) { vector[it] / norm }
  }

  private fun softmax(target: Float, other: Float): Float {
    val maxLogit = max(target, other)
    val expTarget = exp((target - maxLogit).toDouble()).toFloat()
    val expOther = exp((other - maxLogit).toDouble()).toFloat()
    return expTarget / (expTarget + expOther)
  }

  private fun sigmoid(value: Float): Float =
    (1f / (1f + exp((-value).toDouble()))).toFloat()

  private fun clamp01(value: Float): Float = min(1f, max(0f, value))

  private fun elapsedMs(startedAt: Long): Double =
    (System.nanoTime() - startedAt).toDouble() / 1_000_000.0

  private enum class NormalizeMode {
    MINUS_ONE_TO_ONE,
    IMAGENET,
  }
}
