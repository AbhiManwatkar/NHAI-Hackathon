# Security Model

> Threat model, encryption specification, and privacy compliance for FaceGuard Offline.

---

## Threat Model

FaceGuard operates in a hostile environment: field devices may be stolen, shared, or used by untrained operators. The security model assumes:

| Assumption | Implication |
|-----------|-------------|
| Device may be lost or stolen | All biometric data encrypted at rest |
| Device may be rooted/jailbroken | Rooted device detection + key obfuscation |
| Operator may attempt buddy-punching | Biometric verification (not token-based) |
| Attacker may use printed photos | MiniFASNet liveness detection |
| Attacker may use screen replay | Moiré pattern + temporal analysis |
| Network may be intercepted | TLS 1.3 for all cloud communication |
| Database may be extracted | AES-256-CBC encryption + SQLCipher |
| Insider may access raw data | No images stored; embeddings non-invertible |

### Mitigated Attacks

| # | Attack | Mitigation | Layer |
|---|--------|-----------|-------|
| 1 | Printed photo spoofing | MiniFASNet depth + texture analysis | Liveness |
| 2 | Screen replay spoofing | Moiré pattern detection | Liveness |
| 3 | Buddy punching | Face biometric (not badge/PIN) | Recognition |
| 4 | Embedding theft from device | AES-256-CBC + device-bound key | Storage |
| 5 | Database file extraction | SQLCipher whole-database encryption | Storage |
| 6 | Man-in-the-middle during sync | TLS 1.3 + AWS SigV4 request signing | Transport |
| 7 | Replay of old attendance records | Timestamp + UUID nonce per record | Protocol |
| 8 | Cross-device embedding transfer | Device-bound key derivation | Crypto |
| 9 | Brute-force key recovery | PBKDF2 100k iterations (≈250ms/attempt) | Crypto |
| 10 | Memory dump during recognition | Embeddings held in memory < 500ms | Runtime |

---

## Encryption Specification

### Algorithm Parameters

| Parameter | Value | Standard |
|-----------|-------|----------|
| Cipher | AES-256-CBC | NIST FIPS 197 |
| Key length | 256 bits (32 bytes) | |
| Block size | 128 bits (16 bytes) | |
| IV | 16 bytes, cryptographically random | Per-record unique |
| Padding | PKCS#7 | |
| Key derivation | PBKDF2-HMAC-SHA512 | NIST SP 800-132 |
| KDF iterations | 100,000 | OWASP 2023 recommendation |
| KDF salt | `SHA256(appId + siteCode)` | 32 bytes |
| Key source | Hardware device ID | Platform-specific |

### Key Derivation Flow

```
Input: deviceId (string, platform-specific hardware identifier)
       siteCode (string, e.g., "NH_001")
       appId    (string, bundle identifier)

Salt = SHA-256( appId || ":" || siteCode )       → 32 bytes
Key  = PBKDF2( deviceId, Salt, 100000, 32, "sha512" )  → 256-bit AES key
```

### Encryption Operation

```typescript
function encryptEmbedding(embedding: number[], hexKey: string): { ciphertext: string; iv: string } {
  const plaintext = Buffer.from(JSON.stringify(embedding));
  const iv = crypto.randomBytes(16);                       // Unique per record
  const key = Buffer.from(hexKey, 'hex');                  // 32 bytes
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
  };
}
```

### Why Per-Record Random IV?

Without unique IVs, identical embeddings would produce identical ciphertexts, enabling:
- **Correlation attacks**: Identifying re-enrolled employees
- **Known-plaintext attacks**: If any embedding is compromised, others with the same IV are vulnerable
- **Pattern analysis**: Frequency analysis on ciphertext blocks

Each record gets a fresh 16-byte IV from `crypto.randomBytes()`, ensuring semantic security under CPA.

---

## Why Embeddings, Not Images

| Property | Face Images | 128-d Embeddings |
|----------|------------|-----------------|
| Size | 50–500 KB per image | 512 bytes (128 × float32) |
| Reversibility | Contains full facial appearance | Non-invertible one-way transform |
| Privacy risk | Can identify individual visually | Cannot reconstruct face |
| Legal classification | Biometric data (high sensitivity) | Derived biometric data (lower risk) |
| Storage cost | High | Negligible |
| Matching speed | Requires model inference per comparison | Pure math (dot product) |

