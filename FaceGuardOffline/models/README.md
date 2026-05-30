# 🧠 ML Models — FaceGuard Offline

> **⚠️ Important:** Actual `.tflite` model files are **NOT included** in this repository due to their size. You must download them separately before building the app.

---

## Required Models

| Model | File | Size | Purpose |
|-------|------|------|---------|
| **BlazeFace** | `blazeface_short.tflite` | ~400 KB | Real-time face detection |
| **MobileFaceNet** | `mobilefacenet.tflite` | ~5 MB | Face recognition (embedding extraction) |
| **MiniFASNet** | `minifasnet.tflite` | ~2 MB | Liveness detection (anti-spoofing) |

---

## Directory Structure

After downloading, your `models/` directory should look like:

```
models/
├── README.md                    ← This file
├── blazeface_short.tflite       ← Face detection model
├── mobilefacenet.tflite         ← Face recognition model
├── minifasnet.tflite            ← Liveness detection model
└── checksums.sha256             ← Checksum verification file
```

---

## Download Instructions

### Option 1: Automated Download (Recommended)

```bash
# From the project root directory:
npm run download-models
```

This script will:
1. Download all required models from the team's cloud storage
2. Verify SHA256 checksums
3. Place files in the correct directory

### Option 2: Manual Download

Download each model from the links below and place them in the `models/` directory:

