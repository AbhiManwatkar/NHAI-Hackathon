/**
 * @fileoverview AWS cloud sync uploader for FaceGuard Offline.
 * Handles uploading encrypted face embeddings to S3 and syncing
 * attendance records to DynamoDB with exponential backoff retry.
 *
 * All operations are designed to work with intermittent connectivity
 * and will queue failures for retry via the SyncQueue.
 *
 * @module SyncManager/AWSUploader
 * @version 1.0.0
 */

import { Logger } from '../../utils/logger';

const TAG = 'AWSUploader';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * AWS configuration for cloud sync.
 */
export interface AWSConfig {
  /** AWS region (e.g., 'ap-south-1' for Mumbai) */
  region: string;
  /** S3 bucket name for embedding storage */
  s3BucketName: string;
  /** S3 key prefix for embeddings */
  s3KeyPrefix: string;
  /** DynamoDB table name for attendance records */
  dynamoTableName: string;
  /** AWS access key ID (stored securely, not hardcoded) */
  accessKeyId: string;
  /** AWS secret access key (stored securely, not hardcoded) */
  secretAccessKey: string;
  /** Optional session token for temporary credentials */
  sessionToken?: string;
  /** API Gateway endpoint for custom backend (optional) */
  apiEndpoint?: string;
  /** Connection timeout in milliseconds. Default: 10000 */
  connectionTimeoutMs: number;
  /** Request timeout in milliseconds. Default: 30000 */
  requestTimeoutMs: number;
  /** Maximum number of retry attempts. Default: 3 */
  maxRetries: number;
  /** Base delay for exponential backoff (ms). Default: 1000 */
  baseRetryDelayMs: number;
  /** Maximum delay for exponential backoff (ms). Default: 30000 */
  maxRetryDelayMs: number;
  /** Maximum batch size for DynamoDB operations. Default: 25 */
  dynamoBatchSize: number;
  /** Maximum batch size for S3 uploads. Default: 5 */
  s3BatchSize: number;
}

/**
 * Default AWS configuration.
 */
const DEFAULT_AWS_CONFIG: Partial<AWSConfig> = {
  region: 'ap-south-1',
  s3KeyPrefix: 'embeddings/',
  connectionTimeoutMs: 10000,
  requestTimeoutMs: 30000,
  maxRetries: 3,
  baseRetryDelayMs: 1000,
  maxRetryDelayMs: 30000,
  dynamoBatchSize: 25,
  s3BatchSize: 5,
};

/**
 * Represents an embedding record to upload to S3.
 */
export interface EmbeddingUploadItem {
  /** Embedding ID */
  id: string;
  /** Personnel ID */
  personnelId: string;
  /** Encrypted embedding blob (base64 encoded) */
  encryptedData: string;
  /** Encryption IV (hex) */
  encryptionIv: string;
  /** Authentication tag (hex) */
  authTag: string;
  /** Quality score */
  qualityScore: number;
  /** Creation timestamp */
  createdAt: string;
}

/**
 * Represents an attendance record to sync to DynamoDB.
 */
export interface AttendanceRecord {
  /** Attendance log ID */
  id: string;
  /** Personnel ID */
  personnelId: string;
  /** Event timestamp (ISO 8601) */
  timestamp: string;
  /** GPS location JSON */
  location: string | null;
  /** Site ID */
  siteId: string | null;
  /** Recognition confidence */
  confidence: number;
  /** Liveness score */
  livenessScore: number;
  /** Authentication result */
  authResult: string;
  /** Device ID */
  deviceId: string | null;
}

/**
 * Result of a batch upload operation.
 */
export interface UploadResult {
  /** Whether all items were uploaded successfully */
  success: boolean;
  /** Total items in the batch */
  totalItems: number;
  /** Items successfully uploaded */
  successCount: number;
  /** Items that failed to upload */
  failedCount: number;
  /** IDs of successfully uploaded items */
  successIds: string[];
  /** IDs and errors of failed items */
  failedItems: Array<{ id: string; error: string }>;
  /** Total time taken (ms) */
  durationMs: number;
}