**Key insight**: A 128-float embedding is a point in a learned metric space. There is no known method to reconstruct a human-recognisable face image from these 128 numbers. The transformation through MobileFaceNet's 4.2 million parameters is computationally irreversible — it's a many-to-one mapping from the space of all possible face images to a 128-dimensional unit hypersphere.

---

## Device Binding

The encryption key is derived from the hardware device ID, creating a cryptographic binding:

- **Android**: `Settings.Secure.ANDROID_ID` (unique per app installation + device)
- **iOS**: `UIDevice.identifierForVendor` (unique per vendor + device)

### Implications

| Scenario | Behaviour |
|----------|-----------|
| Same app, same device | Same key → embeddings decryptable |
| Same app, different device | Different key → embeddings undecryptable |
| Re-install on same device | New ANDROID_ID → new key → re-enrolment required |
| Device factory reset | New ANDROID_ID → new key → re-enrolment required |
| Database file copied to another device | Encrypted data is unreadable |

---

## Key Rotation

### Current Implementation

Key rotation requires re-enrolment:

1. Admin triggers re-enrolment for affected employees
2. New embeddings are captured and encrypted with the current device key
3. Old embedding records are cryptographically purged (zeroed + deleted)

### Roadmap: Automatic Key Rotation

Future releases will support transparent key rotation:

1. Generate new key via PBKDF2 with incremented salt version
2. Decrypt all embeddings with old key
3. Re-encrypt with new key in a single atomic transaction
4. Securely erase old key material
5. Update key version in local metadata

---

## India DPDP Act 2023 Alignment

The Digital Personal Data Protection Act, 2023 establishes principles that FaceGuard Offline addresses by design:

| DPDP Principle | FaceGuard Implementation |
|---------------|------------------------|
| **Purpose limitation** (§4) | Biometric data used only for attendance; no secondary processing |
| **Data minimisation** (§4) | Only 128-d embeddings stored; no images, no raw biometrics |
| **Storage limitation** (§8) | Embeddings purged after confirmed cloud sync |
| **Accuracy** (§8) | Multi-angle enrolment + quality score validation |
| **Security safeguards** (§8) | AES-256-CBC encryption, device binding, access controls |
| **Data principal rights** (§11-14) | Employee can request deletion → `purgeRecords()` |
| **Accountability** (§8) | Full audit log of attendance + sync events |

### Data Classification

| Data Element | Classification | Storage | Retention |
|-------------|---------------|---------|-----------|
| Face image (camera frame) | Sensitive biometric | In-memory only | < 1 second (single frame) |
| 128-d embedding | Derived biometric | SQLite (encrypted) | Until sync + purge |
| Attendance record | Personal data | SQLite → DynamoDB | Per org retention policy |
| Employee name/dept | Personal data | SQLite → DynamoDB | Per org retention policy |

---

## Data Retention Policy

```
┌──────────────────────────────────────────────────────────┐
│                   Data Lifecycle                          │
├──────────────┬──────────────────┬────────────────────────┤
│    Phase     │   Location       │   Duration             │
├──────────────┼──────────────────┼────────────────────────┤
│ Capture      │ RAM only         │ < 1 second             │
│ Storage      │ SQLite (AES)     │ Until sync confirmed   │
│ Sync         │ TLS → DynamoDB   │ Transit only           │
│ Post-sync    │ SQLite (zeroed)  │ Metadata only (audit)  │
│ Cloud        │ DynamoDB         │ Per org policy          │
└──────────────┴──────────────────┴────────────────────────┘
```

### Purge Procedure

1. `SyncManager.syncAndPurge()` confirms all records uploaded
2. `BiometricVault.purgeRecords(employeeId)` executes:
   - Overwrite `embeddings.ciphertext` with empty string
   - Overwrite `embeddings.iv` with empty string
   - Set `attendance.confidence` to NULL
   - Set `attendance.livenessScore` to NULL
   - **Retain**: employee row (id, name, department) for audit trail
   - **Retain**: attendance row (timestamp, type) for payroll

---

## Audit Log Trail

Every significant operation is logged:

| Event | Logged Fields |
|-------|--------------|
| Employee enrolment | employee_id, timestamp, quality_score |
| Attendance mark | employee_id, timestamp, type, confidence, liveness |
| Sync upload | record_ids, timestamp, success/failure |
| Sync confirmation | record_ids, timestamp, server_ack |
| Purge execution | employee_id, timestamp, fields_zeroed |
| Key derivation | timestamp, salt_version (not the key itself) |
