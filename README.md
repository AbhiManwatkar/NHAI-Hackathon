<p align="center">
  <strong>FaceGuard Offline</strong><br/>
  Secure Biometric Authentication for Remote Field Operations
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Android%20%7C%20iOS-blue" alt="Platform" />
  <img src="https://img.shields.io/badge/network-100%25%20Offline-green" alt="Offline" />
  <img src="https://img.shields.io/badge/AI%20model-3.5%20MB-orange" alt="Model Size" />
  <img src="https://img.shields.io/badge/license-MIT-brightgreen" alt="License" />
  <img src="https://img.shields.io/badge/React%20Native-0.73+-61DAFB" alt="React Native" />
  <img src="https://img.shields.io/badge/DPDP%20Act-Compliant-purple" alt="DPDP" />
</p>

<p align="center">
  100% offline · sub-second recognition · 3.5 MB AI footprint · AES-256 encrypted · Android + iOS
</p>

---

## The Problem

India's national highway infrastructure projects operate in some of the most connectivity-challenged environments in the country. Construction supervisors, toll operators, and maintenance crews work at sites where cellular coverage is intermittent at best and completely absent for days at a stretch. Existing biometric attendance systems — fingerprint scanners tethered to cloud APIs, RFID badges vulnerable to buddy-punching, or manual registers that invite fraud — fail catastrophically in these conditions. The result: inaccurate payroll data, ghost worker fraud costing crores annually, and zero accountability at the site level.

The problem is compounded by India's demographic diversity. Solutions built on Western facial recognition datasets perform poorly across the range of Indian skin tones and lighting conditions found at highway construction sites — harsh midday sun, dim pre-dawn muster calls, and uneven artificial lighting in toll plazas. What's needed is a biometric system that works without any network dependency, runs on the ₹8,000 Android phones that field supervisors actually carry, handles Indian faces with proven accuracy, and does all of this while respecting the privacy mandates of the Digital Personal Data Protection Act, 2023.

## The Solution

**FaceGuard Offline** is a complete on-device biometric authentication SDK for React Native that performs face detection, liveness verification, and identity matching entirely offline using a cascade of three optimised TensorFlow Lite models totalling just 3.5 MB. Recognition completes in under one second on budget Android hardware, encrypted attendance records queue locally in SQLite, and sync automatically to AWS DynamoDB when connectivity returns — with cryptographic purge of on-device data after confirmed upload.

- **🔒 Zero network dependency** — Full pipeline runs on-device; no API calls during recognition
- **⚡ Sub-second recognition** — p95 latency < 900ms on 3 GB RAM Android devices
- **🤖 3-model AI cascade** — BlazeFace → MobileFaceNet → MiniFASNet for detect → match → verify
- **🛡️ Anti-spoofing** — Printed photo and screen replay attacks detected with > 98% accuracy
- **🔐 AES-256 encryption** — Embeddings encrypted at rest; no raw biometric images stored
- **📱 3.5 MB footprint** — All three models combined; app package delta < 20 MB
- **🇮🇳 Indian demographic validation** — Tested across ITA° 10–55 skin tone range
- **📡 Smart sync** — Offline queue → connectivity detection → batch upload → cryptographic purge

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     FaceGuard Offline                        │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│  Camera  │ BlazeFace│  CLAHE   │MobileFace│   MiniFASNet    │
│  Frame   │ Detection│  Enhance │Net Embed │   Liveness      │
│          │  <50ms   │  <30ms   │  <200ms  │    <150ms       │
├──────────┴──────┬───┴──────────┴──────┬───┴─────────────────┤
│                 │                     │                      │
│    ┌────────────▼───────────┐  ┌──────▼──────────────┐      │
│    │   Cosine Similarity    │  │  Spoof Classifier   │      │
│    │   Match (<5ms/100)     │  │  live | print | vid │      │
│    └────────────┬───────────┘  └──────┬──────────────┘      │
│                 │                     │                      │
│         ┌───────▼─────────────────────▼───────┐             │
│         │          BiometricVault              │             │
│         │   AES-256-CBC · SQLite · PBKDF2     │             │
│         └───────────────┬─────────────────────┘             │
│                         │                                    │
│              ┌──────────▼──────────┐                        │
│              │    SyncManager      │                        │
│              │  Queue → Upload →   │                        │
│              │  Verify → Purge     │                        │
│              └──────────┬──────────┘                        │
│                         │                                    │
└─────────────────────────┼────────────────────────────────────┘
                          │ (when online)
                 ┌────────▼────────┐
                 │  AWS DynamoDB   │
                 │  Datalake 3.0   │
                 └─────────────────┘
```

## Quick Start

```bash
# 1. Clone
git clone https://github.com/faceguard/faceguard-offline.git && cd faceguard-offline

# 2. Install dependencies
npm install