/**
 * Connectivity check result.
 */
export interface ConnectivityResult {
  /** Whether connectivity to AWS is available */
  isConnected: boolean;
  /** Latency to the endpoint in ms (null if not connected) */
  latencyMs: number | null;
  /** AWS region reached */
  region: string;
  /** Timestamp of the check */
  timestamp: number;
  /** Error message if not connected */
  error: string | null;
}

/**
 * AWS cloud uploader for FaceGuard Offline.
 *
 * Handles syncing offline data to AWS:
 * - Encrypted face embeddings → S3
 * - Attendance records → DynamoDB
 *
 * Features:
 * - Exponential backoff retry with jitter
 * - Batch operations for efficiency
 * - Connectivity pre-checks
 * - Detailed upload reporting
 *
 * @example
 * ```typescript
 * const uploader = new AWSUploader();
 * await uploader.initialize({
 *   region: 'ap-south-1',
 *   s3BucketName: 'faceguard-embeddings',
 *   dynamoTableName: 'faceguard-attendance',
 *   accessKeyId: secureStore.get('aws_key'),
 *   secretAccessKey: secureStore.get('aws_secret'),
 * });
 *
 * if ((await uploader.checkConnectivity()).isConnected) {
 *   const result = await uploader.syncAttendance(records);
 *   console.log(`Synced ${result.successCount}/${result.totalItems}`);
 * }
 * ```
 */
export class AWSUploader {
  private config: AWSConfig | null = null;
  private initialized = false;

  /**
   * Initializes the AWS uploader with the provided configuration.
   *
   * @param config - AWS configuration with credentials and endpoints.
   */
  async initialize(
    config: Partial<AWSConfig> & {
      s3BucketName: string;
      dynamoTableName: string;
      accessKeyId: string;
      secretAccessKey: string;
    },
  ): Promise<void> {
    Logger.info(TAG, 'Initializing AWS uploader...');

    try {
      this.config = {
        ...DEFAULT_AWS_CONFIG,
        ...config,
      } as AWSConfig;

      // Validate required configuration
      this.validateConfig(this.config);

      this.initialized = true;
      Logger.info(
        TAG,
        `AWS uploader initialized (region: ${this.config.region}, ` +
          `bucket: ${this.config.s3BucketName}, table: ${this.config.dynamoTableName})`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(TAG, `Failed to initialize AWS uploader: ${errorMessage}`);
      throw new Error(`AWSUploader initialization failed: ${errorMessage}`);
    }
  }

  /**
   * Uploads a batch of encrypted face embeddings to S3.
   *
   * Each embedding is stored as a separate S3 object under the configured
   * key prefix. Objects are organized by personnel ID for efficient retrieval.
   *
   * S3 Key format: `{prefix}/{personnelId}/{embeddingId}.enc`
   *
   * @param batch - Array of embedding records to upload.
   * @returns Upload result with success/failure details.
   */
  async uploadEmbeddings(batch: EmbeddingUploadItem[]): Promise<UploadResult> {
    this.ensureInitialized();

    const startTime = performance.now();
    const successIds: string[] = [];
    const failedItems: Array<{ id: string; error: string }> = [];

    Logger.info(TAG, `Uploading ${batch.length} embeddings to S3...`);

    // Process in sub-batches to avoid overwhelming the connection
    const subBatchSize = this.config!.s3BatchSize;
    const subBatches = this.chunkArray(batch, subBatchSize);

    for (let batchIdx = 0; batchIdx < subBatches.length; batchIdx++) {
      const subBatch = subBatches[batchIdx];

      // Upload each embedding with retry
      const uploadPromises = subBatch.map(async (item) => {
        try {
          await this.uploadSingleEmbedding(item);
          successIds.push(item.id);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          failedItems.push({ id: item.id, error: errorMessage });
          Logger.warn(TAG, `Failed to upload embedding ${item.id}: ${errorMessage}`);
        }
      });

      await Promise.all(uploadPromises);

      // Brief pause between sub-batches to avoid throttling
      if (batchIdx < subBatches.length - 1) {
        await this.delay(200);
      }
    }

    const durationMs = performance.now() - startTime;

    const result: UploadResult = {
      success: failedItems.length === 0,
      totalItems: batch.length,
      successCount: successIds.length,
      failedCount: failedItems.length,
      successIds,
      failedItems,
      durationMs: Math.round(durationMs),
    };

    Logger.info(
      TAG,
      `S3 upload complete: ${result.successCount}/${result.totalItems} ` +
        `succeeded in ${result.durationMs}ms`,
    );

    return result;
  }

  /**
   * Syncs attendance records to DynamoDB.
   *
   * Uses DynamoDB BatchWriteItem for efficient bulk writes.
   * Handles unprocessed items by retrying with exponential backoff.
   *
   * @param records - Array of attendance records to sync.
   * @returns Upload result with success/failure details.
   */
  async syncAttendance(records: AttendanceRecord[]): Promise<UploadResult> {
    this.ensureInitialized();

    const startTime = performance.now();
    const successIds: string[] = [];
    const failedItems: Array<{ id: string; error: string }> = [];

    Logger.info(TAG, `Syncing ${records.length} attendance records to DynamoDB...`);

    // Process in DynamoDB batch size chunks (max 25 items per BatchWrite)
    const batches = this.chunkArray(records, this.config!.dynamoBatchSize);

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];

      try {
        const batchResult = await this.batchWriteAttendance(batch);

        successIds.push(...batchResult.successIds);
        failedItems.push(...batchResult.failedItems);
      } catch (error) {
        // Entire batch failed
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        for (const record of batch) {
          failedItems.push({ id: record.id, error: errorMessage });
        }
        Logger.error(TAG, `Batch ${batchIdx + 1} failed entirely: ${errorMessage}`);
      }

      // Brief pause between batches
      if (batchIdx < batches.length - 1) {
        await this.delay(100);
      }
    }

