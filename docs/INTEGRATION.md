# Integration Guide

> How to add FaceGuard Offline biometric authentication to any React Native application.

---

## Prerequisites

| Requirement | Minimum |
|-------------|---------|
| React Native | 0.73+ |
| Node.js | 18+ |
| iOS deployment target | 13.0 |
| Android minSdkVersion | 24 (Android 7.0) |
| Android compileSdkVersion | 34 |
| Physical device | Required (camera access) |

---

## Step 1: Install the Module

```bash
npm install @faceguard/react-native-biometric
```

### iOS: Install native pods

```bash
cd ios && pod install && cd ..
```

### Android: Add TFLite dependency

Add to `android/app/build.gradle`:

```gradle
dependencies {
    // FaceGuard TFLite models
    implementation 'org.tensorflow:tensorflow-lite:2.14.0'
    implementation 'org.tensorflow:tensorflow-lite-gpu:2.14.0'
}

android {
    aaptOptions {
        noCompress "tflite"  // Prevent compression of model files
    }
}
```

---

## Step 2: Initialize FaceGuard

Add to your `App.tsx` or application entry point:

```typescript
import { FaceGuard } from '@faceguard/react-native-biometric';

const awsConfig = {
  region: 'ap-south-1',
  tableName: 'FaceGuardAttendance',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
};

// Initialize once at app startup
await FaceGuard.initialize({
  siteCode: 'NH_001',         // Unique site identifier
  awsConfig,                   // AWS DynamoDB configuration
  threshold: 0.65,             // Cosine similarity threshold (default: 0.65)
  livenessRequired: true,      // Enforce anti-spoofing (default: true)
  autoSync: true,              // Enable background sync (default: true)
  syncIntervalMinutes: 15,     // Background fetch interval (default: 15)
});
```

---

## Step 3: Enrol Employees

```typescript
import { FaceGuard } from '@faceguard/react-native-biometric';

// Capture 3 face angles and enrol
const enrolResult = await FaceGuard.enrollEmployee({
  name: 'Rajesh Kumar',
  department: 'Highway Maintenance',
  employeeId: 'EMP-2024-0042',     // Your internal ID
  captureAngles: 3,                 // Frontal + left + right
});

if (enrolResult.success) {
  console.log(`Enrolled: ${enrolResult.employee.name}`);
  console.log(`Embedding quality: ${enrolResult.qualityScore}`);
}
```

---

## Step 4: Mark Attendance

```typescript
const result = await FaceGuard.markAttendance();

if (result.success) {
  showSuccess(result.employee.name);
  console.log(`Confidence: ${result.confidence}`);
  console.log(`Liveness: ${result.livenessScore}`);
  console.log(`Matched in: ${result.latencyMs}ms`);
} else {
  // result.reason: 'no_face' | 'spoof_detected' | 'no_match' | 'below_threshold'
  showError(result.reason);
}
```

---

## Step 5: Handle Sync

Sync is automatic when `autoSync: true`, but you can also control it manually:

```typescript
// Listen for sync events
FaceGuard.onSyncComplete((summary) => {
  console.log(`Synced ${summary.uploaded} records`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Remaining: ${summary.remaining}`);
});

// Manual sync trigger
await FaceGuard.syncNow();

// Check queue status
const queueSize = await FaceGuard.getQueueSize();
console.log(`${queueSize} records pending sync`);
```

---

## Datalake 3.0 Integration

FaceGuard is designed as a drop-in biometric module for the NHAI Datalake 3.0 platform. The DynamoDB table schema aligns with the Datalake ingestion format:

```typescript
// DynamoDB record format (auto-generated)
{
  recordId: 'uuid-v4',
  siteCode: 'NH_001',
  employeeId: 'EMP-2024-0042',
  timestamp: '2026-06-03T09:00:00Z',
  type: 'CHECK_IN',           // CHECK_IN | CHECK_OUT
  confidence: 0.94,
  livenessScore: 0.97,
  deviceId: 'device-uuid',
  appVersion: '1.0.0',
}
```

### Connecting to Existing Datalake Pipeline

```typescript
// In your Datalake connector service
import { FaceGuard } from '@faceguard/react-native-biometric';

// FaceGuard writes directly to the DynamoDB table
// that your existing Datalake Lambda functions consume.
// No adapter code required — schema matches natively.

await FaceGuard.initialize({
  siteCode: 'NH_044',
  awsConfig: datalakeConfig,   // Same credentials as Datalake 3.0
});
```

---

## Configuration Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `siteCode` | `string` | Required | Unique NHAI site identifier |
| `awsConfig` | `AWSConfig` | Required | DynamoDB connection config |
| `threshold` | `number` | `0.65` | Cosine similarity match threshold |
| `livenessRequired` | `boolean` | `true` | Enforce MiniFASNet liveness check |
| `autoSync` | `boolean` | `true` | Enable automatic background sync |
| `syncIntervalMinutes` | `number` | `15` | Background fetch interval |
| `maxBatchSize` | `number` | `25` | DynamoDB BatchWrite item limit |
| `encryptionIterations` | `number` | `100000` | PBKDF2 iteration count |
| `purgeAfterSync` | `boolean` | `true` | Auto-purge embeddings post-sync |

---

## Platform-Specific Setup

### Android

1. Camera permission in `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="true" />
```

2. TFLite GPU delegate (optional, for faster inference):

```gradle
implementation 'org.tensorflow:tensorflow-lite-gpu:2.14.0'
```

### iOS

1. Camera usage description in `Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>FaceGuard requires camera access for biometric attendance</string>
```

2. Background fetch capability in Xcode:
   - Signing & Capabilities → + Background Modes → ✓ Background fetch

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Model not found` | Ensure `.tflite` files are in `android/app/src/main/assets/` and iOS bundle |
| `Camera black screen` | Physical device required; check camera permissions |
| `Sync fails silently` | Verify AWS credentials and DynamoDB table exists |
| `Low match confidence` | Ensure good lighting during enrolment; re-enrol if < 0.7 quality |
| `High false rejection` | Lower threshold from 0.65 to 0.60 (trades FAR for FRR) |
