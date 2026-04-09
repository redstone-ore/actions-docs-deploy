import { ApiClient } from './client';
import { UploadedPart } from './types';
export declare class Uploader {
    private client;
    private attachmentId;
    private chunkSize;
    constructor(client: ApiClient, attachmentId: string, chunkSize: number);
    uploadFile(filePath: string): Promise<UploadedPart[]>;
    private uploadPartWithRetry;
    private uploadPart;
    private extractEtag;
    private getPartSize;
    private logProgress;
    private sleep;
}
//# sourceMappingURL=uploader.d.ts.map