import Foundation
import React
import TensorFlowLite
import UIKit

@objc(TFLiteModule)
class TFLiteModule: NSObject {
  private let queue = DispatchQueue(label: "tflite", qos: .userInitiated)
  private var interpreters: [String: Interpreter] = [:]

  @objc static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(loadModel:resolver:rejecter:)
  func loadModel(
    _ modelName: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    queue.async {
      do {
        guard let path = Bundle.main.path(forResource: modelName.replacingOccurrences(of: ".tflite", with: ""), ofType: "tflite") else {
          throw TFLiteBridgeError.modelNotFound(modelName)
        }

        let interpreter = try self.makeInterpreter(modelPath: path)
        self.interpreters[self.modelKey(modelName)] = interpreter
        resolve("Loaded \(modelName)")
      } catch {
        reject("MODEL_LOAD_FAILED", "FaceGuard could not load \(modelName). Please reinstall the offline model pack.", error)
      }
    }
  }

  @objc(runBlazeFace:resolver:rejecter:)
  func runBlazeFace(
    _ base64Frame: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    queue.async {
      do {
        var interpreter = try self.requireInterpreter("blazeface")
        let startedAt = CFAbsoluteTimeGetCurrent()
        let image = try self.decodeBase64Image(base64Frame)
        let input = try self.imageToFloatData(image, size: 128, mode: .minusOneToOne)
        try interpreter.copy(input, toInputAt: 0)
        try interpreter.invoke()
        let boxes = try interpreter.output(at: 0).data.toFloatArray()
        let scores = try interpreter.output(at: 1).data.toFloatArray()
        var result = self.postProcessBlazeFace(boxes: boxes, scores: scores, image: image)
        result["inferenceMs"] = self.elapsedMs(startedAt)
        resolve(try self.jsonString(result))
      } catch {
        reject("INFERENCE_FAILED", "Face detection failed. Please hold the camera steady.", error)
      }
    }
  }

  @objc(runMobileFaceNet:resolver:rejecter:)
  func runMobileFaceNet(
    _ base64Face: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    queue.async {
      do {
        var interpreter = try self.requireInterpreter("mobilefacenet")
        let startedAt = CFAbsoluteTimeGetCurrent()
        let image = try self.decodeBase64Image(base64Face)
        let input = try self.imageToFloatData(image, size: 112, mode: .imagenet)
        try interpreter.copy(input, toInputAt: 0)
        try interpreter.invoke()
        let embedding = self.l2Normalize(try interpreter.output(at: 0).data.toFloatArray())
        resolve(try self.jsonString([
          "embedding": embedding,
          "inferenceMs": self.elapsedMs(startedAt),
        ]))
      } catch {
        reject("INFERENCE_FAILED", "Face embedding failed. Please retry with a clearer face crop.", error)
      }
    }
  }

  @objc(runMiniFASNet:resolver:rejecter:)
  func runMiniFASNet(
    _ base64Face: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    queue.async {
      do {
        var interpreter = try self.requireInterpreter("minifasnet")
        let startedAt = CFAbsoluteTimeGetCurrent()
        let image = try self.decodeBase64Image(base64Face)
        let input = try self.imageToFloatData(image, size: 80, mode: .minusOneToOne)
        try interpreter.copy(input, toInputAt: 0)
        try interpreter.invoke()
        let output = try interpreter.output(at: 0).data.toFloatArray()
        let spoofScore = self.softmax(target: output[0], other: output[1])
        let realScore = self.softmax(target: output[1], other: output[0])
        resolve(try self.jsonString([
          "isReal": realScore >= 0.5,
          "realScore": realScore,
          "spoofScore": spoofScore,
          "spoofType": realScore >= 0.5 ? NSNull() : "presentation_attack",
          "inferenceMs": self.elapsedMs(startedAt),
        ]))
      } catch {
        reject("INFERENCE_FAILED", "Passive liveness check failed. Please retry.", error)
      }
    }
  }

  private func requireInterpreter(_ key: String) throws -> Interpreter {
    if let interpreter = interpreters[key] {
      return interpreter
    }
    if let match = interpreters.first(where: { $0.key.localizedCaseInsensitiveContains(key) })?.value {
      return match
    }
    throw TFLiteBridgeError.modelNotLoaded(key)
  }

  private func makeInterpreter(modelPath: String) throws -> Interpreter {
    var options = Interpreter.Options()
    options.threadCount = 4

    let delegateAttempts: [[Delegate]] = [
      [MetalDelegate()],
      [CoreMLDelegate()],
      [],
    ]
    var lastError: Error?

    for delegates in delegateAttempts {
      do {
        // WOW factor: MetalDelegate is attempted first so FaceGuard gets GPU-speed offline inference on iOS.
        var interpreter = try Interpreter(modelPath: modelPath, options: options, delegates: delegates)
        try interpreter.allocateTensors()
        return interpreter
      } catch {
        lastError = error
      }
    }

    throw lastError ?? TFLiteBridgeError.modelNotLoaded(modelPath)
  }

  private func modelKey(_ modelName: String) -> String {
    modelName.replacingOccurrences(of: ".tflite", with: "").lowercased()
  }

  private func decodeBase64Image(_ base64: String) throws -> UIImage {
    let payload = base64.components(separatedBy: ",").last ?? base64
    guard let data = Data(base64Encoded: payload), let image = UIImage(data: data) else {
      throw TFLiteBridgeError.invalidImage
    }
    return image
  }

