import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { ApiClient } from './client';
import { UploadedPart, UploadProgress } from './types';
import * as core from '@actions/core';

const MAX_CONCURRENCY = 3;
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000;

export class Uploader {
  private client: ApiClient;
  private attachmentId: string;
  private chunkSize: number;

  constructor(client: ApiClient, attachmentId: string, chunkSize: number) {
    this.client = client;
    this.attachmentId = attachmentId;
    this.chunkSize = chunkSize;
  }

  async uploadFile(filePath: string): Promise<UploadedPart[]> {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileBuffer = fs.readFileSync(absolutePath);
    const fileSize = fileBuffer.length;
    const chunkSizeBytes = this.chunkSize * 1024 * 1024;

    core.info(`File size: ${fileSize} bytes`);
    core.info(`Chunk size: ${chunkSizeBytes} bytes`);

    const totalParts = Math.ceil(fileSize / chunkSizeBytes);
    core.info(`Total parts: ${totalParts}`);

    core.info('Initializing multipart upload...');
    const initResult = await this.client.initMultipartUpload(this.attachmentId);
    core.info(`Multipart upload initialized. UploadId: ${initResult.uploadId}`);

    const parts: UploadedPart[] = [];
    let uploadedBytes = 0;

    for (let i = 0; i < totalParts; i += MAX_CONCURRENCY) {
      const batch: number[] = [];
      for (let j = i; j < Math.min(i + MAX_CONCURRENCY, totalParts); j++) {
        batch.push(j + 1);
      }

      core.info(`Uploading batch: parts ${batch.join(', ')}`);

      const batchResults = await Promise.all(
        batch.map((partNumber) =>
          this.uploadPartWithRetry(fileBuffer, partNumber, chunkSizeBytes, fileSize)
        )
      );

      for (const result of batchResults) {
        parts.push(result);
        uploadedBytes += this.getPartSize(
          result.partNumber,
          chunkSizeBytes,
          fileSize
        );
        this.logProgress(uploadedBytes, fileSize);
      }
    }

    parts.sort((a, b) => a.partNumber - b.partNumber);
    core.info('All parts uploaded successfully');

    return parts;
  }

  private async uploadPartWithRetry(
    fileBuffer: Buffer,
    partNumber: number,
    chunkSizeBytes: number,
    totalSize: number
  ): Promise<UploadedPart> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.uploadPart(fileBuffer, partNumber, chunkSizeBytes, totalSize);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_BASE * (attempt + 1);
          core.warning(
            `Part ${partNumber} upload failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${lastError.message}. Retrying in ${delay}ms...`
          );
          await this.sleep(delay);
        }
      }
    }

    throw new Error(
      `Part ${partNumber} upload failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`
    );
  }

  private async uploadPart(
    fileBuffer: Buffer,
    partNumber: number,
    chunkSizeBytes: number,
    totalSize: number
  ): Promise<UploadedPart> {
    const signResult = await this.client.getSignedUrl(
      this.attachmentId,
      partNumber
    );

    const start = (partNumber - 1) * chunkSizeBytes;
    const end = Math.min(partNumber * chunkSizeBytes, totalSize);
    const chunk = fileBuffer.slice(start, end);

    const response = await axios.put(signResult.url, chunk, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': chunk.length,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 300000,
    });

    const etag = this.extractEtag(response.headers.etag);
    core.debug(`Part ${partNumber} uploaded. ETag: ${etag}`);

    return {
      partNumber,
      etag,
    };
  }

  private extractEtag(etag: unknown): string {
    if (!etag) {
      throw new Error('ETag header is missing from response');
    }

    const etagStr = String(etag);

    if (etagStr.startsWith('"') && etagStr.endsWith('"')) {
      return etagStr;
    }

    return etagStr;
  }

  private getPartSize(
    partNumber: number,
    chunkSizeBytes: number,
    totalSize: number
  ): number {
    const start = (partNumber - 1) * chunkSizeBytes;
    return Math.min(chunkSizeBytes, totalSize - start);
  }

  private logProgress(uploaded: number, total: number): void {
    const percentage = ((uploaded / total) * 100).toFixed(1);
    core.info(`Upload progress: ${percentage}% (${uploaded}/${total} bytes)`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
