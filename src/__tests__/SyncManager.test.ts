/**
 * FaceGuard Offline – SyncManager Unit Tests
 *
 * All AWS SDK calls are mocked. Tests validate queue counting,
 * DynamoDB batch format, partial failure handling, purge ordering,
 * and background-fetch trigger behaviour.
 */

// ── Mocks ────────────────────────────────────────────────────────────
const mockBatchWrite = jest.fn();
const mockPutItem = jest.fn();
jest.mock('aws-sdk', () => ({
  DynamoDB: {
    DocumentClient: jest.fn(() => ({
      batchWrite: jest.fn((params) => ({
        promise: () => mockBatchWrite(params),
      })),
      put: jest.fn((params) => ({
        promise: () => mockPutItem(params),
      })),
    })),
  },
  config: { update: jest.fn() },
}));

const mockConfigure = jest.fn();
const mockFinish = jest.fn();
jest.mock('react-native-background-fetch', () => ({
  __esModule: true,
  default: {
    configure: mockConfigure,
    finish: mockFinish,
    STATUS_AVAILABLE: 2,
  },
  configure: mockConfigure,
  finish: mockFinish,
  STATUS_AVAILABLE: 2,
}));

import { SyncManager } from '../sync/SyncManager';
import { BiometricVault } from '../storage/BiometricVault';
import BackgroundFetch from 'react-native-background-fetch';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function mockVault(unsyncedRecords: any[] = []): jest.Mocked<BiometricVault> {
  return {
    getUnsyncedRecords: jest.fn().mockResolvedValue(unsyncedRecords),
    markSynced: jest.fn().mockResolvedValue(undefined),
    purgeRecords: jest.fn().mockResolvedValue(undefined),
    getAttendance: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<BiometricVault>;
}

function makeRecord(id: string, employeeId = 'emp-001') {
  return {
    id,
    employeeId,
    timestamp: '2026-06-03T09:00:00Z',
    type: 'CHECK_IN',
    confidence: 0.92,
    livenessScore: 0.97,
    syncStatus: 'LOCAL',
  };
}

/* ================================================================== */
/*  1. Queue counting                                                  */
/* ================================================================== */

describe('queue', () => {
  it('returns correct unsynced count', async () => {
    const records = [makeRecord('r1'), makeRecord('r2'), makeRecord('r3')];
    const vault = mockVault(records);
    const sync = new SyncManager(vault);

    const count = await sync.getQueueSize();

    expect(vault.getUnsyncedRecords).toHaveBeenCalled();
    expect(count).toBe(3);
  });

  it('returns 0 when nothing is queued', async () => {
    const vault = mockVault([]);
    const sync = new SyncManager(vault);
    expect(await sync.getQueueSize()).toBe(0);
  });
});

/* ================================================================== */
/*  2. Upload batch format                                             */
/* ================================================================== */

describe('uploadBatch', () => {
  beforeEach(() => {
    mockBatchWrite.mockReset();
    mockBatchWrite.mockResolvedValue({ UnprocessedItems: {} });
  });

  it('calls DynamoDB batchWrite with correct item format', async () => {
    const records = [makeRecord('r1', 'emp-001')];
    const vault = mockVault(records);
    const sync = new SyncManager(vault);

    await sync.uploadBatch();

    expect(mockBatchWrite).toHaveBeenCalledTimes(1);
    const params = mockBatchWrite.mock.calls[0][0];

    // Validate table name
    expect(params.RequestItems).toHaveProperty('FaceGuardAttendance');

    // Validate item structure
    const items = params.RequestItems.FaceGuardAttendance;
    expect(items.length).toBe(1);
    const putReq = items[0].PutRequest.Item;
    expect(putReq).toEqual(
      expect.objectContaining({
        recordId: 'r1',
        employeeId: 'emp-001',
        timestamp: '2026-06-03T09:00:00Z',
        type: 'CHECK_IN',
        confidence: 0.92,
        livenessScore: 0.97,
      }),
    );
  });

  it('marks records as synced after successful upload', async () => {
    const records = [makeRecord('r1'), makeRecord('r2')];
    const vault = mockVault(records);
    const sync = new SyncManager(vault);

    await sync.uploadBatch();

    expect(vault.markSynced).toHaveBeenCalledWith(['r1', 'r2']);
  });

  it('handles batch size > 25 by splitting into chunks', async () => {
    const records = Array.from({ length: 30 }, (_, i) =>
      makeRecord(`r${i}`),
    );
    const vault = mockVault(records);
    const sync = new SyncManager(vault);

    await sync.uploadBatch();

    // DynamoDB batchWrite limit is 25 items
    expect(mockBatchWrite).toHaveBeenCalledTimes(2);
    const firstBatch =
      mockBatchWrite.mock.calls[0][0].RequestItems.FaceGuardAttendance;
    const secondBatch =
      mockBatchWrite.mock.calls[1][0].RequestItems.FaceGuardAttendance;
    expect(firstBatch.length).toBe(25);
    expect(secondBatch.length).toBe(5);
  });
});

/* ================================================================== */
/*  3. Partial upload failure                                          */
/* ================================================================== */

describe('partial upload failure', () => {
  it('failed records remain LOCAL after partial upload failure', async () => {
    const records = [makeRecord('r1'), makeRecord('r2'), makeRecord('r3')];
    const vault = mockVault(records);
    const sync = new SyncManager(vault);

    // Simulate DynamoDB returning r2 as unprocessed
    mockBatchWrite.mockResolvedValue({
      UnprocessedItems: {
        FaceGuardAttendance: [
          { PutRequest: { Item: { recordId: 'r2' } } },
        ],
      },
    });

    await sync.uploadBatch();

    // Only r1 and r3 should be marked as synced
    expect(vault.markSynced).toHaveBeenCalledWith(['r1', 'r3']);
  });

  it('does not mark any records synced on total failure', async () => {
    const records = [makeRecord('r1')];
    const vault = mockVault(records);
    const sync = new SyncManager(vault);

    mockBatchWrite.mockRejectedValue(new Error('Network timeout'));

    await expect(sync.uploadBatch()).rejects.toThrow('Network timeout');
    expect(vault.markSynced).not.toHaveBeenCalled();
  });

  it('retries unprocessed items up to max retries', async () => {
    const records = [makeRecord('r1')];
    const vault = mockVault(records);
    const sync = new SyncManager(vault);

    // First call returns unprocessed, second call succeeds
    mockBatchWrite
      .mockResolvedValueOnce({
        UnprocessedItems: {
          FaceGuardAttendance: [
            { PutRequest: { Item: { recordId: 'r1' } } },
          ],
        },
      })
      .mockResolvedValueOnce({ UnprocessedItems: {} });

    await sync.uploadBatch();

    expect(mockBatchWrite).toHaveBeenCalledTimes(2);
    expect(vault.markSynced).toHaveBeenCalledWith(['r1']);
  });
});

/* ================================================================== */
/*  4. Purge after sync                                                */
/* ================================================================== */

describe('purge ordering', () => {
  it('purge only occurs after confirmed sync', async () => {
    const records = [makeRecord('r1', 'emp-001')];
    const vault = mockVault(records);
    const sync = new SyncManager(vault);

    mockBatchWrite.mockResolvedValue({ UnprocessedItems: {} });

    const callOrder: string[] = [];
    vault.markSynced = jest.fn(async (_ids: string[]) => {
      callOrder.push('markSynced');
    });
    vault.purgeRecords = jest.fn(async (_employeeId: string) => {
      callOrder.push('purge');
    });

    await sync.syncAndPurge();

    expect(callOrder).toEqual(['markSynced', 'purge']);
  });

  it('does not purge when upload fails', async () => {
    const records = [makeRecord('r1')];
    const vault = mockVault(records);
    const sync = new SyncManager(vault);

    mockBatchWrite.mockRejectedValue(new Error('DynamoDB unavailable'));

    try {
      await sync.syncAndPurge();
    } catch {
      // Expected
    }

    expect(vault.purgeRecords).not.toHaveBeenCalled();
  });

  it('does not purge when partial records remain unsynced', async () => {
    const records = [makeRecord('r1'), makeRecord('r2')];
    const vault = mockVault(records);
    const sync = new SyncManager(vault);

    mockBatchWrite.mockResolvedValue({
      UnprocessedItems: {
        FaceGuardAttendance: [
          { PutRequest: { Item: { recordId: 'r2' } } },
        ],
      },
    });

    await sync.syncAndPurge();

    // purge should NOT be called because r2 is still unsynced
    expect(vault.purgeRecords).not.toHaveBeenCalled();
  });
});

/* ================================================================== */
/*  5. Background fetch triggers                                       */
/* ================================================================== */

describe('background fetch', () => {
  it('triggers sync when online', async () => {
    const records = [makeRecord('r1')];
    const vault = mockVault(records);
    const sync = new SyncManager(vault);

    mockBatchWrite.mockResolvedValue({ UnprocessedItems: {} });

    // Simulate the background fetch callback
    const uploadSpy = jest.spyOn(sync, 'uploadBatch');

    await sync.onBackgroundFetch({ isOnline: true });

    expect(uploadSpy).toHaveBeenCalled();
  });

  it('skips sync when offline', async () => {
    const vault = mockVault([makeRecord('r1')]);
    const sync = new SyncManager(vault);
    const uploadSpy = jest.spyOn(sync, 'uploadBatch');

    await sync.onBackgroundFetch({ isOnline: false });

    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it('registers background fetch handler on init', () => {
    const vault = mockVault();
    const sync = new SyncManager(vault);
    sync.registerBackgroundSync();

    expect(BackgroundFetch.configure).toHaveBeenCalledWith(
      expect.objectContaining({
        minimumFetchInterval: 15,
        stopOnTerminate: false,
        startOnBoot: true,
      }),
      expect.any(Function),
      expect.any(Function),
    );
  });
});
