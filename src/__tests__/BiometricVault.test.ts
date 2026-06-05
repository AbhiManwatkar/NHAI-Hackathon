/**
 * FaceGuard Offline – BiometricVault Unit Tests
 *
 * Validates encryption/decryption, SQLite schema, enrollment,
 * attendance logging, sync status management, and secure purge.
 */
import {
  encryptEmbedding,
  decryptEmbedding,
  BiometricVault,
} from '../storage/BiometricVault';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function randEmbedding(dim = 128): number[] {
  return Array.from({ length: dim }, () => Math.random() * 2 - 1);
}

const TEST_KEY = 'a'.repeat(64); // 256-bit hex key for testing

let vault: BiometricVault;

beforeEach(async () => {
  vault = new BiometricVault(':memory:', TEST_KEY);
  await vault.initialize();
});

afterEach(async () => {
  await vault.close();
});

/* ================================================================== */
/*  1. Encryption round-trip                                           */
/* ================================================================== */

describe('Encryption', () => {
  it('encryptEmbedding + decryptEmbedding roundtrip produces identical array', () => {
    const original = randEmbedding();
    const { ciphertext, iv } = encryptEmbedding(original, TEST_KEY);
    const decrypted = decryptEmbedding(ciphertext, iv, TEST_KEY);
    expect(decrypted.length).toBe(original.length);
    original.forEach((val, i) => {
      expect(decrypted[i]).toBeCloseTo(val, 10);
    });
  });

  it('different IVs produce different ciphertexts for same embedding', () => {
    const emb = randEmbedding();
    const enc1 = encryptEmbedding(emb, TEST_KEY);
    const enc2 = encryptEmbedding(emb, TEST_KEY);
    // IVs should differ (random generation)
    expect(enc1.iv).not.toBe(enc2.iv);
    // Ciphertexts should differ
    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
    // But both decrypt to the same embedding
    const d1 = decryptEmbedding(enc1.ciphertext, enc1.iv, TEST_KEY);
    const d2 = decryptEmbedding(enc2.ciphertext, enc2.iv, TEST_KEY);
    d1.forEach((val, i) => expect(val).toBeCloseTo(d2[i], 10));
  });

  it('rejects tampered ciphertext', () => {
    const emb = randEmbedding();
    const { ciphertext, iv } = encryptEmbedding(emb, TEST_KEY);
    // Flip a byte in the ciphertext
    const tampered = Buffer.from(ciphertext, 'base64');
    tampered[0] ^= 0xff;
    expect(() =>
      decryptEmbedding(tampered.toString('base64'), iv, TEST_KEY),
    ).toThrow();
  });
});

/* ================================================================== */
/*  2. SQLite schema                                                   */
/* ================================================================== */

describe('Schema', () => {
  it('creates all required tables', async () => {
    const tables = await vault.listTables();
    expect(tables).toContain('employees');
    expect(tables).toContain('embeddings');
    expect(tables).toContain('attendance');
    expect(tables).toContain('sync_queue');
  });

  it('employees table has expected columns', async () => {
    const cols = await vault.getTableColumns('employees');
    expect(cols).toEqual(
      expect.arrayContaining(['id', 'name', 'department', 'created_at']),
    );
  });

  it('embeddings table has expected columns', async () => {
    const cols = await vault.getTableColumns('embeddings');
    expect(cols).toEqual(
      expect.arrayContaining([
        'id', 'employee_id', 'ciphertext', 'iv', 'version',
      ]),
    );
  });
});

/* ================================================================== */
/*  3. Enrollment                                                      */
/* ================================================================== */

describe('enrollEmployee', () => {
  it('stores encrypted embedding', async () => {
    const emb = randEmbedding();
    const empId = await vault.enrollEmployee({
      name: 'Test User',
      department: 'Engineering',
      embedding: emb,
    });

    expect(empId).toBeTruthy();

    // Verify stored ciphertext is not the raw embedding
    const row = await vault.getRawEmbeddingRow(empId);
    expect(row).not.toBeNull();
    expect(row!.ciphertext).toBeTruthy();
    expect(row!.iv).toBeTruthy();

    // The ciphertext should NOT look like a plain float array
    const rawJson = JSON.stringify(emb);
    expect(row!.ciphertext).not.toBe(rawJson);
  });

  it('enrollment creates both employee and embedding records', async () => {
    const empId = await vault.enrollEmployee({
      name: 'Jane Doe',
      department: 'HR',
      embedding: randEmbedding(),
    });

    const emp = await vault.getEmployee(empId);
    expect(emp).not.toBeNull();
    expect(emp!.name).toBe('Jane Doe');

    const embRow = await vault.getRawEmbeddingRow(empId);
    expect(embRow).not.toBeNull();
  });
});