    const durationMs = performance.now() - startTime;

    const result: UploadResult = {
      success: failedItems.length === 0,
      totalItems: records.length,
      successCount: successIds.length,
      failedCount: failedItems.length,
      successIds,
      failedItems,
      durationMs: Math.round(durationMs),
    };

    Logger.info(
      TAG,
      `DynamoDB sync complete: ${result.successCount}/${result.totalItems} ` +
        `succeeded in ${result.durationMs}ms`,
    );

    return result;
  }

  /**
   * Checks connectivity to AWS services.
   *
   * Performs a lightweight health check against the API endpoint
   * or S3 bucket to verify network availability.
   *
   * @returns Connectivity status with latency information.
   */
  async checkConnectivity(): Promise<ConnectivityResult> {
    this.ensureInitialized();

    const startTime = performance.now();

    try {
      // Use the API endpoint if available, otherwise test S3 HEAD
      const testUrl = this.config!.apiEndpoint
        ? `${this.config!.apiEndpoint}/health`
        : `https://${this.config!.s3BucketName}.s3.${this.config!.region}.amazonaws.com/`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config!.connectionTimeoutMs);

      try {
        const response = await fetch(testUrl, {
          method: 'HEAD',
          signal: controller.signal,
          headers: this.getAuthHeaders('HEAD', testUrl),
        });

        clearTimeout(timeoutId);

        const latencyMs = Math.round(performance.now() - startTime);

        // S3 returns 403 for unauthorized HEAD (but confirms connectivity)
        const isConnected = response.ok || response.status === 403 || response.status === 301;

        const result: ConnectivityResult = {
          isConnected,
          latencyMs,
          region: this.config!.region,
          timestamp: Date.now(),
          error: isConnected ? null : `Unexpected status: ${response.status}`,
        };

        Logger.debug(
          TAG,
          `Connectivity check: ${isConnected ? 'OK' : 'FAILED'} ` + `(latency: ${latencyMs}ms)`,
        );

        return result;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startTime);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      const result: ConnectivityResult = {
        isConnected: false,
        latencyMs: null,
        region: this.config!.region,
        timestamp: Date.now(),
        error: errorMessage,
      };

      Logger.debug(TAG, `Connectivity check failed (${latencyMs}ms): ${errorMessage}`);

      return result;
    }
  }

  /**
   * Returns whether the uploader is initialized and ready.
   */
  isReady(): boolean {
    return this.initialized && this.config !== null;
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  /**
   * Uploads a single embedding to S3 with exponential backoff retry.
   */
  private async uploadSingleEmbedding(item: EmbeddingUploadItem): Promise<void> {
    const s3Key = `${this.config!.s3KeyPrefix}${item.personnelId}/${item.id}.enc`;

    // Create the S3 object body with metadata
    const objectBody = JSON.stringify({
      embeddingId: item.id,
      personnelId: item.personnelId,
      encryptedData: item.encryptedData,
      encryptionIv: item.encryptionIv,
      authTag: item.authTag,
      qualityScore: item.qualityScore,
      createdAt: item.createdAt,
      uploadedAt: new Date().toISOString(),
    });

    await this.retryWithBackoff(async () => {
      const url = `https://${this.config!.s3BucketName}.s3.${
        this.config!.region
      }.amazonaws.com/${s3Key}`;

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          ...this.getAuthHeaders('PUT', url),
          'Content-Type': 'application/json',
          'x-amz-server-side-encryption': 'AES256',
          'x-amz-meta-personnel-id': item.personnelId,
          'x-amz-meta-quality-score': item.qualityScore.toString(),
        },
        body: objectBody,
      });

      if (!response.ok) {
        throw new Error(`S3 PUT failed: ${response.status} ${response.statusText}`);
      }
    }, `S3 upload ${item.id}`);
  }

  /**
   * Performs a DynamoDB BatchWriteItem for attendance records.
   * Handles unprocessed items by retrying.
   */
  private async batchWriteAttendance(
    records: AttendanceRecord[],
  ): Promise<{ successIds: string[]; failedItems: Array<{ id: string; error: string }> }> {
    const successIds: string[] = [];
    const failedItems: Array<{ id: string; error: string }> = [];

    // Build DynamoDB BatchWriteItem request
    const putRequests = records.map((record) => ({
      PutRequest: {
        Item: this.toDynamoDBItem(record),
      },
    }));

    let unprocessedItems = putRequests;
    let attempt = 0;

    while (unprocessedItems.length > 0 && attempt < this.config!.maxRetries) {
      try {
        const requestBody = {
          RequestItems: {
            [this.config!.dynamoTableName]: unprocessedItems,
          },
        };

        const url = `https://dynamodb.${this.config!.region}.amazonaws.com/`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            ...this.getAuthHeaders('POST', url),
            'Content-Type': 'application/x-amz-json-1.0',
            'X-Amz-Target': 'DynamoDB_20120810.BatchWriteItem',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`DynamoDB BatchWrite failed: ${response.status} ${response.statusText}`);
        }

        const responseBody = await response.json();

        // Check for unprocessed items
        const unprocessed = responseBody?.UnprocessedItems?.[this.config!.dynamoTableName] || [];

        // Items that were processed successfully
        const processedCount = unprocessedItems.length - unprocessed.length;
        const processedRecords = records.slice(
          successIds.length,
          successIds.length + processedCount,
        );

        for (const record of processedRecords) {
          successIds.push(record.id);
        }

        unprocessedItems = unprocessed;

        if (unprocessedItems.length > 0) {
          // Exponential backoff for unprocessed items
          const delay = this.calculateBackoff(attempt);
          Logger.warn(TAG, `${unprocessedItems.length} unprocessed items, retrying in ${delay}ms`);
          await this.delay(delay);
        }

        attempt++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (attempt >= this.config!.maxRetries - 1) {
          // Mark remaining as failed
          for (const item of unprocessedItems) {
            const recordId = item.PutRequest?.Item?.id?.S || `unknown-${attempt}`;
            failedItems.push({ id: recordId, error: errorMessage });
          }
          break;
        }

        const delay = this.calculateBackoff(attempt);
        Logger.warn(
          TAG,
          `Batch write attempt ${attempt + 1} failed, retrying in ${delay}ms: ${errorMessage}`,
        );
        await this.delay(delay);
        attempt++;
      }
    }

    return { successIds, failedItems };
  }

  /**
   * Converts an attendance record to a DynamoDB item format.
   */
  private toDynamoDBItem(record: AttendanceRecord): Record<string, Record<string, string>> {
    const item: Record<string, Record<string, string>> = {
      id: { S: record.id },
      personnelId: { S: record.personnelId },
      timestamp: { S: record.timestamp },
      confidence: { N: record.confidence.toString() },
      livenessScore: { N: record.livenessScore.toString() },
      authResult: { S: record.authResult },
    };

    if (record.location) {
      item.location = { S: record.location };
    }
    if (record.siteId) {
      item.siteId = { S: record.siteId };
    }
    if (record.deviceId) {
      item.deviceId = { S: record.deviceId };
    }

    return item;
  }

  /**
   * Executes an async operation with exponential backoff retry.
   *
   * @param operation - The async operation to execute.
   * @param operationName - Name for logging purposes.
   */
  private async retryWithBackoff(
    operation: () => Promise<void>,
    operationName: string,
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config!.maxRetries; attempt++) {
      try {
        await operation();
        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.config!.maxRetries) {
          const delay = this.calculateBackoff(attempt);
          Logger.warn(
            TAG,
            `${operationName} attempt ${attempt + 1} failed, ` +
              `retrying in ${delay}ms: ${lastError.message}`,
          );
          await this.delay(delay);
        }
      }
    }

    throw lastError || new Error(`${operationName} failed after max retries`);
  }

  /**
   * Calculates exponential backoff delay with jitter.
   *
   * Delay = min(maxDelay, baseDelay * 2^attempt) + random jitter
   *
   * @param attempt - Current attempt number (0-indexed).
   * @returns Delay in milliseconds.
   */
  private calculateBackoff(attempt: number): number {
    const baseDelay = this.config!.baseRetryDelayMs;
    const maxDelay = this.config!.maxRetryDelayMs;

    // Exponential component
    const exponentialDelay = baseDelay * Math.pow(2, attempt);

    // Cap at maximum delay
    const cappedDelay = Math.min(exponentialDelay, maxDelay);

    // Add random jitter (0-25% of the delay) to prevent thundering herd
    const jitter = cappedDelay * Math.random() * 0.25;

    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Generates AWS v4 auth headers (simplified for demo).
   * In production, use aws-amplify or a proper AWS SDK for signing.
   */
  private getAuthHeaders(_method: string, _url: string): Record<string, string> {
    // NOTE: In production, implement AWS Signature Version 4 signing
    // or use AWS Amplify's auth module for proper request signing.
    // This placeholder shows the required header structure.
    const headers: Record<string, string> = {
      'X-Amz-Date': new Date()
        .toISOString()
        .replace(/[:-]/g, '')
        .replace(/\.\d{3}/, ''),
    };

    if (this.config?.sessionToken) {
      headers['X-Amz-Security-Token'] = this.config.sessionToken;
    }

    return headers;
  }

  /**
   * Validates the AWS configuration.
   */
  private validateConfig(config: AWSConfig): void {
    const required: Array<keyof AWSConfig> = [
      'region',
      's3BucketName',
      'dynamoTableName',
      'accessKeyId',
      'secretAccessKey',
    ];

    for (const key of required) {
      if (!config[key]) {
        throw new Error(`Missing required AWS config: ${key}`);
      }
    }

    if (config.maxRetries < 0) {
      throw new Error('maxRetries must be non-negative');
    }
  }

  /**
   * Ensures the uploader has been initialized.
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.config) {
      throw new Error('AWSUploader is not initialized. Call initialize() first.');
    }
  }

  /**
   * Splits an array into chunks of the specified size.
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Promise-based delay utility.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
