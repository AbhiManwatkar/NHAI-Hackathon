# Contributing to FaceGuard Offline

Thank you for considering contributing to FaceGuard Offline. This guide covers development setup, testing, model preparation, and contribution workflow.

---

## Development Setup

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Python | 3.10+ | [python.org](https://python.org) |
| React Native CLI | 0.73+ | `npm install -g react-native-cli` |
| Android Studio | Latest | [developer.android.com](https://developer.android.com/studio) |
| Xcode | 15+ (macOS only) | Mac App Store |
| adb | Latest | Included with Android Studio |

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/faceguard/faceguard-offline.git
cd faceguard-offline

# Install Node dependencies
npm install

# Install iOS pods (macOS only)
cd ios && pod install && cd ..

# Install Python benchmark dependencies
pip install websocket-client numpy matplotlib

# Verify installation
npm test
```

---

## Running Tests

### Unit Tests (Jest)

```bash
# Run all unit tests
npm test

# Run a specific test file
npx jest src/__tests__/FaceEngine.test.ts

# Run with coverage report
npx jest --coverage

# Run in watch mode during development
npx jest --watch
```

### Test Suite Structure

| File | Tests | Description |
|------|-------|-------------|
| `FaceEngine.test.ts` | 19 | Core engine: cosine similarity, normalisation, matching, EAR, spoof detection |
| `BiometricVault.test.ts` | 13 | Encryption, SQLite schema, enrolment, sync queue, purge |
| `SyncManager.test.ts` | 11 | AWS-mocked sync: queue, upload, partial failure, purge ordering |

### Benchmark Scripts

```bash
# Device performance benchmark (requires connected device)
python scripts/benchmark/device_benchmark.py --platform android --host localhost --port 8081

# Accuracy validation (runs locally with simulated embeddings)
python scripts/benchmark/accuracy_report.py

# Liveness / anti-spoofing validation
python scripts/benchmark/liveness_spoof_test.py
```

### In-App Benchmark

The `InAppBenchmark` class in `src/utils/InAppBenchmark.ts` can be triggered from the Admin screen. It runs 20 recognition cycles and generates CSV and text reports.

---

## Model Preparation

### Downloading Models

The three TFLite models are not checked into Git (they're in `.gitignore`). Download them:

```bash
# BlazeFace (face detection, 0.1 MB)
wget -O models/blazeface.tflite \
  https://storage.googleapis.com/mediapipe-models/face_detection/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite

# MobileFaceNet (embedding extraction, 2.3 MB)
# Converted from the original Insightface model
python scripts/convert_mobilefacenet.py --input models/mobilefacenet.onnx --output models/mobilefacenet.tflite

# MiniFASNet (liveness detection, 1.1 MB)
python scripts/convert_minifasnet.py --input models/minifasnet.onnx --output models/minifasnet.tflite
```

### Quantisation

```bash
# INT8 quantisation for BlazeFace (maximum speed)
python scripts/quantise.py --model models/blazeface.tflite --type int8

# FP16 quantisation for MobileFaceNet and MiniFASNet (accuracy/speed tradeoff)
python scripts/quantise.py --model models/mobilefacenet.tflite --type fp16
python scripts/quantise.py --model models/minifasnet.tflite --type fp16
```

### Deploying Models to App

```bash
# Android: copy to assets
cp models/*.tflite android/app/src/main/assets/

# iOS: add to Xcode project bundle resources
# (drag and drop into Xcode, ensure "Copy items if needed" is checked)
```

---

## Code Style

- **TypeScript**: Strict mode, ESLint + Prettier
- **Python**: Black formatter, type hints required
- **Commits**: Conventional Commits format (`feat:`, `fix:`, `test:`, `docs:`)
- **Tests**: All new features must include corresponding unit tests

```bash
# Lint TypeScript
npx eslint src/ --ext .ts,.tsx

# Format Python
black scripts/

# Type-check
npx tsc --noEmit
```

---

## Contribution Workflow

1. **Fork** the repository
2. **Create a branch**: `git checkout -b feat/your-feature`
3. **Make changes** with tests
4. **Run the test suite**: `npm test`
5. **Commit** using conventional commit format
6. **Push** and open a Pull Request

### PR Requirements

- [ ] All existing tests pass
- [ ] New tests added for new functionality
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] ESLint passes with no warnings
- [ ] PR description explains the "why", not just the "what"

---

## Project Structure

```
faceguard-offline/
├── src/
│   ├── engine/          # FaceEngine (cosine, matching, EAR, spoof)
│   ├── storage/         # BiometricVault (SQLite + AES-256)
│   ├── sync/            # SyncManager (DynamoDB + background fetch)
│   ├── utils/           # InAppBenchmark, helpers
│   └── __tests__/       # Jest unit tests
├── scripts/
│   └── benchmark/       # Python benchmark scripts
├── models/              # TFLite models (not in Git)
├── docs/                # Documentation
│   ├── ARCHITECTURE.md
│   ├── INTEGRATION.md
│   ├── BENCHMARKS.md
│   ├── SECURITY.md
│   └── API_REFERENCE.md
├── .github/             # Issue and PR templates
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

---

## Reporting Issues

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) for bugs. Include:

- Device model and OS version
- Steps to reproduce
- Expected vs actual behaviour
- Logs from `adb logcat` or Xcode console

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