/* ================================================================== */
/*  4. Loading embeddings                                              */
/* ================================================================== */

describe('loadAllEmbeddings', () => {
  it('returns decrypted embeddings matching originals', async () => {
    const originals: { id: string; embedding: number[] }[] = [];

    for (let i = 0; i < 5; i++) {
      const emb = randEmbedding();
      const id = await vault.enrollEmployee({
        name: `User ${i}`,
        department: 'QA',
        embedding: emb,
      });
      originals.push({ id, embedding: emb });
    }

    const loaded = await vault.loadAllEmbeddings();
    expect(loaded.length).toBe(5);

    for (const orig of originals) {
      const match = loaded.find((e) => e.employeeId === orig.id);
      expect(match).toBeDefined();
      orig.embedding.forEach((val, j) => {
        expect(match!.embedding[j]).toBeCloseTo(val, 10);
      });
    }
  });
});

/* ================================================================== */
/*  5. Attendance                                                      */
/* ================================================================== */

describe('logAttendance', () => {
  it('inserts correct record', async () => {
    const empId = await vault.enrollEmployee({
      name: 'Attendee',
      department: 'Ops',
      embedding: randEmbedding(),
    });

    await vault.logAttendance({
      employeeId: empId,
      timestamp: '2026-06-03T09:00:00Z',
      type: 'CHECK_IN',
      confidence: 0.92,
      livenessScore: 0.97,
    });

    const records = await vault.getAttendance(empId);
    expect(records.length).toBe(1);
    expect(records[0].type).toBe('CHECK_IN');
    expect(records[0].confidence).toBeCloseTo(0.92, 2);
    expect(records[0].livenessScore).toBeCloseTo(0.97, 2);
  });
});

/* ================================================================== */
/*  6. Sync queue                                                      */
/* ================================================================== */

describe('Sync queue', () => {
  let empId: string;

  beforeEach(async () => {
    empId = await vault.enrollEmployee({
      name: 'Sync User',
      department: 'IT',
      embedding: randEmbedding(),
    });
    // Insert several attendance records with varying sync status
    await vault.logAttendance({
      employeeId: empId,
      timestamp: '2026-06-03T09:00:00Z',
      type: 'CHECK_IN',
      confidence: 0.9,
      livenessScore: 0.95,
    });
    await vault.logAttendance({
      employeeId: empId,
      timestamp: '2026-06-03T17:00:00Z',
      type: 'CHECK_OUT',
      confidence: 0.88,
      livenessScore: 0.93,
    });
  });

  it('getUnsyncedRecords returns only LOCAL status records', async () => {
    const unsynced = await vault.getUnsyncedRecords();
    expect(unsynced.length).toBe(2);
    unsynced.forEach((r) => expect(r.syncStatus).toBe('LOCAL'));
  });

  it('markSynced updates status correctly', async () => {
    const unsynced = await vault.getUnsyncedRecords();
    await vault.markSynced(unsynced.map((r) => r.id));

    const remaining = await vault.getUnsyncedRecords();
    expect(remaining.length).toBe(0);

    const all = await vault.getAttendance(empId);
    all.forEach((r) => expect(r.syncStatus).toBe('SYNCED'));
  });
});

/* ================================================================== */
/*  7. Secure purge                                                    */
/* ================================================================== */

describe('purgeRecords', () => {
  it('zeroes sensitive fields but keeps row', async () => {
    const empId = await vault.enrollEmployee({
      name: 'Purge User',
      department: 'Legal',
      embedding: randEmbedding(),
    });
    await vault.logAttendance({
      employeeId: empId,
      timestamp: '2026-06-03T10:00:00Z',
      type: 'CHECK_IN',
      confidence: 0.91,
      livenessScore: 0.96,
    });

    await vault.purgeRecords(empId);

    // The employee row should still exist (for audit trail)
    const emp = await vault.getEmployee(empId);
    expect(emp).not.toBeNull();

    // But the embedding ciphertext should be zeroed
    const embRow = await vault.getRawEmbeddingRow(empId);
    expect(embRow).not.toBeNull();
    expect(embRow!.ciphertext).toBe('');
    expect(embRow!.iv).toBe('');

    // Attendance row should still exist with nulled confidence
    const att = await vault.getAttendance(empId);
    expect(att.length).toBe(1);
    expect(att[0].confidence).toBeNull();
    expect(att[0].livenessScore).toBeNull();
  });
});