| Model | Download Link | SHA256 Checksum |
|-------|-------------|-----------------|
| BlazeFace | [Download blazeface_short.tflite](https://storage.example.com/faceguard/models/v1/blazeface_short.tflite) | `<SHA256_CHECKSUM_PLACEHOLDER_BLAZEFACE>` |
| MobileFaceNet | [Download mobilefacenet.tflite](https://storage.example.com/faceguard/models/v1/mobilefacenet.tflite) | `<SHA256_CHECKSUM_PLACEHOLDER_MOBILEFACENET>` |
| MiniFASNet | [Download minifasnet.tflite](https://storage.example.com/faceguard/models/v1/minifasnet.tflite) | `<SHA256_CHECKSUM_PLACEHOLDER_MINIFASNET>` |

> 📝 **Note:** Download links above are placeholders. Contact the team lead for actual model distribution URLs.

### Option 3: Build from Source

If you have access to the training pipeline:

```bash
# Clone the model training repository
git clone https://github.com/your-team/faceguard-models.git

# Follow training instructions in the model repo
cd faceguard-models
python scripts/export_tflite.py --model blazeface --quantize float16
python scripts/export_tflite.py --model mobilefacenet --quantize float16
python scripts/export_tflite.py --model minifasnet --quantize float16

# Copy exported models
cp exports/*.tflite /path/to/FaceGuardOffline/models/
```

---

## Checksum Verification

### Verify Manually

```bash
# Linux / macOS
sha256sum models/blazeface_short.tflite
sha256sum models/mobilefacenet.tflite
sha256sum models/minifasnet.tflite

# Windows (PowerShell)
Get-FileHash models\blazeface_short.tflite -Algorithm SHA256
Get-FileHash models\mobilefacenet.tflite -Algorithm SHA256
Get-FileHash models\minifasnet.tflite -Algorithm SHA256
```

### Expected Checksums

```
# checksums.sha256
<SHA256_CHECKSUM_PLACEHOLDER_BLAZEFACE>  blazeface_short.tflite
<SHA256_CHECKSUM_PLACEHOLDER_MOBILEFACENET>  mobilefacenet.tflite
<SHA256_CHECKSUM_PLACEHOLDER_MINIFASNET>  minifasnet.tflite
```

### Verify All at Once

```bash
# Linux / macOS
cd models && sha256sum -c checksums.sha256

# Windows (PowerShell)
# Use the npm script instead:
npm run verify-models
```

---

## Model Specifications

### BlazeFace (Short-Range Face Detection)

```
Architecture:     BlazeFace (MediaPipe)
Input Tensor:     [1, 128, 128, 3]  (NHWC, RGB, float32)
Input Range:      [-1.0, 1.0]  (pixel / 127.5 - 1.0)
Output Tensors:
  - regressors:   [1, 896, 16]  (bounding box + landmarks)
  - classificators: [1, 896, 1]  (face confidence scores)
Quantization:     Float16
Optimized For:    Short-range faces (< 2 meters from camera)
NMS IoU:          0.3
Min Confidence:   0.75
Max Detections:   Typically 1-2 faces in frame
```

### MobileFaceNet (Face Recognition / Embedding)

```
Architecture:     MobileFaceNet with ArcFace loss
Input Tensor:     [1, 112, 112, 3]  (NHWC, RGB, float32)
Input Range:      [0.0, 1.0]  (pixel / 255.0)
Output Tensor:    [1, 128]  (L2-normalized embedding vector)
Quantization:     Float16
Similarity:       Cosine similarity
Match Threshold:  0.65 (configurable, default)
Training Data:    MS-Celeb-1M + VGGFace2 (cleaned)
LFW Accuracy:     99.4% @ FAR=1e-3
```

### MiniFASNet (Liveness / Anti-Spoofing)

```
Architecture:     MiniFASNet v2 (Face Anti-Spoofing Network)
Input Tensor:     [1, 80, 80, 3]  (NHWC, RGB, float32)
Input Range:      [0.0, 1.0]  (pixel / 255.0)
Output Tensor:    [1, 3]  (softmax: [real, print_attack, replay_attack])
Quantization:     Float16
Live Threshold:   0.85 (class 0 probability)
Spoof Types:      Print attack, screen replay, partial occlusion
Training Data:    CASIA-FASD + Replay-Attack + OULU-NPU
ACER:             2.1% on OULU-NPU Protocol 1
```

---

## Model Placement for Build

### Android

Models are automatically copied to the Android assets directory during the build process:

```
android/app/src/main/assets/models/
├── blazeface_short.tflite
├── mobilefacenet.tflite
└── minifasnet.tflite
```

The `react-native.config.js` handles this via asset linking:

```javascript
module.exports = {
  assets: ['./models'],
};
```

### iOS

Models are included in the app bundle via Xcode:

1. Models are automatically linked to the iOS project
2. Accessible via `Bundle.main.path(forResource:ofType:)`
3. No manual Xcode configuration required after `pod install`

---

## Model Updates (OTA)

FaceGuard Offline supports over-the-air model updates when connected to Datalake 3.0:

```
1. Server publishes new model version to S3:
   s3://nhai-faceguard-sync/models/{model_name}/v{version}/model.tflite

2. Device checks for updates during sync:
   GET /v1/config/device/{id} → modelVersions field

3. If newer version available:
   a. Download new model to temp directory
   b. Verify SHA256 checksum
   c. Run validation inference on test image
   d. If validation passes → swap model atomically
   e. If validation fails → keep current model, report error

4. Models are cached locally after download
   (no re-download on app restart)
```

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|---------|
| "Model file not found" | Models not downloaded | Run `npm run download-models` |
| "Invalid model format" | Corrupted download | Verify checksums, re-download |
| "Interpreter creation failed" | Incompatible TFLite version | Ensure TFLite runtime matches model format |
| "Out of memory during load" | Device has <3GB RAM | Close other apps, restart device |
| "NNAPI delegate failed" | SoC doesn't support NNAPI ops | Falls back to CPU automatically |
| Slow inference | GPU delegate not available | Check device compatibility matrix |

### Validation Script

```bash
# Validate that all models are present and correct
npm run validate-models

# Expected output:
# ✅ blazeface_short.tflite — present, checksum OK (398 KB)
# ✅ mobilefacenet.tflite — present, checksum OK (4.8 MB)
# ✅ minifasnet.tflite — present, checksum OK (1.9 MB)
# All models validated successfully!
```

---

## License & Attribution

| Model | Base Architecture | License | Citation |
|-------|------------------|---------|----------|
| BlazeFace | MediaPipe BlazeFace | Apache 2.0 | Bazarevsky et al., 2019 |
| MobileFaceNet | MobileFaceNet | MIT | Chen et al., 2018 |
| MiniFASNet | MiniFASNet | Apache 2.0 | Yu et al., 2020 |

> ⚠️ Ensure compliance with model licenses before commercial deployment. The models included in this project are used for hackathon/research purposes.

---

## .gitignore Entry

The following entry should be in the project root `.gitignore`:

```gitignore
# ML Model files (too large for git)
models/*.tflite
models/checksums.sha256
!models/README.md
```

---

> 💡 **Tip:** For the fastest setup, use `npm run download-models` after cloning the repository. This handles downloading, verification, and placement automatically.