  private func imageToFloatData(_ image: UIImage, size: Int, mode: NormalizeMode) throws -> Data {
    guard let cgImage = image.cgImage else {
      throw TFLiteBridgeError.invalidImage
    }

    let width = size
    let height = size
    let bytesPerPixel = 4
    var pixelBuffer: CVPixelBuffer?
    let attrs = [
      kCVPixelBufferCGImageCompatibilityKey: true,
      kCVPixelBufferCGBitmapContextCompatibilityKey: true,
    ] as CFDictionary
    let status = CVPixelBufferCreate(
      kCFAllocatorDefault,
      width,
      height,
      kCVPixelFormatType_32RGBA,
      attrs,
      &pixelBuffer
    )
    guard status == kCVReturnSuccess, let unwrappedPixelBuffer = pixelBuffer else {
      throw TFLiteBridgeError.invalidImage
    }
    let pixelBuffer = unwrappedPixelBuffer

    CVPixelBufferLockBaseAddress(pixelBuffer, [])
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, []) }

    guard let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer) else {
      throw TFLiteBridgeError.invalidImage
    }

    let colorSpace = CGColorSpaceCreateDeviceRGB()
    guard let context = CGContext(
      data: baseAddress,
      width: width,
      height: height,
      bitsPerComponent: 8,
      bytesPerRow: CVPixelBufferGetBytesPerRow(pixelBuffer),
      space: colorSpace,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
      throw TFLiteBridgeError.invalidImage
    }

    context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))

    var floats = [Float32]()
    floats.reserveCapacity(width * height * 3)
    let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
    let raw = baseAddress.assumingMemoryBound(to: UInt8.self)
    for y in 0..<height {
      for x in 0..<width {
        let index = y * bytesPerRow + x * bytesPerPixel
        floats.append(normalize(Float32(raw[index]), channel: 0, mode: mode))
        floats.append(normalize(Float32(raw[index + 1]), channel: 1, mode: mode))
        floats.append(normalize(Float32(raw[index + 2]), channel: 2, mode: mode))
      }
    }

    return floats.withUnsafeBufferPointer { buffer -> Data in
      guard let baseAddress = buffer.baseAddress else {
        return Data()
      }
      return Data(bytes: baseAddress, count: buffer.count * MemoryLayout<Float32>.stride)
    }
  }

  private func normalize(_ value: Float32, channel: Int, mode: NormalizeMode) -> Float32 {
    switch mode {
    case .minusOneToOne:
      return value / 127.5 - 1
    case .imagenet:
      let mean: [Float32] = [0.485, 0.456, 0.406]
      let std: [Float32] = [0.229, 0.224, 0.225]
      return (value / 255 - mean[channel]) / std[channel]
    }
  }

  private func postProcessBlazeFace(boxes: [Float32], scores: [Float32], image: UIImage) -> [String: Any] {
    var bestIndex = -1
    var bestScore: Float32 = 0
    for index in 0..<min(896, scores.count) {
      let score = sigmoid(scores[index])
      if score > bestScore {
        bestScore = score
        bestIndex = index
      }
    }

    if bestIndex < 0 || bestScore < 0.65 {
      return [
        "detected": false,
        "bbox": NSNull(),
        "keypoints": [],
        "confidence": bestScore,
        "frameWidth": image.size.width,
        "frameHeight": image.size.height,
      ]
    }

    let offset = bestIndex * 16
    let cx = boxes[offset] / 128
    let cy = boxes[offset + 1] / 128
    let width = max(Float32(0.01), boxes[offset + 2] / 128)
    let height = max(Float32(0.01), boxes[offset + 3] / 128)
    var keypoints: [[String: Float32]] = []
    for point in 0..<6 {
      keypoints.append([
        "x": clamp01(boxes[offset + 4 + point * 2] / 128),
        "y": clamp01(boxes[offset + 5 + point * 2] / 128),
      ])
    }

    return [
      "detected": true,
      "bbox": [
        "x": clamp01(cx - width / 2),
        "y": clamp01(cy - height / 2),
        "width": clamp01(width),
        "height": clamp01(height),
      ],
      "keypoints": keypoints,
      "confidence": bestScore,
      "frameWidth": image.size.width,
      "frameHeight": image.size.height,
    ]
  }

  private func l2Normalize(_ vector: [Float32]) -> [Float32] {
    let norm = sqrt(vector.reduce(Float32(0)) { $0 + $1 * $1 })
    guard norm > 1e-8 else { return vector }
    return vector.map { $0 / norm }
  }

  private func softmax(target: Float32, other: Float32) -> Float32 {
    let maxLogit = max(target, other)
    let expTarget = Foundation.exp(target - maxLogit)
    let expOther = Foundation.exp(other - maxLogit)
    return expTarget / (expTarget + expOther)
  }

  private func sigmoid(_ value: Float32) -> Float32 {
    1 / (1 + Foundation.exp(-value))
  }

  private func clamp01(_ value: Float32) -> Float32 {
    min(1, max(0, value))
  }

  private func elapsedMs(_ startedAt: CFAbsoluteTime) -> Double {
    (CFAbsoluteTimeGetCurrent() - startedAt) * 1000
  }

  private func jsonString(_ object: [String: Any]) throws -> String {
    let data = try JSONSerialization.data(withJSONObject: object, options: [])
    return String(data: data, encoding: .utf8) ?? "{}"
  }

  private enum NormalizeMode {
    case minusOneToOne
    case imagenet
  }
}

private enum TFLiteBridgeError: Error {
  case modelNotFound(String)
  case modelNotLoaded(String)
  case invalidImage
}

private extension Data {
  func toFloatArray() -> [Float32] {
    withUnsafeBytes { rawBuffer in
      Array(rawBuffer.bindMemory(to: Float32.self))
    }
  }
}
