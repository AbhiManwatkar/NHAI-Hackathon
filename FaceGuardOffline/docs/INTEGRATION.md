# 🌐 Datalake 3.0 Integration Guide — FaceGuard Offline

> **Version:** 1.0.0  
> **Last Updated:** May 2026  
> **Status:** Implementation Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Infrastructure Architecture](#infrastructure-architecture)
3. [API Endpoints](#api-endpoints)
4. [Data Schemas](#data-schemas)
5. [Authentication Flow](#authentication-flow)
6. [Batch Upload Protocol](#batch-upload-protocol)
7. [Error Handling & Retry Strategy](#error-handling--retry-strategy)
8. [Network State Machine](#network-state-machine)
9. [Configuration Reference](#configuration-reference)
10. [Monitoring & Observability](#monitoring--observability)

---

## Overview

FaceGuard Offline integrates with NHAI's **Datalake 3.0** — a centralized data infrastructure built on AWS services in the **ap-south-1 (Mumbai)** region. The integration follows an **eventually consistent**, **offline-first** model where authentication events are recorded locally and synchronized to the cloud when network connectivity is available.

### Integration Principles

| Principle | Implementation |
|-----------|---------------|
| **Eventually Consistent** | Local events sync to cloud within minutes of connectivity |
| **Idempotent** | Every operation safe to retry without side effects |
| **Compressed** | GZIP payloads reduce bandwidth usage by ~70% |
| **Authenticated** | AWS SigV4-signed requests with device-specific credentials |
| **Auditable** | Every sync operation logged with correlation IDs |

---

## Infrastructure Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    NHAI Datalake 3.0 (ap-south-1)               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    API Gateway (REST)                     │  │
│  │                                                          │  │
│  │  POST /v1/auth/events/batch    ── Upload auth events     │  │
│  │  POST /v1/enrollments/sync     ── Sync enrollment data   │  │
│  │  GET  /v1/config/device/{id}   ── Fetch device config    │  │
│  │  POST /v1/health/heartbeat     ── Device health report   │  │
│  │  GET  /v1/enrollments/updates  ── Get updated user list  │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                         │
│          ┌────────────┼────────────┬────────────┐              │
│          │            │            │            │              │
│  ┌───────▼────┐ ┌─────▼─────┐ ┌───▼─────┐ ┌───▼──────────┐  │
│  │   Lambda   │ │    S3     │ │DynamoDB │ │  CloudWatch  │  │
│  │  Functions │ │  Buckets  │ │ Tables  │ │  Monitoring  │  │
│  │            │ │           │ │         │ │              │  │
│  │ • Validate │ │ • Photos  │ │ • Auth  │ │ • Metrics    │  │
│  │ • Enrich   │ │ • Models  │ │   Events│ │ • Alarms     │  │
│  │ • Transform│ │ • Backups │ │ • Users │ │ • Dashboards │  │
│  │ • Notify   │ │ • Exports │ │ • Config│ │ • Logs       │  │
│  └────────────┘ └───────────┘ └─────────┘ └──────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    SQS Dead Letter Queue                  │  │
│  │         (Failed events for manual investigation)          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Base URL

```
Production:  https://datalake3.nhai.gov.in/api/v1
Staging:     https://staging-datalake3.nhai.gov.in/api/v1
```

### Endpoint Reference

#### 1. Batch Upload Authentication Events

```
POST /v1/auth/events/batch
```

Uploads a batch of authentication events recorded on-device.

**Request Headers:**
```
Content-Type: application/json
Content-Encoding: gzip
X-Device-ID: {device_uuid}
X-Batch-ID: {batch_uuid}
X-Request-Signature: {hmac_sha256_signature}
X-Client-Version: 1.0.0
Authorization: AWS4-HMAC-SHA256 ...
```

**Request Body (before GZIP):**
```json
{
  "batchId": "batch_uuid_v4",
  "deviceId": "device_uuid_v4",
  "appVersion": "1.0.0",
  "timestamp": "2026-05-28T12:00:00.000Z",
  "events": [
    {
      "eventId": "evt_uuid_v4",
      "type": "RECOGNITION",
      "userId": "NHAI-EMP-001234",
      "result": "SUCCESS",
      "confidence": 0.94,
      "livenessScore": 0.97,
      "livenessMethod": "PASSIVE_AND_ACTIVE",
      "location": {
        "latitude": 28.6139,
        "longitude": 77.2090,
        "accuracy": 10.5,
        "provider": "GPS"
      },
      "deviceMetrics": {
        "batteryLevel": 72,
        "availableMemoryMB": 1024,
        "lightLevel": "ADEQUATE",
        "cameraFacing": "FRONT"
      },
      "processingTimeMs": 342,
      "timestamp": "2026-05-28T11:45:23.456Z"
    }
  ],
  "checksum": "sha256_of_events_array"
}
```

**Response (200 OK):**
```json
{
  "status": "ACCEPTED",
  "batchId": "batch_uuid_v4",
  "accepted": 50,
  "rejected": 0,
  "rejectedEventIds": [],
  "serverTimestamp": "2026-05-28T12:00:01.234Z"
}
```

**Response (207 Partial):**
```json
{
  "status": "PARTIAL",
  "batchId": "batch_uuid_v4",
  "accepted": 48,
  "rejected": 2,
  "rejectedEventIds": [
    { "eventId": "evt_abc", "reason": "DUPLICATE" },
    { "eventId": "evt_def", "reason": "INVALID_SCHEMA" }
  ]
}
```

---

#### 2. Sync Enrollment Data

```
POST /v1/enrollments/sync
```

Uploads new enrollment records to the central database.

**Request Body:**
```json
{
  "deviceId": "device_uuid_v4",
  "enrollments": [
    {
      "enrollmentId": "enr_uuid_v4",
      "userId": "NHAI-EMP-001234",
      "embeddingHash": "sha256_of_encrypted_embedding",
      "enrolledAt": "2026-05-28T10:00:00.000Z",
      "enrolledBy": "NHAI-ADMIN-0042",
      "photoReference": "s3://nhai-faceguard/photos/enr_uuid_v4.enc",
      "qualityScore": 0.92,
      "deviceId": "device_uuid_v4"
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "synced": 1,
  "conflicts": []
}
```

---

#### 3. Fetch Device Configuration

```
GET /v1/config/device/{device_id}
```

Retrieves remote configuration updates for the device.

**Response:**
```json
{
  "deviceId": "device_uuid_v4",
  "config": {
    "recognitionThreshold": 0.65,
    "livenessThreshold": 0.85,
    "syncIntervalMinutes": 15,
    "maxBatchSize": 50,
    "retentionDays": 365,
    "enableActiveChallenge": true,
    "activeChallengeCount": 2,
    "modelVersions": {
      "blazeface": "1.2.0",
      "mobilefacenet": "2.1.0",
      "minifasnet": "1.0.3"
    },
    "syncOnWifiOnly": false,
    "enableGpsLogging": true
  },
  "updatedAt": "2026-05-27T18:00:00.000Z",
  "configVersion": 42
}
```

---

#### 4. Device Heartbeat

```
POST /v1/health/heartbeat
```

Reports device health and status to the central monitoring system.

**Request Body:**
```json
{
  "deviceId": "device_uuid_v4",
  "timestamp": "2026-05-28T12:00:00.000Z",
  "status": "HEALTHY",
  "metrics": {
    "enrollmentCount": 156,
    "pendingSyncEvents": 23,
    "lastSyncTimestamp": "2026-05-28T11:45:00.000Z",
    "storageUsedMB": 48,
    "storageAvailableMB": 2048,
    "appVersion": "1.0.0",
    "osVersion": "Android 14",
    "batteryLevel": 72,
    "uptimeHours": 48.5
  }
}
```

---

#### 5. Get Updated User List

```
GET /v1/enrollments/updates?since={iso_timestamp}&device_id={device_id}
```

Retrieves enrollment updates (new users, deactivated users) since the last sync.

**Response:**
```json
{
  "updates": [
    {
      "userId": "NHAI-EMP-005678",
      "action": "DEACTIVATED",
      "reason": "EMPLOYMENT_ENDED",
      "effectiveAt": "2026-05-27T00:00:00.000Z"
    },
    {
      "userId": "NHAI-EMP-009012",
      "action": "ACTIVATED",
      "enrollmentId": "enr_uuid_v4",
      "effectiveAt": "2026-05-28T08:00:00.000Z"
    }
  ],
  "hasMore": false,
  "nextCursor": null,
  "serverTimestamp": "2026-05-28T12:00:00.000Z"
}
```

---

## Data Schemas

### DynamoDB Table: `nhai-auth-events`

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `eventId` | String (UUID) | PK | Unique event identifier |
| `userId` | String | SK | NHAI employee ID |
| `deviceId` | String | GSI-PK | Source device identifier |
| `timestamp` | String (ISO 8601) | GSI-SK | Event timestamp |
| `type` | String | — | `ENROLLMENT` \| `RECOGNITION` \| `FAILED_ATTEMPT` |
| `result` | String | — | `SUCCESS` \| `FAILED` \| `SPOOF_DETECTED` |
| `confidence` | Number | — | Recognition confidence (0.0–1.0) |
| `livenessScore` | Number | — | Liveness check score (0.0–1.0) |
| `latitude` | Number | — | GPS latitude |
| `longitude` | Number | — | GPS longitude |
| `processingTimeMs` | Number | — | End-to-end processing time |
| `batchId` | String (UUID) | — | Upload batch identifier |
| `syncedAt` | String (ISO 8601) | — | Server receipt timestamp |
| `ttl` | Number | — | DynamoDB TTL (epoch seconds) |

**Global Secondary Indexes:**

| Index Name | PK | SK | Projection |
|-----------|-----|-----|------------|
| `device-time-index` | `deviceId` | `timestamp` | ALL |
| `user-time-index` | `userId` | `timestamp` | ALL |
| `result-index` | `result` | `timestamp` | KEYS_ONLY |

### S3 Bucket: `nhai-faceguard-sync`

```
nhai-faceguard-sync/
├── photos/
│   └── {enrollment_id}.enc           # Encrypted enrollment photos
├── models/
│   ├── blazeface/v1.2.0/model.tflite # Model artifacts
│   ├── mobilefacenet/v2.1.0/model.tflite
│   └── minifasnet/v1.0.3/model.tflite
├── exports/
│   └── {date}/audit-report.csv       # Daily audit exports
└── backups/
    └── {date}/device-{id}.json       # Device state backups
```

---

## Authentication Flow

### Device Registration (First-Time Setup)

```
┌──────────┐                    ┌──────────────┐                ┌───────────┐
│  Device  │                    │  API Gateway │                │  Cognito  │
│          │                    │              │                │           │
│  1. Generate device keypair   │              │                │           │
│     (RSA-2048)                │              │                │           │
│          │                    │              │                │           │
│  2. POST /v1/devices/register │              │                │           │
│  ───────────────────────────► │              │                │           │
│  { deviceId, publicKey,       │  3. Validate │                │           │
│    adminToken }               │  ──────────► │                │           │
│          │                    │              │  4. Create     │           │
│          │                    │              │  device pool   │           │
│          │                    │              │  ◄──────────── │           │
│          │                    │  5. Return   │                │           │
│  ◄─────────────────────────── │  credentials │                │           │
│  { accessKeyId,               │              │                │           │
│    secretAccessKey,           │              │                │           │
│    sessionPolicy }            │              │                │           │
│          │                    │              │                │           │
│  6. Store credentials in      │              │                │           │
│     Android Keystore          │              │                │           │
└──────────┘                    └──────────────┘                └───────────┘
```

### Request Signing (Every API Call)

```
1. Construct canonical request:
   ├── HTTP method
   ├── URI path
   ├── Query string (sorted)
   ├── Signed headers (host, x-amz-date, content-type)
   └── SHA256 hash of payload

2. Create string to sign:
   ├── Algorithm: AWS4-HMAC-SHA256
   ├── Timestamp: ISO 8601
   ├── Credential scope: date/region/service/aws4_request
   └── SHA256 of canonical request

3. Calculate signature:
   ├── kDate = HMAC-SHA256(secretKey, date)
   ├── kRegion = HMAC-SHA256(kDate, region)
   ├── kService = HMAC-SHA256(kRegion, service)
   ├── kSigning = HMAC-SHA256(kService, "aws4_request")
   └── signature = HMAC-SHA256(kSigning, stringToSign)

4. Add Authorization header:
   Authorization: AWS4-HMAC-SHA256
     Credential={accessKeyId}/{scope},
     SignedHeaders={headers},
     Signature={signature}
```

### Credential Refresh

| Scenario | Action |
|----------|--------|
| Credentials expire (24h) | Auto-refresh via Cognito token exchange |
| Device offline when expiry | Use cached credentials, sync on reconnect |
| Credentials revoked | Device enters "unregistered" state, requires admin re-registration |

---

## Batch Upload Protocol

### Upload Sequence

```
┌──────────┐                              ┌──────────────┐
│  Device  │                              │  Datalake    │
│          │                              │              │
│  1. Collect events from local queue     │              │
│     (max 50 per batch)                  │              │
│          │                              │              │
│  2. Generate batch UUID                 │              │
│          │                              │              │
│  3. Compute SHA256 checksum             │              │
│     of event array                      │              │
│          │                              │              │
│  4. Serialize to JSON                   │              │
│          │                              │              │
│  5. GZIP compress payload               │              │
│     (~70% size reduction)               │              │
│          │                              │              │
│  6. Sign request (AWS SigV4)            │              │
│          │                              │              │
│  7. POST /v1/auth/events/batch          │              │
│  ──────────────────────────────────────►│              │
│          │                              │  8. Decompress│
│          │                              │  9. Validate  │
│          │                              │     schema    │
│          │                              │  10. Check    │
│          │                              │     checksum  │
│          │                              │  11. Dedupe   │
│          │                              │     by eventId│
│          │                              │  12. Write to │
│          │                              │     DynamoDB  │
│          │                              │              │
│  ◄──────────────────────────────────────│  13. Return  │
│  { status: "ACCEPTED", accepted: 50 }  │     response │
│          │                              │              │
│  14. Mark events as synced              │              │
│      in local queue                     │              │
│          │                              │              │
│  15. Remove synced events               │              │
│      from queue after                   │              │
│      confirmation                       │              │
└──────────┘                              └──────────────┘
```

### Batch Configuration

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `maxBatchSize` | 50 | 1–200 | Maximum events per batch |
| `batchTimeoutMs` | 30000 | 5000–60000 | HTTP request timeout |
| `compressionLevel` | 6 | 1–9 | GZIP compression level |
| `maxPayloadSizeKB` | 512 | 64–1024 | Maximum compressed payload |
| `syncIntervalMin` | 15 | 5–60 | Background sync interval |
| `wifiOnlySync` | false | — | Restrict sync to WiFi only |

### Idempotency Protocol

Every event has a client-generated **UUID v4** (`eventId`). The server uses this for deduplication:

```
Client sends: eventId = "abc-123"
  │
  Server checks DynamoDB:
  │
  ├── Not found → Insert → Return ACCEPTED
  │
  └── Found → Skip → Return ACCEPTED (idempotent)
                       (event already recorded)
```

This ensures that retried uploads never create duplicate records.

---

## Error Handling & Retry Strategy

### HTTP Status Code Handling

| Status | Meaning | Client Action |
|--------|---------|---------------|
| `200` | Success | Mark batch as synced |
| `207` | Partial success | Re-queue rejected events only |
| `400` | Bad request | Log error, do NOT retry (fix required) |
| `401` | Unauthorized | Refresh credentials, then retry |
| `403` | Forbidden | Device may be revoked, enter safe mode |
| `408` | Request timeout | Retry with backoff |
| `429` | Rate limited | Retry after `Retry-After` header value |
| `500` | Server error | Retry with backoff |
| `502` | Bad gateway | Retry with backoff |
| `503` | Service unavailable | Retry with backoff |

### Exponential Backoff Strategy

```
Retry 1: 1 second  ± 200ms jitter
Retry 2: 2 seconds ± 400ms jitter
Retry 3: 4 seconds ± 800ms jitter
Retry 4: 8 seconds ± 1600ms jitter
Retry 5: 16 seconds ± 3200ms jitter
────────────────────────────────────
Max retries reached → Dead Letter Queue
```

```typescript
/**
 * Calculate retry delay with jitter.
 * @param attempt - Current retry attempt (0-indexed)
 * @returns Delay in milliseconds
 */
function calculateRetryDelay(attempt: number): number {
  const baseDelay = Math.pow(2, attempt) * 1000; // Exponential: 1s, 2s, 4s, 8s, 16s
  const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1); // ±20% jitter
  return Math.min(baseDelay + jitter, 32000); // Cap at 32 seconds
}
```

### Circuit Breaker Pattern

```
                    ┌─────────────┐
         Success   │             │  Failure count
        ┌──────────│   CLOSED    │──────────────┐
        │          │ (Normal Op) │              │
        │          └─────────────┘              │
        │                                       │
        │                              Threshold│(3 failures)
        │                                       │
        │          ┌─────────────┐              │
        │          │             │◄─────────────┘
        │          │    OPEN     │
        │          │(All Blocked)│
        │          └──────┬──────┘
        │                 │
        │          Timeout│(60 seconds)
        │                 │
        │          ┌──────▼──────┐
        │          │             │
        └──────────│  HALF-OPEN  │
                   │(One Request)│──── Failure ──► OPEN
                   └─────────────┘
```

### Dead Letter Queue (DLQ)

Events that exceed maximum retry attempts are moved to a local DLQ:

```
sync_dead_letter_queue table:
├── eventId (UUID)
├── originalPayload (encrypted JSON)
├── failureReason (last error message)
├── failureCount (total attempts)
├── firstFailedAt (ISO timestamp)
├── lastFailedAt (ISO timestamp)
└── status: PENDING_REVIEW | MANUALLY_RETRIED | EXPIRED
```

DLQ events are:
- Retained locally for 30 days
- Included in device heartbeat metrics
- Manually retryable via Settings screen
- Auto-expired after retention period

---

## Network State Machine

```
┌──────────────────────────────────────────────────────────────────┐
│                    NETWORK STATE MACHINE                         │
│                                                                  │
│                                                                  │
│    ┌──────────────┐                                             │
│    │   OFFLINE    │◄────────── NetInfo: No connection           │
│    │              │                                             │
│    │ • Queue all  │                                             │
│    │   events     │                                             │
│    │ • No sync    │                                             │
│    │ • Local only │                                             │
│    └──────┬───────┘                                             │
│           │                                                      │
│           │ NetInfo: Connection detected                         │
│           │                                                      │
│    ┌──────▼───────┐                                             │
│    │  PROBING     │                                             │
│    │              │                                             │
│    │ • Ping API   │                                             │
│    │   endpoint   │                                             │
│    │ • Check      │                                             │
│    │   latency    │                                             │
│    │ • Verify     │                                             │
│    │   auth       │                                             │
│    └──────┬───────┘                                             │
│           │                                                      │
│      ┌────┼──────────────┐                                      │
│      │ Success          │ Failure                               │
│      ▼                  ▼                                       │
│ ┌──────────┐     ┌──────────┐                                  │
│ │  ONLINE  │     │ CAPTIVE  │                                  │
│ │          │     │ PORTAL   │                                  │
│ │ • Sync   │     │          │                                  │
│ │   enabled│     │ • Treat  │                                  │
│ │ • Batch  │     │   as     │                                  │
│ │   upload │     │   offline│                                  │
│ │ • Config │     │ • Show   │                                  │
│ │   fetch  │     │   warning│                                  │
│ └────┬─────┘     └──────────┘                                  │
│      │                                                          │
│      │ Sync in progress                                         │
│      │                                                          │
│ ┌────▼─────┐                                                    │
│ │ SYNCING  │                                                    │
│ │          │                                                    │
│ │ • Upload │──── Failure ──► BACKOFF ──── Retry ──► SYNCING    │
│ │   batch  │                   │                                │
│ │ • Track  │                   │ Max retries                    │
│ │   progress│                  ▼                                │
│ └────┬─────┘            CIRCUIT_OPEN                           │
│      │                       │                                  │
│      │ Complete              │ Timeout (60s)                    │
│      ▼                       ▼                                  │
│ ┌──────────┐          HALF_OPEN ──── Success ──► ONLINE        │
│ │ COOLDOWN │                                                    │
│ │          │                                                    │
│ │ • Wait   │                                                    │
│ │   15 min │                                                    │
│ │ • Or     │                                                    │
│ │   manual │                                                    │
│ │   trigger│                                                    │
│ └────┬─────┘                                                    │
│      │                                                          │
│      │ Timer / Manual                                           │
│      ▼                                                          │
│   (Back to ONLINE → check queue → SYNCING if events)           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### State Transitions

| Current State | Event | Next State | Action |
|--------------|-------|------------|--------|
| OFFLINE | Network detected | PROBING | Ping API endpoint |
| PROBING | Ping success | ONLINE | Enable sync |
| PROBING | Ping failure | CAPTIVE_PORTAL | Show warning |
| ONLINE | Queue has events | SYNCING | Start batch upload |
| ONLINE | Network lost | OFFLINE | Pause all sync |
| SYNCING | Batch accepted | COOLDOWN | Remove from queue |
| SYNCING | Request failure | BACKOFF | Calculate retry delay |
| BACKOFF | Retry timer fires | SYNCING | Retry upload |
| BACKOFF | Max retries hit | CIRCUIT_OPEN | Stop trying |
| CIRCUIT_OPEN | 60s timeout | HALF_OPEN | Try single request |
| HALF_OPEN | Success | ONLINE | Resume normal sync |
| HALF_OPEN | Failure | CIRCUIT_OPEN | Reset timeout |
| COOLDOWN | 15min timer | ONLINE | Check queue again |

---

## Configuration Reference

### Environment Variables

```bash
# Datalake Connection
DATALAKE_ENDPOINT=https://datalake3.nhai.gov.in/api/v1
DATALAKE_REGION=ap-south-1

# AWS Resources
S3_BUCKET=nhai-faceguard-sync
DYNAMO_TABLE=nhai-auth-events
COGNITO_POOL_ID=ap-south-1_XXXXXXXXX
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx

# Sync Configuration
SYNC_INTERVAL_MINUTES=15
MAX_BATCH_SIZE=50
MAX_RETRY_ATTEMPTS=5
CIRCUIT_BREAKER_THRESHOLD=3
CIRCUIT_BREAKER_TIMEOUT_MS=60000

# Network Configuration
PROBE_ENDPOINT=https://datalake3.nhai.gov.in/health
PROBE_TIMEOUT_MS=5000
WIFI_ONLY_SYNC=false
MAX_PAYLOAD_SIZE_KB=512
```

### Remote Configuration (Server-Managed)

The device fetches configuration from `/v1/config/device/{id}` on every successful sync. Remote config values override local defaults:

```typescript
interface RemoteConfig {
  /** Recognition confidence threshold (0.0–1.0) */
  recognitionThreshold: number;

  /** Liveness detection threshold (0.0–1.0) */
  livenessThreshold: number;

  /** Minutes between sync attempts */
  syncIntervalMinutes: number;

  /** Maximum events per upload batch */
  maxBatchSize: number;

  /** Days before local data is purged */
  retentionDays: number;

  /** Whether active liveness challenges are required */
  enableActiveChallenge: boolean;

  /** Number of active challenges per session */
  activeChallengeCount: number;

  /** Latest model versions for OTA updates */
  modelVersions: Record<string, string>;

  /** Restrict sync to WiFi connections only */
  syncOnWifiOnly: boolean;

  /** Enable GPS coordinate logging */
  enableGpsLogging: boolean;
}
```

---

## Monitoring & Observability

### Device-Side Metrics (Included in Heartbeat)

| Metric | Type | Description |
|--------|------|-------------|
| `pendingSyncEvents` | Gauge | Events waiting to be synced |
| `syncSuccessCount` | Counter | Successful sync operations |
| `syncFailureCount` | Counter | Failed sync operations |
| `averageSyncLatencyMs` | Gauge | Average upload round-trip time |
| `dlqSize` | Gauge | Events in dead letter queue |
| `lastSyncTimestamp` | Timestamp | When last successful sync occurred |
| `enrollmentCount` | Gauge | Total enrolled users on device |
| `storageUsedMB` | Gauge | Storage used by FaceGuard |
| `authSuccessRate` | Percentage | Recent authentication success rate |
| `circuitBreakerState` | Enum | Current circuit breaker state |

### Server-Side Monitoring (CloudWatch)

```
CloudWatch Dashboards:
├── FaceGuard Fleet Overview
│   ├── Total active devices
│   ├── Events received per hour
│   ├── Average sync latency
│   └── Error rate by device
│
├── Sync Performance
│   ├── Batch upload success rate
│   ├── P50/P95/P99 upload latency
│   ├── DynamoDB write throughput
│   └── S3 upload throughput
│
└── Alerts
    ├── Device offline > 24 hours
    ├── Sync failure rate > 10%
    ├── DLQ size > 100 events
    └── API Gateway 5xx rate > 1%
```

---

> 📝 **Note:** All endpoints and schemas are subject to change during development. Refer to the API Gateway Swagger documentation for the latest specifications.
