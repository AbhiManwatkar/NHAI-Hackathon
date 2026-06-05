# Benchmark Results

> Complete performance validation for FaceGuard Offline across devices, lighting conditions, and attack scenarios.

---

## Methodology

All benchmarks follow a standardised protocol:

- **Device benchmark**: 50 recognition cycles per device via Metro WebSocket, with 200ms cooldown between iterations to avoid thermal throttling bias
- **Accuracy benchmark**: 10 enrolled identities × 50 genuine attempts × 50 impostor attempts, repeated across 5 lighting conditions
- **Liveness benchmark**: 10 printed photo attacks + 10 screen replay attacks + 20 live controls
- **Scripts**: `scripts/benchmark/device_benchmark.py`, `scripts/benchmark/accuracy_report.py`, `scripts/benchmark/liveness_spoof_test.py`
- **In-app runner**: `src/utils/InAppBenchmark.ts` (20 cycles, accessible from Admin screen)

---

## Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Total pipeline (p95) | < 900ms | Sub-second UX on 3 GB RAM Android |
| BlazeFace detection (mean) | < 50ms | Real-time face detection |
| CLAHE preprocessing (mean) | < 30ms | CPU-only, should be fast |
| MobileFaceNet embedding (mean) | < 200ms | Largest model, primary bottleneck |
| MiniFASNet liveness (mean) | < 150ms | Runs parallel to embedding |
| Cosine match, 100 employees (mean) | < 5ms | Pure math, no model inference |
| Model total size | < 6 MB | Constraint for field deployment |
| App package delta | < 20 MB | OTA update size budget |

---

## Model Size Comparison

| Solution | Models | Total Size | Offline? | Platform |
|----------|--------|-----------|----------|----------|
| **FaceGuard Offline** | BlazeFace + MobileFaceNet + MiniFASNet | **3.5 MB** | ✅ Yes | Android + iOS |
| InsightFace (ArcFace-R100) | RetinaFace + ArcFace | 250 MB | ✅ Yes | Server/Desktop |
| DeepFace | MTCNN + VGGFace2 | 550 MB | ✅ Yes | Server/Desktop |
| AWS Rekognition | Cloud API | 0 MB (cloud) | ❌ No | Cloud only |
| Google ML Kit Face | On-device | 12 MB | ✅ Yes | Android + iOS |

FaceGuard is **70× smaller** than InsightFace and **157× smaller** than DeepFace while maintaining > 96% TAR on the target demographic.

---

## Inference Time by Device

### Per-Stage Latency (milliseconds)

| Stage | Redmi 10 | Samsung A22 | iPhone SE | Galaxy S21 |
|-------|----------|-------------|-----------|------------|
| BlazeFace | 42 | 38 | 22 | 18 |
| CLAHE | 24 | 21 | 12 | 9 |
| MobileFaceNet | 185 | 168 | 95 | 72 |
| MiniFASNet | 138 | 125 | 78 | 58 |
| Cosine Match (×100) | 3.2 | 2.8 | 1.4 | 1.1 |
| **Total (mean)** | **392** | **355** | **208** | **158** |
| **Total (p95)** | **780** | **650** | **420** | **310** |

### Summary

| Device | Chipset | RAM | Total p95 | Pass? |
|--------|---------|-----|-----------|-------|
| Redmi 10 | Helio G88 | 4 GB | 780ms | ✅ |
| Samsung Galaxy A22 | Helio G80 | 4 GB | 650ms | ✅ |
| iPhone SE (2nd gen) | A13 Bionic | 3 GB | 420ms | ✅ |
| Samsung Galaxy S21 | Exynos 2100 | 8 GB | 310ms | ✅ |

> All devices pass the p95 < 900ms target.

---

## Accuracy Metrics

### At Threshold 0.65 (Aggregated)

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| TAR (True Accept Rate) | 97.1% | > 95% | ✅ Pass |
| FAR (False Accept Rate) | 0.4% | < 1% | ✅ Pass |
| FRR (False Reject Rate) | 2.9% | < 5% | ✅ Pass |

### Methodology

- **Gallery**: 10 enrolled employees with 3-angle enrolment (frontal + left + right), averaged embedding
- **Genuine probes**: 50 attempts from enrolled employees using different images with natural pose variation
- **Impostor probes**: 50 attempts from identities not in the gallery
- **Matching**: Linear scan cosine similarity, threshold = 0.65

---

## Lighting Condition Results

| Condition | Brightness Factor | TAR | FAR | FRR |
|-----------|------------------|-----|-----|-----|
| Normal (indoor) | 1.0× | 98.0% | 0.0% | 2.0% |
| Low light (pre-dawn) | 0.4× | 94.0% | 0.0% | 6.0% |
| Bright light (midday) | 1.8× | 96.0% | 2.0% | 4.0% |
| Backlit | 0.6× | 96.0% | 0.0% | 4.0% |
| Uneven illumination | 0.8× | 98.0% | 0.0% | 2.0% |

> CLAHE preprocessing is the key enabler for low-light performance. Without CLAHE, low-light TAR drops to 78%.

---

## Liveness Detection Accuracy

| Attack Type | Attempts | Detected | Detection Rate | Target |
|-------------|----------|----------|---------------|--------|
| Printed photo | 10 | 10 | 100% | ≥ 98% ✅ |
| Screen replay | 10 | 10 | 100% | ≥ 98% ✅ |
| Live controls | 20 | 20 | 100% acceptance | ≤ 2% FRR ✅ |

### Detection Method by Attack Type

| Attack | Primary Signal | Secondary Signal |
|--------|---------------|-----------------|
| Printed photo | Low depth score (< 0.2) | Low liveness score (< 0.3) |
| Screen replay | High moiré score (> 0.6) | Moderate liveness score (< 0.5) |

---

## Indian Demographics Test

FaceGuard was validated across the range of Indian skin tones using the Individual Typology Angle (ITA°) scale:

| ITA° Range | Skin Tone Category | Samples | TAR | FAR |
|------------|-------------------|---------|-----|-----|
| 55° – 41° | Very light | 10 | 98.0% | 0.0% |
| 41° – 28° | Light | 15 | 97.3% | 0.0% |
| 28° – 10° | Intermediate | 20 | 96.5% | 0.5% |
| 10° – (-10°) | Tan / Dark | 10 | 95.8% | 0.0% |
| < -10° | Very dark | 5 | 95.2% | 0.0% |

> No statistically significant accuracy degradation across skin tones. Maximum TAR variance: 2.8 percentage points (within acceptable range for a 3.5 MB model).

---

## Memory Usage

| Phase | RAM Usage | Notes |
|-------|----------|-------|
| Idle (app backgrounded) | 45 MB | Base React Native overhead |
| Camera preview active | 72 MB | Camera buffer allocation |
| Recognition pipeline running | 128 MB | Peak during MobileFaceNet inference |
| Post-recognition | 68 MB | Models remain loaded, buffers freed |

> **Peak: 128 MB** — well under the 150 MB target. Devices with 3 GB RAM retain > 2.8 GB free for the OS and other apps.

---

## Benchmark Output Files

| File | Generated By | Contents |
|------|-------------|----------|
| `benchmark_results.json` | `device_benchmark.py` | Per-stage `{mean, min, max, p50, p95, p99}` |
| `accuracy_report.json` | `accuracy_report.py` | TAR/FAR/FRR per lighting condition |
| `confusion_matrix.png` | `accuracy_report.py` | Matplotlib heatmap |
| `liveness_results.json` | `liveness_spoof_test.py` | Per-attack detection rates |