# 3. Run on device
npx react-native run-android   # or: npx react-native run-ios
```

> Face recognition requires a physical device with a camera. Emulators will only run unit tests.

### Running Tests

```bash
npm test                                                      # Unit tests
python scripts/benchmark/device_benchmark.py --platform android  # Performance
python scripts/benchmark/accuracy_report.py                      # Accuracy
python scripts/benchmark/liveness_spoof_test.py                  # Liveness
```

## Model Performance

| Model | Task | Size | Accuracy | Mean Latency | Quantisation | License |
|-------|------|------|----------|-------------|-------------|---------|
| [BlazeFace](https://arxiv.org/abs/1907.05047) | Face detection | 0.1 MB | 98.6% mAP | < 50ms | INT8 | Apache 2.0 |
| [MobileFaceNet](https://arxiv.org/abs/1804.07573) | Embedding extraction | 2.3 MB | 99.2% LFW | < 200ms | FP16 | MIT |
| [MiniFASNet](https://arxiv.org/abs/2004.14756) | Liveness detection | 1.1 MB | 98.5% ACER | < 150ms | FP16 | Apache 2.0 |
| **Total** | | **3.5 MB** | | **< 430ms** | | |

## Benchmark Results

| Device | RAM | Total Pipeline (p95) | Recognition Accuracy | Liveness Accuracy |
|--------|-----|---------------------|---------------------|-------------------|
| Redmi 10 (budget) | 4 GB | 780ms | 96.8% TAR | 98.2% |
| Samsung Galaxy A22 | 4 GB | 650ms | 97.1% TAR | 98.5% |
| iPhone SE (2nd gen) | 3 GB | 420ms | 97.4% TAR | 99.1% |
| Samsung Galaxy S21 | 8 GB | 310ms | 97.6% TAR | 99.3% |

> Target: p95 < 900ms · TAR > 95% · FAR < 1% · FRR < 5%

Full methodology: [`docs/BENCHMARKS.md`](docs/BENCHMARKS.md)

## Integration with Datalake 3.0

```typescript
import { FaceGuard } from '@faceguard/react-native-biometric';

await FaceGuard.initialize({ siteCode: 'NH_044', awsConfig });

const result = await FaceGuard.markAttendance();
```

Detailed integration guide: [`docs/INTEGRATION.md`](docs/INTEGRATION.md)

## Security Model

- **No images stored** — Only 128-d numerical embeddings; face images never touch disk
- **AES-256-CBC encryption** — Device-bound key via PBKDF2 (100k iterations, SHA-512)
- **Random IV per record** — Cryptographically random 16-byte IV prevents ciphertext correlation
- **Device binding** — Encryption key seeded from hardware device ID; non-transferable
- **Cryptographic purge** — After confirmed sync, embeddings overwritten with zeros before deletion
- **No biometric reconstruction** — 128-float embeddings cannot reverse-engineer facial images
- **DPDP Act 2023 aligned** — Purpose limitation, data minimisation, storage limitation by design

Full threat model: [`docs/SECURITY.md`](docs/SECURITY.md)

## Attack Prevention Matrix

| Attack Type | Detection Method | Defence Layer | Accuracy |
|-------------|-----------------|---------------|----------|
| Printed photo | MiniFASNet depth + texture classification | Liveness | > 98% |
| Screen replay | Moiré pattern detection + temporal consistency | Liveness | > 98% |
| 3D mask | Depth score anomaly + IR reflectance (roadmap) | Liveness | Planned |
| Buddy punching | Biometric identity verification | Recognition | > 97% |
| Embedding theft | AES-256-CBC at rest + device-bound key | Storage | Cryptographic |
| Man-in-the-middle | TLS 1.3 during sync + request signing | Transport | Cryptographic |
| Replay attack | Timestamp + nonce in each record | Protocol | Verified |
| Database extraction | SQLCipher + rooted device detection | Storage | Defence-in-depth |

## Sync Architecture

```
1. CAPTURE     Face recognised → attendance record created (Status: LOCAL)
2. QUEUE       Record added to sync queue with monotonic sequence ID
3. DETECT      NetInfo listener detects connectivity (+ background fetch every 15 min)
4. UPLOAD      SyncManager.uploadBatch() → AWS DynamoDB (batch of 25)
5. VERIFY      Server acknowledges; markSynced() updates status → SYNCED
6. PURGE       purgeRecords() zeroes embeddings; metadata retained for audit
```

## Open-Source Compliance

| Library | Version | License | Repository |
|---------|---------|---------|------------|
| TensorFlow Lite | 2.14 | Apache 2.0 | [tensorflow/tensorflow](https://github.com/tensorflow/tensorflow) |
| React Native | 0.73 | MIT | [facebook/react-native](https://github.com/facebook/react-native) |
| react-native-camera | 4.2 | MIT | [react-native-camera](https://github.com/react-native-camera/react-native-camera) |
| react-native-sqlite-storage | 6.0 | MIT | [react-native-sqlite-storage](https://github.com/nicoledennis/react-native-sqlite-storage) |
| AWS SDK JS v3 | 3.x | Apache 2.0 | [aws-sdk-js-v3](https://github.com/aws/aws-sdk-js-v3) |
| react-native-background-fetch | 4.2 | MIT | [react-native-background-fetch](https://github.com/transistorsoft/react-native-background-fetch) |
| @react-native-community/netinfo | 11.x | MIT | [react-native-netinfo](https://github.com/react-native-netinfo/react-native-netinfo) |

## Team

| Name | Role |
|------|------|
| **Sarthak Kale** | Project Lead & ML Pipeline |
| **Team Member 2** | React Native & Frontend |
| **Team Member 3** | Backend & AWS Integration |
| **Team Member 4** | Security & Testing |

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System design, data flow, state machines |
| [Integration](docs/INTEGRATION.md) | Add FaceGuard to any React Native app |
| [Benchmarks](docs/BENCHMARKS.md) | Performance methodology and results |
| [Security](docs/SECURITY.md) | Threat model, encryption, DPDP compliance |
| [API Reference](docs/API_REFERENCE.md) | TypeScript function signatures |
| [Contributing](CONTRIBUTING.md) | Development setup and contribution guide |

## License

MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">Built for the field. Secured by design. Private by default.</p>
