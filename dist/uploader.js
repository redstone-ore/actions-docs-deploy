"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Uploader = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const axios_1 = __importDefault(require("axios"));
const core = __importStar(require("@actions/core"));
const MAX_CONCURRENCY = 3;
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000;
class Uploader {
    client;
    attachmentId;
    chunkSize;
    constructor(client, attachmentId, chunkSize) {
        this.client = client;
        this.attachmentId = attachmentId;
        this.chunkSize = chunkSize;
    }
    async uploadFile(filePath) {
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
        const parts = [];
        let uploadedBytes = 0;
        for (let i = 0; i < totalParts; i += MAX_CONCURRENCY) {
            const batch = [];
            for (let j = i; j < Math.min(i + MAX_CONCURRENCY, totalParts); j++) {
                batch.push(j + 1);
            }
            core.info(`Uploading batch: parts ${batch.join(', ')}`);
            const batchResults = await Promise.all(batch.map((partNumber) => this.uploadPartWithRetry(fileBuffer, partNumber, chunkSizeBytes, fileSize)));
            for (const result of batchResults) {
                parts.push(result);
                uploadedBytes += this.getPartSize(result.partNumber, chunkSizeBytes, fileSize);
                this.logProgress(uploadedBytes, fileSize);
            }
        }
        parts.sort((a, b) => a.partNumber - b.partNumber);
        core.info('All parts uploaded successfully');
        return parts;
    }
    async uploadPartWithRetry(fileBuffer, partNumber, chunkSizeBytes, totalSize) {
        let lastError = null;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                return await this.uploadPart(fileBuffer, partNumber, chunkSizeBytes, totalSize);
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < MAX_RETRIES) {
                    const delay = RETRY_DELAY_BASE * (attempt + 1);
                    core.warning(`Part ${partNumber} upload failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${lastError.message}. Retrying in ${delay}ms...`);
                    await this.sleep(delay);
                }
            }
        }
        throw new Error(`Part ${partNumber} upload failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`);
    }
    async uploadPart(fileBuffer, partNumber, chunkSizeBytes, totalSize) {
        const signResult = await this.client.getSignedUrl(this.attachmentId, partNumber);
        const start = (partNumber - 1) * chunkSizeBytes;
        const end = Math.min(partNumber * chunkSizeBytes, totalSize);
        const chunk = fileBuffer.slice(start, end);
        const response = await axios_1.default.put(signResult.url, chunk, {
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
    extractEtag(etag) {
        if (!etag) {
            throw new Error('ETag header is missing from response');
        }
        const etagStr = String(etag);
        if (etagStr.startsWith('"') && etagStr.endsWith('"')) {
            return etagStr;
        }
        return etagStr;
    }
    getPartSize(partNumber, chunkSizeBytes, totalSize) {
        const start = (partNumber - 1) * chunkSizeBytes;
        return Math.min(chunkSizeBytes, totalSize - start);
    }
    logProgress(uploaded, total) {
        const percentage = ((uploaded / total) * 100).toFixed(1);
        core.info(`Upload progress: ${percentage}% (${uploaded}/${total} bytes)`);
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.Uploader = Uploader;
//# sourceMappingURL=uploader.js.map