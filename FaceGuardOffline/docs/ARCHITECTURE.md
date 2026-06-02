# 🏗️ Architecture Document — FaceGuard Offline

> **Version:** 1.0.0  
> **Last Updated:** May 2026  
> **Status:** Living Document

---

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Module Descriptions](#module-descriptions)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Offline-First Design Principles](#offline-first-design-principles)
6. [Threading Model](#threading-model)
7. [Memory Management Strategy](#memory-management-strategy)
8. [Error Handling Architecture](#error-handling-architecture)

---

## System Overview

FaceGuard Offline is designed as a **layered, modular architecture** that separates concerns between UI presentation, business logic, ML inference, and data persistence. The system operates in a **fully offline-capable mode**, with optional cloud synchronization when connectivity is available.

### Design Goals

| Goal                | Strategy                                          |
| ------------------- | ------------------------------------------------- |
| **Offline-First**   | All critical paths function without network       |
| **Low Latency**     | Sub-500ms end-to-end authentication               |
| **Security**        | Defense-in-depth with hardware-backed encryption  |
| **Reliability**     | Graceful degradation under resource pressure      |
| **Maintainability** | Clean module boundaries with dependency injection |
| **Testability**     | Every module testable in isolation                |

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                          │
│                                                                 │
│   ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐    │
│   │   Screens   │  │  Components  │  │   Navigation      │    │
│   │             │  │              │  │   (Stack-based)    │    │
│   │ • Home      │  │ • CameraView │  │                    │    │
│   │ • Enroll    │  │ • FaceOverlay│  │  Home ──► Enroll   │    │
│   │ • Recognize │  │ • ResultCard │  │    │                │    │
│   │ • Settings  │  │ • LivenessUI │  │    ├──► Recognize  │    │
│   │ • SyncDash  │  │ • StatusBadge│  │    ├──► Settings   │    │
│   └──────┬──────┘  └──────┬───────┘  │    └──► SyncDash   │    │
│          │                │          └───────────────────┘    │
│          └────────┬───────┘                                    │
│                   │                                            │
│          ┌────────▼────────┐                                   │
│          │  Zustand Stores │                                   │
│          │ • useAuthStore  │                                   │
│          │ • useCameraStore│                                   │
│          │ • useSyncStore  │                                   │
│          └────────┬────────┘                                   │
├───────────────────┼────────────────────────────────────────────┤
│                   │       APPLICATION LAYER                     │
│                   │                                            │
│   ┌───────────────▼───────────────────────────────────────┐   │
│   │              Service Orchestrator                      │   │
│   │                                                        │   │
│   │  ┌──────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│   │  │ AuthService  │  │ SyncManager │  │ AuditLogger │  │   │
│   │  │              │  │             │  │             │  │   │
│   │  │ • enroll()   │  │ • queue()   │  │ • logAuth() │  │   │
│   │  │ • recognize()│  │ • flush()   │  │ • logSync() │  │   │
│   │  │ • verify()   │  │ • retry()   │  │ • export()  │  │   │
│   │  └──────┬───────┘  └──────┬──────┘  └──────┬──────┘  │   │
│   └─────────┼─────────────────┼─────────────────┼─────────┘   │
├─────────────┼─────────────────┼─────────────────┼─────────────┤
│             │       CORE ENGINE LAYER            │             │
│             │                                    │             │
│  ┌──────────▼──────────┐  ┌──────────────────────▼──────────┐ │
│  │     FaceEngine      │  │       BiometricVault            │ │
│  │                     │  │                                  │ │
│  │  ┌───────────────┐  │  │  ┌──────────────────────────┐   │ │
│  │  │ FaceDetector  │  │  │  │   EncryptionService      │   │ │
│  │  │ (BlazeFace)   │  │  │  │   (AES-256-GCM)          │   │ │
│  │  │               │  │  │  └──────────────────────────┘   │ │
│  │  │ Input: 128×128│  │  │                                  │ │
│  │  │ Output: BBoxes│  │  │  ┌──────────────────────────┐   │ │
│  │  └───────────────┘  │  │  │   DatabaseManager        │   │ │
│  │                     │  │  │   (SQLite + Encryption)   │   │ │
│  │  ┌───────────────┐  │  │  └──────────────────────────┘   │ │
│  │  │FaceRecognizer │  │  │                                  │ │
│  │  │(MobileFaceNet)│  │  │  ┌──────────────────────────┐   │ │
│  │  │               │  │  │  │   KeyManager             │   │ │
│  │  │ Input: 112×112│  │  │  │   (Keystore/Keychain)    │   │ │
│  │  │ Output: 128-d │  │  │  └──────────────────────────┘   │ │
│  │  └───────────────┘  │  └──────────────────────────────────┘ │
│  │                     │                                       │
│  │  ┌───────────────┐  │  ┌──────────────────────────────────┐ │
│  │  │LivenessDetect │  │  │       FrameProcessor             │ │
│  │  │               │  │  │                                  │ │
│  │  │ Passive:      │  │  │  • Camera frame capture          │ │
│  │  │  MiniFASNet   │  │  │  • Color space conversion        │ │
│  │  │  (80×80)      │  │  │  • Face alignment & crop         │ │
│  │  │               │  │  │  • Normalization pipeline         │ │
│  │  │ Active:       │  │  │  • Buffer management             │ │
│  │  │  Challenge/   │  │  └──────────────────────────────────┘ │
│  │  │  Response     │  │                                       │
│  │  └───────────────┘  │                                       │
│  └─────────────────────┘                                       │
├────────────────────────────────────────────────────────────────┤
│                    NATIVE BRIDGE LAYER                          │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  TFLite      │  │  Camera      │  │  Platform Crypto     │ │
│  │  TurboModule │  │  TurboModule │  │  TurboModule         │ │
│  │              │  │              │  │                      │ │
│  │ • loadModel  │  │ • getFrame   │  │ • generateKey        │ │
│  │ • runInfer   │  │ • setConfig  │  │ • encrypt/decrypt    │ │
│  │ • dispose    │  │ • onFrame    │  │ • sign/verify        │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

---

## Module Descriptions

### 1. FaceEngine

The central ML inference orchestrator that manages the face detection and recognition pipeline.

```
FaceEngine
├── FaceDetector
│   ├── Model: BlazeFace (short-range variant)
│   ├── Input: 128×128×3 RGB tensor (normalized to [-1, 1])
│   ├── Output: Up to 100 face detections with:
│   │   ├── Bounding box (xMin, yMin, width, height)
│   │   ├── Confidence score (0.0 – 1.0)
│   │   └── 6 facial landmarks (eyes, nose, mouth, ears)
│   ├── NMS threshold: 0.3
│   └── Confidence threshold: 0.75
│
├── FaceRecognizer
│   ├── Model: MobileFaceNet (ArcFace-trained)
│   ├── Input: 112×112×3 RGB tensor (aligned face crop)
│   ├── Output: 128-dimensional L2-normalized embedding vector
│   ├── Similarity metric: Cosine similarity
│   ├── Match threshold: 0.65 (configurable)
│   └── Top-K: 5 candidates returned
│
└── Pipeline Orchestration
    ├── Frame → Detect → Align → Recognize
    ├── Automatic face tracking across frames
    └── Quality assessment gating (blur, exposure, angle)
```

**Key Responsibilities:**

- Load and manage TFLite model lifecycle
- Preprocess camera frames for model input
- Run inference on the dedicated ML thread
- Post-process model outputs (NMS, thresholding)
- Manage face tracking state across consecutive frames

### 2. LivenessDetector

Dual-layer anti-spoofing system combining passive analysis with active challenges.

```
LivenessDetector
├── PassiveAnalyzer
│   ├── Model: MiniFASNet (Face Anti-Spoofing Network)
│   ├── Input: 80×80×3 RGB tensor
│   ├── Output: Liveness probability (0.0 – 1.0)
│   ├── Threshold: 0.85 for "live" classification
│   ├── Analysis: Moiré patterns, color histogram, texture gradients
│   └── Latency: ~35ms per frame
│
├── ActiveChallenge
│   ├── Challenge types:
│   │   ├── HEAD_TURN_LEFT — Verify 3D head rotation
│   │   ├── HEAD_TURN_RIGHT — Verify opposite rotation
│   │   ├── BLINK — Detect natural eye blink pattern
│   │   ├── SMILE — Detect facial expression change
│   │   └── NOD — Detect vertical head movement
│   ├── Random challenge selection (2 of 5 per session)
│   ├── Timeout: 5 seconds per challenge
│   └── Motion vector analysis for compliance verification
│
└── Decision Fusion
    ├── Combined score = 0.6 × passive + 0.4 × active
    ├── Both layers must pass independently
    └── Temporal consistency check (3 consecutive frames)
```

**Key Responsibilities:**

- Run passive liveness inference on every captured frame
- Generate random active challenge sequences
- Track challenge compliance with motion analysis
- Fuse passive and active scores for final liveness decision
- Detect and reject printed photos, screen replays, and masks

### 3. BiometricVault

Secure encrypted storage for biometric embeddings and authentication records.

```
BiometricVault
├── EncryptionService
│   ├── Algorithm: AES-256-GCM
│   ├── Key derivation: HKDF-SHA256
│   ├── IV: 12-byte random per encryption
│   ├── Auth tag: 16-byte (128-bit)
│   └── Key rotation: Every 90 days
│
├── DatabaseManager
│   ├── Engine: SQLite via react-native-quick-sqlite
│   ├── Database file: encrypted with SQLCipher
│   ├── Tables:
│   │   ├── enrollments (id, user_id, embedding_enc, created_at, expires_at)
│   │   ├── auth_events (id, user_id, result, confidence, gps, timestamp)
│   │   ├── sync_queue (id, event_id, status, retry_count, created_at)
│   │   └── app_config (key, value, updated_at)
│   └── Indexes: user_id, timestamp, sync_status
│
└── KeyManager
    ├── Android: Android Keystore System
    ├── iOS: iOS Keychain Services
    ├── Key types:
    │   ├── Master encryption key (hardware-backed, non-extractable)
    │   ├── Embedding encryption key (derived from master)
    │   └── Sync authentication key (for API signing)
    └── Biometric gate: Optional fingerprint/face unlock for key access
```

**Key Responsibilities:**

- Encrypt biometric embeddings before storage
- Manage SQLite database with encrypted columns
- Interface with hardware keystore for key operations
- Enforce data retention policies (auto-expiry)
- Provide secure search over encrypted embeddings

### 4. SyncManager

Manages bidirectional data synchronization with NHAI Datalake 3.0.

```
SyncManager
├── QueueManager
│   ├── Priority queue (FIFO with priority levels)
│   ├── Queue persistence in SQLite
│   ├── Max queue size: 10,000 events
│   └── Auto-pruning: oldest non-critical events after capacity
│
├── BatchUploader
│   ├── Batch size: 50 events per upload
│   ├── Compression: GZIP (70% reduction)
│   ├── Protocol: HTTPS POST with signed payloads
│   ├── Timeout: 30 seconds per batch
│   └── Idempotency: UUID-based deduplication
│
├── NetworkMonitor
│   ├── Connectivity detection via @react-native-community/netinfo
│   ├── Connection quality assessment (latency, bandwidth)
│   ├── WiFi vs cellular awareness
│   └── Configurable sync-only-on-WiFi option
│
└── RetryStrategy
    ├── Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s
    ├── Max retries: 5 per event
    ├── Jitter: ±20% randomization
    ├── Circuit breaker: Opens after 3 consecutive failures
    └── Dead letter queue: Events exceeding max retries
```

**Key Responsibilities:**

- Queue authentication events for sync
- Monitor network connectivity changes
- Execute batch uploads with compression
- Handle retries with exponential backoff
- Manage sync state machine (Idle → Syncing → Waiting → Error)

---

## Data Flow Diagrams

### Enrollment Flow

```
┌─────────┐     ┌──────────┐     ┌───────────┐     ┌────────────┐
│  User   │     │  Camera   │     │  Face      │     │  Liveness  │
│  Opens  │────►│  Preview  │────►│  Detection │────►│  Check     │
│  Enroll │     │  Stream   │     │  (BlazeFace)│     │  (Passive) │
└─────────┘     └──────────┘     └───────────┘     └─────┬──────┘
                                                          │
                                                    Pass? │
                                                   ┌──────┼──────┐
                                                   │ Yes         │ No
                                                   ▼             ▼
                                            ┌─────────────┐  ┌──────────┐
                                            │   Active     │  │  Reject  │
                                            │   Liveness   │  │  & Retry │
                                            │   Challenge  │  └──────────┘
                                            └──────┬──────┘
                                                   │
                                             Pass? │
                                            ┌──────┼──────┐
                                            │ Yes         │ No
                                            ▼             ▼
                                     ┌─────────────┐  ┌──────────┐
                                     │  Extract     │  │  Reject  │
                                     │  Embedding   │  │  & Retry │
                                     │ (MobileFace) │  └──────────┘
                                     └──────┬──────┘
                                            │
                                            ▼
                                     ┌─────────────┐
                                     │  Encrypt &   │
                                     │  Store in    │──── Audit Log
                                     │  Vault       │
                                     └──────┬──────┘
                                            │
                                            ▼
                                     ┌─────────────┐
                                     │  Queue for   │
                                     │  Sync        │
                                     └─────────────┘
```

### Recognition Flow

```
┌──────────┐     ┌──────────┐     ┌────────────┐     ┌────────────┐
│  Camera  │     │  Frame   │     │   Face     │     │  Quality   │
│  Frame   │────►│ Process  │────►│  Detection │────►│  Check     │
│  Capture │     │  (RGB)   │     │ (BlazeFace)│     │ (Blur/Exp) │
└──────────┘     └──────────┘     └────────────┘     └─────┬──────┘
                                                           │
                                                     Pass? │
                                                    ┌──────┼──────┐
                                                    │ Yes         │ No
                                                    ▼             ▼
                                             ┌─────────────┐  ┌──────────┐
                                             │  Liveness   │  │  Skip    │
                                             │  Passive    │  │  Frame   │
                                             │  Check      │  └──────────┘
                                             └──────┬──────┘
                                                    │
                                              Pass? │
                                             ┌──────┼──────┐
                                             │ Yes         │ No
                                             ▼             ▼
                                      ┌─────────────┐  ┌──────────┐
                                      │  Extract     │  │  Spoof   │
                                      │  Embedding   │  │  Alert   │
                                      └──────┬──────┘  └──────────┘
                                             │
                                             ▼
                                      ┌─────────────┐
                                      │  Search     │
                                      │  Vault      │
                                      │  (Cosine    │
                                      │   Sim)      │
                                      └──────┬──────┘
                                             │
                                      ┌──────┼──────┐
                                      │Match         │ No Match
                                      ▼              ▼
                               ┌─────────────┐ ┌──────────┐
                               │  Auth       │ │  Auth    │
                               │  SUCCESS    │ │  FAILED  │
                               │  + Log      │ │  + Log   │
                               └─────────────┘ └──────────┘
```

### Sync Flow

```
┌──────────────────────────────────────────────────────────┐
│                    SYNC STATE MACHINE                     │
│                                                          │
│    ┌────────┐   Network Up    ┌──────────┐              │
│    │  IDLE  │ ──────────────► │ CHECKING │              │
│    │        │ ◄────────────── │  QUEUE   │              │
│    └───┬────┘   Queue Empty   └────┬─────┘              │
│        │                           │                     │
│        │ Timer (15min)       Has Events                  │
│        │                           │                     │
│        ▼                           ▼                     │
│    ┌────────┐               ┌──────────┐                │
│    │  IDLE  │               │ BATCHING │                │
│    │(check) │               │ (50 max) │                │
│    └────────┘               └────┬─────┘                │
│                                  │                       │
│                            ┌─────▼──────┐               │
│                            │  UPLOADING  │               │
│                            │ (HTTPS POST)│               │
│                            └─────┬──────┘               │
│                                  │                       │
│                     ┌────────────┼────────────┐         │
│                     │ Success    │            │ Failure  │
│                     ▼            │            ▼         │
│              ┌──────────┐       │     ┌──────────┐     │
│              │   ACK    │       │     │  RETRY   │     │
│              │  Events  │       │     │ (Backoff)│     │
│              │  Remove  │       │     └────┬─────┘     │
│              │  from Q  │       │          │           │
│              └────┬─────┘       │     Max? │           │
│                   │             │    ┌─────┼─────┐     │
│                   │             │    │ No        │ Yes │
│                   ▼             │    ▼           ▼     │
│              ┌──────────┐       │ (retry)   ┌───────┐ │
│              │  MORE?   │       │           │ DEAD  │ │
│              │  in Q?   │       │           │LETTER │ │
│              └────┬─────┘       │           │ QUEUE │ │
│              Yes  │  No         │           └───────┘ │
│              ┌────┼────┐        │                     │
│              ▼         ▼        │                     │
│         (BATCHING)   (IDLE)     │                     │
│                                  │                     │
└──────────────────────────────────────────────────────────┘
```

---

## Offline-First Design Principles

### 1. Local-First Data Model

All data is created, stored, and queried locally **first**. The server is treated as a **replication target**, not a source of truth for authentication decisions.

```
Priority: Local Device (Primary) ──► Cloud Datalake (Replica)
```

### 2. Optimistic Operations

Every operation assumes it will succeed locally. Network sync is a background concern:

| Operation       | Local Behavior          | Sync Behavior          |
| --------------- | ----------------------- | ---------------------- |
| Enrollment      | Immediate local storage | Queued for upload      |
| Recognition     | Local embedding search  | Auth event queued      |
| Settings Change | Immediate local apply   | Config sync on connect |

### 3. Conflict Resolution Strategy

```
Server-Wins for:
  ├── User enrollment status (active/disabled)
  ├── Global configuration updates
  └── Access control policies

Client-Wins for:
  ├── Authentication event logs (append-only)
  ├── Local settings preferences
  └── Cached model versions
```

### 4. Graceful Degradation Ladder

```
Level 0: Full Connectivity
  └── Real-time sync, remote config, OTA model updates

Level 1: Intermittent Connectivity
  └── Batch sync when available, local queue growing

Level 2: No Connectivity (Hours)
  └── Fully offline, queue persistence, no sync

Level 3: No Connectivity (Days)
  └── Offline with warning, storage management, log rotation

Level 4: Storage Pressure
  └── Prune old logs, compress embeddings, minimal operation
```

---

## Threading Model

```
┌──────────────────────────────────────────────────────────────┐
│                       THREAD ARCHITECTURE                     │
│                                                              │
│  ┌─────────────────────┐     ┌─────────────────────────┐   │
│  │    UI THREAD         │     │    JS THREAD             │   │
│  │    (Main Thread)     │     │    (Hermes Engine)       │   │
│  │                      │     │                          │   │
│  │  • React rendering   │     │  • Business logic        │   │
│  │  • Touch handling    │     │  • State management      │   │
│  │  • Animations        │     │  • Navigation            │   │
│  │  • Camera preview    │     │  • Event handling        │   │
│  │                      │     │                          │   │
│  │  Target: 60fps       │     │  Target: <16ms/frame     │   │
│  │  Never block!        │     │  Minimal work            │   │
│  └──────────┬───────────┘     └────────────┬─────────────┘   │
│             │                              │                  │
│             │    ┌─────────────────────┐    │                  │
│             │    │   BRIDGE            │    │                  │
│             └───►│   (TurboModules)    │◄───┘                  │
│                  │   Synchronous JSI   │                       │
│                  └──────────┬──────────┘                       │
│                             │                                  │
│           ┌─────────────────┼──────────────────┐              │
│           │                 │                  │              │
│  ┌────────▼─────────┐ ┌────▼──────────┐ ┌─────▼──────────┐  │
│  │  ML INFERENCE     │ │  CAMERA       │ │  CRYPTO/DB     │  │
│  │  THREAD           │ │  THREAD       │ │  THREAD        │  │
│  │                   │ │               │ │                │  │
│  │  • TFLite interp  │ │  • Frame cap  │ │  • Encryption  │  │
│  │  • Preprocessing  │ │  • YUV→RGB    │ │  • DB queries  │  │
│  │  • Postprocessing │ │  • Resize     │ │  • Key ops     │  │
│  │  • Model loading  │ │  • Rotate     │ │  • Sync I/O    │  │
│  │                   │ │               │ │                │  │
│  │  Thread pool: 2   │ │  Dedicated    │ │  Thread pool:1 │  │
│  │  Priority: HIGH   │ │  Priority:RT  │ │  Priority: MED │  │
│  └───────────────────┘ └───────────────┘ └────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  BACKGROUND SYNC THREAD                                │   │
│  │  • Periodic sync (every 15 min when online)           │   │
│  │  • Batch upload processing                             │   │
│  │  • Network state monitoring                            │   │
│  │  Priority: LOW | Wakeable by NetInfo                   │   │
│  └───────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Thread Communication

| From → To   | Mechanism                          | Data                |
| ----------- | ---------------------------------- | ------------------- |
| Camera → ML | SharedArrayBuffer / Frame callback | Raw pixel buffer    |
| ML → JS     | Promise resolution / Event emitter | Detection results   |
| JS → Crypto | TurboModule sync call              | Embedding data      |
| JS → Sync   | Background task API                | Sync commands       |
| Sync → JS   | Event emitter                      | Sync status updates |

### Critical Thread Rules

1. **Never run ML inference on UI thread** — causes frame drops
2. **Never run DB/crypto on JS thread** — blocks React rendering
3. **Camera frames are zero-copy** — passed by reference, not cloned
4. **Model loading is async** — done at app startup with splash screen
5. **Sync is interruptible** — can be paused/resumed without data loss

---

## Memory Management Strategy

### Memory Budget

| Component              | Budget     | Strategy                      |
| ---------------------- | ---------- | ----------------------------- |
| TFLite Models (loaded) | ~45MB      | Lazy load, share interpreters |
| Camera Frame Buffer    | ~12MB      | Ring buffer, 3 frames max     |
| Embedding Cache        | ~5MB       | LRU cache, 1000 entries       |
| SQLite Working Set     | ~10MB      | Page cache limit              |
| React Native Runtime   | ~40MB      | Standard Hermes allocation    |
| **Total Target**       | **<150MB** | **Fits in 4GB device**        |

### Memory Lifecycle

```
App Launch
  │
  ├── Load Hermes VM (~40MB)
  ├── Initialize SQLite (~5MB)
  │
  ▼
Splash Screen
  │
  ├── Load BlazeFace model (~2MB)
  ├── Load MobileFaceNet model (~5MB)
  ├── Load MiniFASNet model (~2MB)
  ├── Allocate TFLite interpreters (~36MB tensors)
  │
  ▼
Camera Active
  │
  ├── Allocate frame buffer ring (3 × 4MB = ~12MB)
  ├── Peak memory: ~150MB
  │
  ▼
Camera Inactive
  │
  ├── Release frame buffers (-12MB)
  ├── Keep models loaded (warm start)
  │
  ▼
Background / Low Memory
  │
  ├── Release model interpreters (-36MB)
  ├── Flush embedding cache (-5MB)
  ├── Keep DB connection alive
  └── Models reload on next camera open
```

### Memory Pressure Response

```
onMemoryWarning(level):
  Level 1 (MODERATE):
    → Flush embedding LRU cache
    → Release unused model interpreters
    → Trim SQLite page cache

  Level 2 (CRITICAL):
    → Release ALL model interpreters
    → Release camera buffers
    → Save state to disk
    → Show "Low Memory" warning to user

  Level 3 (TERMINAL):
    → Emergency state save
    → Release everything possible
    → OS may terminate app
```

---

## Error Handling Architecture

### Error Classification

| Category        | Examples                                      | Response                    |
| --------------- | --------------------------------------------- | --------------------------- |
| **Recoverable** | Model inference timeout, DB write failure     | Retry with backoff          |
| **Degraded**    | Camera permission denied, low light           | Prompt user action          |
| **Fatal**       | Model file corrupted, keystore unavailable    | Show error, require restart |
| **Silent**      | Sync failure (offline), non-critical log loss | Queue for later, continue   |

### Error Propagation

```
Native Layer Error
  │
  ├── Caught by TurboModule
  ├── Translated to typed error
  │
  ▼
Service Layer
  │
  ├── Logged via AuditLogger
  ├── Classified (recoverable/degraded/fatal)
  │
  ▼
Store Layer
  │
  ├── Error state updated
  ├── UI reactively displays
  │
  ▼
User Feedback
  │
  ├── Toast for recoverable
  ├── Modal for degraded
  └── Full-screen for fatal
```

---

## Offline-First State Contract

FaceGuard Offline treats SQLite as the source of truth and uses Zustand only as a reactive UI cache over the vault. Network state never owns user-facing data.

1. Every user action first writes to SQLite, then attempts network sync.
2. UI always reads from SQLite-backed state and never waits for the network.
3. Sync is async, background, and fire-and-forget from the field user's perspective.
4. Network errors are silently queued and never surfaced to field users.
5. The app boots and runs identically with or without internet.

### State Ownership

```
Camera / Forms / Actions
  |
  v
Zustand action
  |
  v
VaultManager SQLite write
  |
  v
Optimistic UI refresh from SQLite
  |
  v
SyncManager background upload when possible
```

`useAppStore` exposes global UI state such as employees, attendance, sync status, online status, model readiness, spoof counts, and benchmark summary. `useEnrolmentStore` owns wizard-only capture state. `useRecognitionStore` owns the camera recognition state machine. None of these stores replace `VaultManager`; they hydrate from it and write through it.

---

> 📝 **This is a living document.** Updated as the architecture evolves during development.
