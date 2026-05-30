# 🔒 Security Documentation — FaceGuard Offline

> **Version:** 1.0.0  
> **Last Updated:** May 2026  
> **Classification:** Internal — NHAI Hackathon Team  
> **Review Status:** Initial Draft

---

## Table of Contents

1. [Security Overview](#security-overview)
2. [Threat Model](#threat-model)
3. [Encryption at Rest](#encryption-at-rest)
4. [Biometric Data Protection](#biometric-data-protection)
5. [Key Management](#key-management)
6. [Anti-Spoofing Measures](#anti-spoofing-measures)
7. [Data in Transit](#data-in-transit)
8. [Application Security](#application-security)
9. [Data Retention Policies](#data-retention-policies)
10. [Compliance Considerations](#compliance-considerations)
11. [Incident Response](#incident-response)
12. [Security Audit Checklist](#security-audit-checklist)

---

## Security Overview

FaceGuard Offline processes and stores **sensitive biometric data** (facial embeddings) on mobile devices deployed to field personnel. The security architecture follows a **defense-in-depth** strategy with multiple overlapping protection layers.

### Security Principles

| Principle | Implementation |
|-----------|---------------|
| **Zero Trust** | Every operation verified, no implicit trust |
| **Least Privilege** | Minimum permissions requested and used |
| **Defense in Depth** | Multiple independent security layers |
| **Secure by Default** | All security features enabled out of the box |
| **Data Minimization** | Only essential biometric data stored |
| **Fail Secure** | System denies access on any security failure |

### Security Architecture Layers

```
┌────────────────────────────────────────────────────────────┐
│  Layer 7: APPLICATION INTEGRITY                            │
│  • Code signing verification                               │
│  • Root/jailbreak detection                                │
│  • Debugger detection                                      │
│  • Tamper detection                                        │
├────────────────────────────────────────────────────────────┤
│  Layer 6: ANTI-SPOOFING                                    │
│  • Passive liveness (texture analysis)                     │
│  • Active liveness (challenge-response)                    │
│  • Temporal consistency checks                              │
│  • Multi-frame validation                                  │
├────────────────────────────────────────────────────────────┤
│  Layer 5: ACCESS CONTROL                                   │
│  • Biometric gate for app access                           │
│  • Session management                                      │
│  • Admin enrollment authorization                          │
│  • Role-based feature access                               │
├────────────────────────────────────────────────────────────┤
│  Layer 4: DATA ENCRYPTION (AT REST)                        │
│  • AES-256-GCM for biometric embeddings                    │
│  • SQLCipher for database encryption                       │
│  • Encrypted SharedPreferences                             │
│  • Secure file storage                                     │
├────────────────────────────────────────────────────────────┤
│  Layer 3: KEY MANAGEMENT                                   │
│  • Android Keystore / iOS Keychain                         │
│  • Hardware-backed key storage                             │
│  • Non-extractable master keys                             │
│  • Key rotation policies                                   │
├────────────────────────────────────────────────────────────┤
│  Layer 2: DATA IN TRANSIT                                  │
│  • TLS 1.3 for all network communication                   │
│  • Certificate pinning                                     │
│  • AWS SigV4 request signing                               │
│  • Payload integrity (SHA256 checksums)                    │
├────────────────────────────────────────────────────────────┤
│  Layer 1: PLATFORM SECURITY                                │
│  • Android/iOS sandboxing                                  │
│  • Secure enclave integration                              │
│  • OS-level encryption                                     │
│  • Permission model enforcement                            │
└────────────────────────────────────────────────────────────┘
```

---

## Threat Model

### Threat Actors

| Actor | Motivation | Capability | Risk Level |
|-------|-----------|-----------|------------|
| **Insider (Field Worker)** | Bypass authentication for unauthorized access | Physical access to device, basic tech skills | 🟡 Medium |
| **Outsider (Impersonator)** | Gain facility/equipment access | Printed photos, screen replay, social engineering | 🔴 High |
| **Sophisticated Attacker** | Steal biometric data, create deepfakes | 3D masks, rooted devices, reverse engineering | 🔴 High |
| **Lost/Stolen Device** | Access stored biometric data | Physical possession of unlocked device | 🟡 Medium |
| **Man-in-the-Middle** | Intercept sync data during upload | Network interception tools, rogue WiFi | 🟡 Medium |
| **Malicious App** | Extract data from FaceGuard storage | Side-loaded app on same device | 🟢 Low |

### Threat Matrix (STRIDE)

| Threat | Category | Attack Vector | Mitigation | Severity |
|--------|----------|--------------|------------|----------|
| T1 | **Spoofing** | Printed photo presented to camera | Passive liveness + active challenges | 🔴 Critical |
| T2 | **Spoofing** | Video replay on screen | Moiré pattern detection + motion analysis | 🔴 Critical |
| T3 | **Spoofing** | 3D printed/silicone mask | Texture analysis + IR detection (future) | 🟡 High |
| T4 | **Tampering** | Modified app binary | Code signing + integrity checks | 🟡 High |
| T5 | **Tampering** | Rooted device modifying DB | Root detection + encrypted storage | 🟡 High |
| T6 | **Repudiation** | User denies authentication | Signed audit logs with GPS + timestamp | 🟡 Medium |
| T7 | **Info Disclosure** | Embedding extraction from storage | AES-256-GCM encryption at rest | 🔴 Critical |
| T8 | **Info Disclosure** | Network sniffing during sync | TLS 1.3 + certificate pinning | 🟡 High |
| T9 | **Denial of Service** | Camera blocked or obscured | Quality checks + user guidance | 🟢 Low |
| T10 | **Elevation** | Admin functions accessed by user | Role-based access + admin PIN | 🟡 Medium |

### Attack Tree

```
Goal: Bypass FaceGuard Authentication
│
├── 1. Defeat Liveness Detection
│   ├── 1.1 Print Attack ──► MITIGATED by passive texture analysis
│   ├── 1.2 Screen Replay ──► MITIGATED by moiré detection + blink challenge
│   ├── 1.3 3D Mask ──► PARTIALLY MITIGATED by texture + active challenge
│   └── 1.4 Deepfake Video ──► MITIGATED by active challenge randomization
│
├── 2. Extract Biometric Data
│   ├── 2.1 Read SQLite DB ──► MITIGATED by SQLCipher encryption
│   ├── 2.2 Extract from memory ──► MITIGATED by secure memory handling
│   ├── 2.3 Intercept network sync ──► MITIGATED by TLS 1.3 + cert pinning
│   └── 2.4 Reverse engineer app ──► MITIGATED by ProGuard + integrity checks
│
├── 3. Tamper with Authentication
│   ├── 3.1 Modify app code ──► MITIGATED by code signing + tamper detection
│   ├── 3.2 Root device + hooks ──► MITIGATED by root detection
│   ├── 3.3 Replay auth token ──► MITIGATED by timestamp + nonce validation
│   └── 3.4 Modify audit logs ──► MITIGATED by signed + append-only logs
│
└── 4. Social Engineering
    ├── 4.1 Coerce authorized user ──► POLICY: duress detection (future)
    └── 4.2 Unauthorized enrollment ──► MITIGATED by admin-only enrollment
```

---

## Encryption at Rest

### AES-256-GCM Implementation

All biometric data is encrypted using **AES-256-GCM** (Galois/Counter Mode), providing both confidentiality and integrity.

```
┌─────────────────────────────────────────────────────┐
│                ENCRYPTION PIPELINE                   │
│                                                     │
│  Plaintext Embedding (128 floats × 4 bytes = 512B)  │
│              │                                       │
│              ▼                                       │
│  ┌───────────────────────┐                          │
│  │  Generate Random IV   │  12 bytes (96 bits)      │
│  │  (per encryption)     │  CSPRNG                  │
│  └───────────┬───────────┘                          │
│              │                                       │
│              ▼                                       │
│  ┌───────────────────────┐                          │
│  │  Derive Data Key      │  HKDF-SHA256             │
│  │  from Master Key      │  Salt: device-specific   │
│  │                       │  Info: "embedding-enc"   │
│  └───────────┬───────────┘                          │
│              │                                       │
│              ▼                                       │
│  ┌───────────────────────┐                          │
│  │  AES-256-GCM Encrypt  │                          │
│  │                       │                          │
│  │  Key:  256-bit derived│                          │
│  │  IV:   96-bit random  │                          │
│  │  AAD:  userId + ts    │  (Additional Auth Data)  │
│  │  Tag:  128-bit        │  (Authentication Tag)    │
│  └───────────┬───────────┘                          │
│              │                                       │
│              ▼                                       │
│  ┌───────────────────────────────────────────────┐  │
│  │  Stored Format:                                │  │
│  │  [ IV (12B) | Ciphertext (512B) | Tag (16B) ] │  │
│  │  Total: 540 bytes per embedding                │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Database Encryption (SQLCipher)

The SQLite database is encrypted using **SQLCipher** with the following configuration:

```sql
-- SQLCipher Configuration
PRAGMA cipher = 'aes-256-gcm';
PRAGMA kdf_iter = 256000;                -- 256K PBKDF2 iterations
PRAGMA cipher_page_size = 4096;          -- 4KB page size
PRAGMA cipher_use_hmac = ON;             -- HMAC page verification
PRAGMA cipher_plaintext_header_size = 0; -- No plaintext header
PRAGMA cipher_salt = X'...';            -- Random salt per database
```

### Encrypted Fields

| Table | Field | Encryption | Notes |
|-------|-------|-----------|-------|
| `enrollments` | `embedding` | AES-256-GCM | 128-float vector → 540 bytes |
| `enrollments` | `photo_thumbnail` | AES-256-GCM | Optional reference photo |
| `auth_events` | `embedding_snapshot` | AES-256-GCM | Temporary, auto-deleted |
| `app_config` | `api_credentials` | AES-256-GCM | Sync authentication keys |

### Secure Memory Handling

```typescript
/**
 * Security practices for in-memory biometric data:
 *
 * 1. Embeddings are decrypted only during comparison
 * 2. Decrypted data is zeroed immediately after use
 * 3. No biometric data in JavaScript heap (native processing only)
 * 4. Frame buffers overwritten on deallocation
 * 5. No biometric data in logs or crash reports
 */
```

---

## Biometric Data Protection

### Data Lifecycle

```
┌────────────────────────────────────────────────────────┐
│              BIOMETRIC DATA LIFECYCLE                    │
│                                                        │
│  CAPTURE                                               │
│  ├── Camera frame captured                             │
│  ├── Face detected and cropped                         │
│  ├── Frame buffer: overwritten after processing        │
│  └── Original photo: NEVER stored (embeddings only)    │
│                                                        │
│  PROCESSING                                            │
│  ├── Face alignment on native thread                   │
│  ├── ML inference produces 128-float embedding         │
│  ├── Embedding exists in memory for <100ms             │
│  └── Intermediate tensors: freed after inference       │
│                                                        │
│  STORAGE                                               │
│  ├── Embedding encrypted with AES-256-GCM              │
│  ├── Encrypted blob stored in SQLCipher DB             │
│  ├── Encryption key: hardware-backed, non-extractable  │
│  └── No cloud storage of raw embeddings                │
│                                                        │
│  COMPARISON                                            │
│  ├── Candidate embeddings decrypted in-memory          │
│  ├── Cosine similarity computed                        │
│  ├── Decrypted embeddings zeroed after comparison      │
│  └── Only match result + score leaves secure boundary  │
│                                                        │
│  DELETION                                              │
│  ├── Automatic expiry after retention period           │
│  ├── Cryptographic erasure (delete encryption key)     │
│  ├── SQLite VACUUM to reclaim space                    │
│  └── Secure overwrite of freed pages                   │
│                                                        │
│  SYNC (metadata only)                                  │
│  ├── Only embedding HASH synced (not embedding itself) │
│  ├── Auth events synced (result, score, location)      │
│  └── No biometric payload leaves device                │
└────────────────────────────────────────────────────────┘
```

### What is NOT Stored

| Data Type | Stored? | Rationale |
|-----------|---------|-----------|
| Raw face photos | ❌ Never | Only processed embeddings are needed |
| Camera frames | ❌ Never | Overwritten in ring buffer |
| Intermediate tensors | ❌ Never | Freed after each inference |
| Embedding plaintext | ❌ At rest | Always encrypted, decrypted only for comparison |
| Recognition model weights | ✅ Read-only | Required for inference, not sensitive |

### Biometric Template Protection

Even if an attacker extracts encrypted embeddings and somehow decrypts them, the 128-dimensional embedding vector **cannot be reversed** to reconstruct the original face image. This is a fundamental property of the deep learning embedding space:

```
Face Image ──► MobileFaceNet ──► 128-d Embedding
                                      │
                                      ✗ Cannot reverse
                                      │
                              Original face NOT recoverable
```

---

## Key Management

### Key Hierarchy

```
┌────────────────────────────────────────────────────────────┐
│                    KEY HIERARCHY                            │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  MASTER KEY (Hardware-Backed)                         │ │
│  │  • Generated on first app launch                      │ │
│  │  • Stored in Android Keystore / iOS Secure Enclave    │ │
│  │  • Non-extractable, non-exportable                    │ │
│  │  • Requires device unlock to access                   │ │
│  │  • RSA-2048 or ECDSA P-256                           │ │
│  └────────────────────┬─────────────────────────────────┘ │
│                       │                                    │
│           ┌───────────┼───────────────┐                   │
│           │           │               │                   │
│  ┌────────▼────────┐ ┌▼────────────┐ ┌▼──────────────┐  │
│  │ EMBEDDING KEY   │ │ DATABASE KEY│ │ SYNC AUTH KEY │  │
│  │                 │ │             │ │               │  │
│  │ Derived via     │ │ Derived via │ │ Derived via   │  │
│  │ HKDF-SHA256     │ │ HKDF-SHA256│ │ HKDF-SHA256   │  │
│  │                 │ │             │ │               │  │
│  │ Purpose:        │ │ Purpose:   │ │ Purpose:      │  │
│  │ Encrypt/decrypt │ │ SQLCipher  │ │ Sign API      │  │
│  │ embeddings      │ │ passphrase │ │ requests      │  │
│  │                 │ │             │ │               │  │
│  │ Rotation: 90d   │ │ Rotation:  │ │ Rotation:     │  │
│  │                 │ │ On re-key  │ │ 24h (session)  │  │
│  └─────────────────┘ └─────────────┘ └───────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Android Keystore Configuration

```typescript
/**
 * Android Keystore key generation parameters:
 */
const keystoreConfig = {
  alias: 'faceguard_master_key',
  algorithm: 'AES',
  keySize: 256,
  purposes: ['ENCRYPT', 'DECRYPT'],
  blockModes: ['GCM'],
  encryptionPaddings: ['NoPadding'],
  isStrongBoxBacked: true,      // Hardware security module (if available)
  userAuthenticationRequired: false, // App manages its own auth
  randomizedEncryptionRequired: true,
  keyValidityStart: new Date(),
  keyValidityForOriginationEnd: null, // No expiry
};
```

### Key Rotation Protocol

| Key Type | Rotation Period | Trigger | Process |
|----------|----------------|---------|---------|
| Master Key | Never (device lifetime) | Device wipe only | N/A |
| Embedding Key | 90 days | Timer or admin trigger | Re-encrypt all embeddings with new derived key |
| Database Key | On demand | Admin trigger | SQLCipher rekey operation |
| Sync Auth Key | 24 hours | Session expiry | Refresh via Cognito token exchange |

### Key Rotation Procedure

```
Key Rotation for Embedding Key:
1. Generate new salt for HKDF derivation
2. Derive new embedding key from master key + new salt
3. Begin transaction:
   a. For each enrollment:
      i.   Decrypt embedding with OLD key
      ii.  Re-encrypt with NEW key
      iii. Update record
   b. Store new salt
   c. Mark old salt as retired
4. Commit transaction
5. Verify: decrypt random sample with new key
6. Secure-delete old salt after verification
```

---

## Anti-Spoofing Measures

### Dual-Layer Liveness Detection

```
┌──────────────────────────────────────────────────────────┐
│              ANTI-SPOOFING PIPELINE                       │
│                                                          │
│  Camera Frame                                            │
│      │                                                   │
│      ▼                                                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  LAYER 1: PASSIVE LIVENESS                        │   │
│  │                                                    │   │
│  │  MiniFASNet analyzes face texture for:             │   │
│  │  • Moiré patterns (screen replay indicator)        │   │
│  │  • Color histogram anomalies (print indicator)     │   │
│  │  • Texture gradient consistency                    │   │
│  │  • Specular reflection analysis                    │   │
│  │  • Skin tone naturalness                           │   │
│  │                                                    │   │
│  │  Score: 0.0 (spoof) ──────── 1.0 (live)           │   │
│  │  Threshold: ≥ 0.85 required                        │   │
│  │  Latency: ~35ms per frame                          │   │
│  └────────────────────┬─────────────────────────────┘   │
│                       │                                  │
│                 Pass? │                                  │
│                ┌──────┼──────┐                           │
│                │ Yes         │ No ──► REJECT (spoof)     │
│                ▼                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  LAYER 2: ACTIVE LIVENESS                         │   │
│  │                                                    │   │
│  │  Random challenge selection (2 of 5):              │   │
│  │                                                    │   │
│  │  🔄 HEAD_TURN_LEFT                                │   │
│  │     Detect >15° horizontal rotation left           │   │
│  │     Verify 3D parallax (flat images fail)          │   │
│  │                                                    │   │
│  │  🔄 HEAD_TURN_RIGHT                               │   │
│  │     Detect >15° horizontal rotation right          │   │
│  │     Verify 3D parallax                             │   │
│  │                                                    │   │
│  │  👁️ BLINK                                         │   │
│  │     Detect natural blink (EAR metric)              │   │
│  │     Verify blink duration (100–400ms)              │   │
│  │                                                    │   │
│  │  😊 SMILE                                         │   │
│  │     Detect smile expression change                 │   │
│  │     Verify facial muscle movement consistency      │   │
│  │                                                    │   │
│  │  ↕️ NOD                                            │   │
│  │     Detect vertical head movement                  │   │
│  │     Verify natural motion trajectory               │   │
│  │                                                    │   │
│  │  Timeout: 5 seconds per challenge                  │   │
│  │  Both challenges must pass                         │   │
│  └────────────────────┬─────────────────────────────┘   │
│                       │                                  │
│                 Pass? │                                  │
│                ┌──────┼──────┐                           │
│                │ Yes         │ No ──► REJECT             │
│                ▼                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  DECISION FUSION                                  │   │
│  │                                                    │   │
│  │  Combined Score = 0.6 × passive + 0.4 × active    │   │
│  │                                                    │   │
│  │  Requirements:                                     │   │
│  │  ✓ Passive score ≥ 0.85                           │   │
│  │  ✓ Active challenges both completed               │   │
│  │  ✓ Combined score ≥ 0.80                          │   │
│  │  ✓ Temporal consistency (3 consecutive frames)    │   │
│  │                                                    │   │
│  │  Result: LIVE ──► Proceed to recognition          │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### Spoof Type Detection Capabilities

| Attack Type | Detection Method | Confidence |
|------------|-----------------|------------|
| **Printed Photo** | Texture analysis + moiré detection | >98% |
| **Screen Replay** | Moiré pattern + blink challenge | >96% |
| **Cut-out Photo** | Edge detection + head turn challenge | >95% |
| **3D Mask (basic)** | Texture gradient + active challenges | >85% |
| **3D Mask (high-quality)** | Limited detection — marked for future IR integration | ~60% |
| **Deepfake Video** | Temporal inconsistency + random challenges | >90% |

### Anti-Replay Protections

```
Each liveness session includes:
├── Session UUID (unique per attempt)
├── Random challenge sequence (non-predictable)
├── Timestamp validation (±30 second window)
├── Frame sequence verification (continuous, no splicing)
└── Challenge response timing (natural human reaction time: 200ms–3s)
```

---

## Data in Transit

### TLS Configuration

```
Minimum TLS Version: 1.3
Cipher Suites (in priority order):
  1. TLS_AES_256_GCM_SHA384
  2. TLS_CHACHA20_POLY1305_SHA256
  3. TLS_AES_128_GCM_SHA256

Certificate Pinning:
  ├── Pin: SHA256 hash of SubjectPublicKeyInfo
  ├── Backup pins: 2 additional pins for rotation
  ├── Max age: 30 days
  └── Failure mode: Block connection, show error
```

### Payload Integrity

```
Every sync payload includes:
├── SHA256 checksum of the serialized event array
├── HMAC-SHA256 signature using device sync key
├── Batch UUID for deduplication
└── Timestamp for freshness validation (±5 minute window)
```

---

## Application Security

### Runtime Protection

| Check | Android | iOS | Action on Failure |
|-------|---------|-----|-------------------|
| **Root/Jailbreak Detection** | SafetyNet / Play Integrity | Jailbreak detection APIs | Warning + limited functionality |
| **Debugger Detection** | `Debug.isDebuggerConnected()` | `ptrace` check | Terminate inference |
| **Code Integrity** | APK signature verification | App Store receipt validation | Refuse to launch |
| **Emulator Detection** | Build fingerprint check | Simulator detection | Block biometric features |
| **Screen Recording** | `FLAG_SECURE` on sensitive views | `UIScreen.isCaptured` | Blank sensitive UI |
| **Overlay Detection** | `filterTouchesWhenObscured` | N/A | Block input on overlays |

### Secure Coding Practices

```
1. No biometric data in console.log() or crash reports
2. No biometric data in React DevTools state
3. ProGuard/R8 obfuscation for release builds
4. Hermes bytecode compilation (no readable JS in APK)
5. Certificate pinning for all HTTPS connections
6. Input validation on all user-provided data
7. SQL injection prevention via parameterized queries
8. No eval() or dynamic code execution
9. Secure random number generation (CSPRNG only)
10. Memory zeroing for sensitive data after use
```

---

## Data Retention Policies

### Retention Schedule

| Data Type | Default Retention | Configurable Range | Deletion Method |
|-----------|------------------|-------------------|-----------------|
| Biometric Embeddings | 365 days | 90–730 days | Cryptographic erasure |
| Authentication Events | 90 days (local) | 30–365 days | SQLite DELETE + VACUUM |
| Audit Logs | 180 days (local) | 90–365 days | File rotation + secure delete |
| Sync Queue (completed) | 7 days | 1–30 days | SQLite DELETE |
| Dead Letter Queue | 30 days | 7–90 days | SQLite DELETE + VACUUM |
| Camera Frame Buffers | 0 (immediate) | N/A | Overwrite in ring buffer |

### Automated Cleanup

```
Daily Maintenance Job (runs at 2:00 AM local):
├── 1. Check all embeddings for expiry
│   └── Delete expired embeddings (cryptographic erasure)
├── 2. Prune old auth events beyond retention
│   └── DELETE + VACUUM
├── 3. Rotate audit log files
│   └── Compress old logs, delete beyond retention
├── 4. Clean sync queue
│   └── Remove acknowledged events older than 7 days
├── 5. Process dead letter queue
│   └── Expire events older than 30 days
└── 6. Report storage metrics
    └── Log current usage for monitoring
```

### User Data Deletion (Right to Erasure)

```
Admin-triggered user deletion:
1. Identify all records for user_id
2. Delete biometric embedding (cryptographic erasure)
3. Delete auth events (or anonymize if audit requirement)
4. Delete sync queue entries
5. Verify deletion completeness
6. Log deletion event (GDPR audit trail)
7. Queue deletion notification to Datalake 3.0
```

---

## Compliance Considerations

### Relevant Regulations

| Regulation | Relevance | Status |
|-----------|-----------|--------|
| **IT Act 2000 (India)** | Sensitive personal data protection | ✅ Compliant by design |
| **DPDP Act 2023 (India)** | Digital personal data protection | ✅ Design-aligned |
| **GDPR (EU)** | If processing EU citizen data | ⚠️ Awareness (not primary scope) |
| **ISO 27001** | Information security management | 📋 Framework followed |
| **ISO 30107** | Biometric presentation attack detection | 📋 Principles applied |
| **NIST SP 800-76** | Biometric specifications for PIV | 📋 Reference standard |

### DPDP Act 2023 Compliance Measures

| Requirement | Implementation |
|-------------|---------------|
| **Lawful Purpose** | Authentication for authorized work access |
| **Purpose Limitation** | Biometric data used solely for identity verification |
| **Data Minimization** | Only 128-d embeddings stored, not photos |
| **Storage Limitation** | Configurable retention with auto-deletion |
| **Accuracy** | High-accuracy models with quality gating |
| **Security Safeguards** | AES-256-GCM encryption, hardware-backed keys |
| **Consent** | Explicit consent obtained during enrollment |
| **Right to Erasure** | Admin-triggered user data deletion |
| **Breach Notification** | Audit trail + monitoring for anomalies |
| **Data Fiduciary** | NHAI as data fiduciary, app as processor |

### Audit Trail Requirements

Every authentication event includes:

```typescript
interface AuditRecord {
  /** Unique event identifier */
  eventId: string;        // UUID v4
  /** Type of event */
  eventType: 'ENROLLMENT' | 'RECOGNITION' | 'DELETION' | 'CONFIG_CHANGE';
  /** Subject user ID */
  userId: string;         // NHAI employee ID
  /** Action performer (admin for enrollment) */
  performedBy: string;
  /** Result of the action */
  result: 'SUCCESS' | 'FAILED' | 'SPOOF_DETECTED';
  /** Confidence score */
  confidence: number;
  /** Liveness check result */
  livenessScore: number;
  /** GPS coordinates */
  location: { lat: number; lon: number; accuracy: number };
  /** Device identifier */
  deviceId: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Processing duration */
  processingTimeMs: number;
  /** App version */
  appVersion: string;
  /** Hash for integrity verification */
  recordHash: string;     // SHA256 of all fields
}
```

---

## Incident Response

### Security Incident Categories

| Category | Examples | Response Time |
|----------|----------|---------------|
| **P1 — Critical** | Biometric data breach, mass spoofing | Immediate (within 1 hour) |
| **P2 — High** | Root detection triggered, tampered app | Within 4 hours |
| **P3 — Medium** | Excessive failed attempts, DLQ overflow | Within 24 hours |
| **P4 — Low** | Configuration anomaly, single spoof attempt | Next business day |

### Response Procedures

```
P1 — Critical Incident:
1. Device: Disable all authentication immediately
2. Device: Encrypt and lock biometric vault
3. Cloud: Revoke device credentials
4. Cloud: Flag all recent events for review
5. Admin: Notify security team
6. Admin: Begin forensic investigation
7. Admin: Prepare breach notification (if required)

P2 — High Incident:
1. Device: Log detailed diagnostic information
2. Device: Increase liveness threshold temporarily
3. Cloud: Alert monitoring dashboard
4. Admin: Schedule investigation within 4 hours

P3 — Medium Incident:
1. Device: Log event with full context
2. Cloud: Include in daily security report
3. Admin: Review in next daily standup
```

---

## Security Audit Checklist

### Pre-Deployment Checklist

- [ ] All biometric data encrypted at rest (AES-256-GCM)
- [ ] Database encrypted with SQLCipher
- [ ] Hardware-backed key storage configured
- [ ] TLS 1.3 enforced for all connections
- [ ] Certificate pinning configured with backup pins
- [ ] Root/jailbreak detection enabled
- [ ] Debugger detection enabled
- [ ] ProGuard/R8 obfuscation applied
- [ ] No sensitive data in logs or crash reports
- [ ] Liveness detection thresholds calibrated
- [ ] Active challenge randomization verified
- [ ] Data retention policies configured
- [ ] Audit logging comprehensive and tamper-evident
- [ ] Key rotation policies defined
- [ ] Incident response procedures documented
- [ ] Penetration testing completed
- [ ] DPDP Act compliance review completed
- [ ] Security documentation up to date

---

> 🔒 **Security is not a feature — it's a fundamental requirement.** This document should be reviewed and updated with every release.
