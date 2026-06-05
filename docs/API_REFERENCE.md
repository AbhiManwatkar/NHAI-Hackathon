# API Reference

> Complete TypeScript API for FaceGuard Offline. Every exported function with signatures, parameters, return values, examples, and error codes.

---

## Table of Contents

- [FaceGuard (Main SDK)](#faceguard-main-sdk)
- [FaceEngine](#faceengine)
- [BiometricVault](#biometricvault)
- [SyncManager](#syncmanager)
- [InAppBenchmark](#inappbenchmark)
- [Types](#types)
- [Error Codes](#error-codes)

---

## FaceGuard (Main SDK)

The primary entry point. Wraps all subsystems into a simple API.

### `FaceGuard.initialize(config)`

Initialise the FaceGuard SDK. Must be called once before any other method.

```typescript
static async initialize(config: FaceGuardConfig): Promise<void>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `config.siteCode` | `string` | Yes | Unique NHAI site identifier (e.g., `'NH_001'`) |
| `config.awsConfig` | `AWSConfig` | Yes | DynamoDB connection configuration |
| `config.threshold` | `number` | No | Cosine similarity threshold (default: `0.65`) |
| `config.livenessRequired` | `boolean` | No | Enforce anti-spoofing check (default: `true`) |
| `config.autoSync` | `boolean` | No | Enable background sync (default: `true`) |
| `config.syncIntervalMinutes` | `number` | No | Background fetch interval (default: `15`) |

```typescript
await FaceGuard.initialize({
  siteCode: 'NH_044',
  awsConfig: { region: 'ap-south-1', tableName: 'FaceGuardAttendance', credentials },
});
```

**Throws**: `FG_INIT_FAILED` if models cannot be loaded.

---

### `FaceGuard.enrollEmployee(options)`

Enrol a new employee by capturing face embeddings.

```typescript
static async enrollEmployee(options: EnrolOptions): Promise<EnrolResult>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options.name` | `string` | Yes | Employee full name |
| `options.department` | `string` | Yes | Department name |
| `options.employeeId` | `string` | No | External employee ID |
| `options.captureAngles` | `number` | No | Number of face angles to capture (default: `3`) |

**Returns**: `EnrolResult`

```typescript
const result = await FaceGuard.enrollEmployee({
  name: 'Rajesh Kumar',
  department: 'Highway Maintenance',
});
// result.success === true
// result.employee.id === 'uuid-v4'
// result.qualityScore === 0.94
```

---

### `FaceGuard.markAttendance()`

Run the full recognition pipeline and log attendance.

```typescript
static async markAttendance(): Promise<AttendanceResult>
```

**Returns**: `AttendanceResult`

```typescript
const result = await FaceGuard.markAttendance();
if (result.success) {
  console.log(result.employee.name);   // 'Rajesh Kumar'
  console.log(result.confidence);       // 0.94
  console.log(result.livenessScore);    // 0.97
  console.log(result.latencyMs);        // 385
}
```

---

### `FaceGuard.syncNow()`

Manually trigger sync of pending attendance records.

```typescript
static async syncNow(): Promise<SyncSummary>
```

**Returns**: `SyncSummary` — `{ uploaded: number, failed: number, remaining: number }`

---

### `FaceGuard.getQueueSize()`

Get count of records pending sync.

```typescript
static async getQueueSize(): Promise<number>
```

---

### `FaceGuard.onSyncComplete(callback)`

Register a listener for sync completion events.

```typescript
static onSyncComplete(callback: (summary: SyncSummary) => void): Unsubscribe
```

---

## FaceEngine

Core face processing functions. Typically used internally but exported for testing and advanced usage.

### `cosineSimilarity(a, b)`

Compute cosine similarity between two embedding vectors.

```typescript
function cosineSimilarity(a: number[], b: number[]): number
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `a` | `number[]` | First embedding vector |
| `b` | `number[]` | Second embedding vector |

**Returns**: `number` in range `[-1, 1]`. Value of `1.0` = identical, `0.0` = orthogonal, `-1.0` = opposite.

```typescript
const score = cosineSimilarity(embeddingA, embeddingB);
// score === 0.94 → strong match
```

---

### `l2Normalise(vector)`

L2-normalise a vector to unit length.

```typescript
function l2Normalise(vector: number[]): number[]
```

```typescript
l2Normalise([3, 4]);  // → [0.6, 0.8]
```

---

### `matchEmbedding(probe, employees, threshold)`

Find the best-matching employee for a probe embedding.

```typescript
function matchEmbedding(
  probe: number[],
  employees: EmployeeEmbedding[],
  threshold: number,
): MatchResult | null
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `probe` | `number[]` | 128-d probe embedding |
| `employees` | `EmployeeEmbedding[]` | Gallery of enrolled employees |
| `threshold` | `number` | Minimum cosine similarity to accept |

**Returns**: `MatchResult` if best score ≥ threshold, otherwise `null`.

---

### `averageEmbeddings(embeddings)`

Compute element-wise average of multiple embeddings.

```typescript
function averageEmbeddings(embeddings: number[][]): number[]
```

```typescript
averageEmbeddings([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
// → [4, 5, 6]
```

---

### `computeEAR(landmarks)`

Compute Eye Aspect Ratio for blink detection.

```typescript
function computeEAR(landmarks: EyeLandmarks): number
```

**Formula**: `EAR = (‖p2−p6‖ + ‖p3−p5‖) / (2 × ‖p1−p4‖)`

---

### `detectSpoofType(scores)`

Classify spoof type from MiniFASNet output scores.

```typescript
function detectSpoofType(scores: SpoofScores): SpoofType
```

| Input Scores | Result |
|-------------|--------|
| `liveScore > 0.8, depthScore > 0.5` | `'live'` |
| `liveScore < 0.3, depthScore < 0.2` | `'print_attack'` |
| `liveScore < 0.5, moireScore > 0.6` | `'screen_replay'` |
| All other combinations | `'unknown_spoof'` |

---

## BiometricVault

Encrypted SQLite storage for biometric data.

### `constructor(dbPath, hexKey)`

```typescript
new BiometricVault(dbPath: string, hexKey: string)
```

### `initialize()`

Create tables and prepare the database.

```typescript
async initialize(): Promise<void>
```

### `enrollEmployee(data)`

Store encrypted embedding and employee record.

```typescript
async enrollEmployee(data: {
  name: string;
  department: string;
  embedding: number[];
}): Promise<string>  // Returns employee ID
```

### `loadAllEmbeddings()`

Load and decrypt all enrolled embeddings.

```typescript
async loadAllEmbeddings(): Promise<DecryptedEmbedding[]>
```

### `logAttendance(record)`

Insert an attendance record.

```typescript
async logAttendance(record: AttendanceRecord): Promise<void>
```

### `getUnsyncedRecords()`

Get all records with `syncStatus === 'LOCAL'`.

```typescript
async getUnsyncedRecords(): Promise<SyncableRecord[]>
```

### `markSynced(ids)`

Update sync status to `'SYNCED'` for given record IDs.

```typescript
async markSynced(ids: string[]): Promise<void>
```

### `purgeRecords(employeeId)`

Zero sensitive fields while retaining audit trail.

```typescript
async purgeRecords(employeeId: string): Promise<void>
```

---

## SyncManager

Manages offline-to-cloud sync lifecycle.

### `constructor(vault)`

```typescript
new SyncManager(vault: BiometricVault)
```

### `getQueueSize()`

```typescript
async getQueueSize(): Promise<number>
```

### `uploadBatch()`

Upload pending records to DynamoDB.

```typescript
async uploadBatch(): Promise<void>
```

**Throws**: On network failure. Partial failures leave unprocessed records as `LOCAL`.

### `syncAndPurge()`

Upload + verify + purge in correct order.

```typescript
async syncAndPurge(): Promise<void>
```

### `onBackgroundFetch(context)`

Handler for background fetch events.

```typescript
async onBackgroundFetch(context: { isOnline: boolean }): Promise<void>
```

### `registerBackgroundSync()`

Register the background fetch handler with the OS.

```typescript
registerBackgroundSync(): void
```

---

## InAppBenchmark

In-app performance profiler accessible from Admin screen.

### `runFullSuite()`

```typescript
async runFullSuite(): Promise<BenchmarkReport>
```

Runs 20 recognition cycles against 5 test embeddings, measures all pipeline stages.

### `generateCSVReport(report)`

```typescript
generateCSVReport(report: BenchmarkReport): string
```

### `generateTextSummary(report)`

```typescript
generateTextSummary(report: BenchmarkReport): string
```

Returns formatted text optimised for copy-paste into presentations.

---

## Types

```typescript
interface FaceGuardConfig {
  siteCode: string;
  awsConfig: AWSConfig;
  threshold?: number;
  livenessRequired?: boolean;
  autoSync?: boolean;
  syncIntervalMinutes?: number;
}

interface AWSConfig {
  region: string;
  tableName: string;
  credentials: { accessKeyId: string; secretAccessKey: string };
}

interface AttendanceResult {
  success: boolean;
  employee: { id: string; name: string; department: string };
  confidence: number;
  livenessScore: number;
  latencyMs: number;
  reason?: 'no_face' | 'spoof_detected' | 'no_match' | 'below_threshold';
}

interface MatchResult {
  employee: { id: string; name: string };
  score: number;
}

interface BenchmarkReport {
  timestamp: string;
  deviceInfo: DeviceInfo;
  iterations: number;
  stages: Record<string, StageStats>;
  passesTargets: boolean;
  violations: string[];
}

interface StageStats {
  mean: number; min: number; max: number;
  p50: number; p95: number; p99: number;
}

type SpoofType = 'live' | 'print_attack' | 'screen_replay' | 'unknown_spoof';
```

---

## Error Codes

| Code | Description | Recovery |
|------|------------|----------|
| `FG_INIT_FAILED` | SDK initialisation failed (models not found) | Check model files in assets |
| `FG_NO_FACE` | No face detected in camera frame | Reposition subject |
| `FG_SPOOF_DETECTED` | Liveness check failed | Use live face, not photo/screen |
| `FG_NO_MATCH` | No enrolled employee matched | Verify enrolment exists |
| `FG_BELOW_THRESHOLD` | Best match below confidence threshold | Re-enrol or adjust threshold |
| `FG_CAMERA_DENIED` | Camera permission not granted | Request permission |
| `FG_DB_ERROR` | SQLite operation failed | Check disk space |
| `FG_SYNC_FAILED` | Cloud upload failed | Will retry automatically |
| `FG_ENCRYPTION_ERROR` | Encryption/decryption failed | Re-derive key |
