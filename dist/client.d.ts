import { UploadPolicyResponse, MultipartUploadInitResponse, SignMultipartUploadResponse, ConfirmUploadRequest, DeployRequest, DeployResponse, DeployStatusResponse } from './types';
export declare class ApiClient {
    private client;
    private resourceId;
    constructor(bearerToken: string, resourceId: string);
    getUploadPolicy(contentType: string, filename: string, size: number): Promise<UploadPolicyResponse>;
    initMultipartUpload(attachmentId: string): Promise<MultipartUploadInitResponse>;
    getSignedUrl(attachmentId: string, partNumber: number): Promise<SignMultipartUploadResponse>;
    confirmUpload(data: ConfirmUploadRequest): Promise<void>;
    deploy(data: DeployRequest): Promise<DeployResponse>;
    getDeployStatus(deployId: string): Promise<DeployStatusResponse>;
    isRetryableError(error: unknown): boolean;
}
//# sourceMappingURL=client.d.ts.map