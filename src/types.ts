export interface UploadPolicyResponse {
  url: string;
  _id: string;
}

export interface MultipartUploadInitResponse {
  _id: string;
  uploadId: string;
  filename: string;
  key: string;
  user: string;
  bucket: string;
  reference: {
    name: string;
    id: unknown;
    role: string;
  };
  size: number;
}

export interface SignMultipartUploadResponse {
  _id: string;
  key: string;
  user: unknown;
  bucket: string;
  reference: {
    name: string;
    id: unknown;
    role: string;
  };
  size: number;
  createdAt: string;
  updatedAt: string;
  url: string;
}

export interface ConfirmUploadRequest {
  attachmentId: string;
  parts: PartInfo[];
}

export interface PartInfo {
  partNumber: number;
  etag: string;
}

export interface DeployRequest {
  attachmentId: string;
}

export interface DeployResponse {
  _id: string;
  [key: string]: unknown;
}

export interface DeployStatusResponse {
  deployId: string;
  status: DeployStatus;
  workflowId?: string;
  errorMessage?: string;
}

export type DeployStatus = 'CREATED' | 'RUNNING' | 'SUCCESS' | 'FAILED';

export interface ActionInputs {
  file: string;
  resourceId: string;
  bearerToken: string;
  chunkSize: number;
  pollInterval: number;
  pollTimeout: number;
}

export interface UploadedPart {
  partNumber: number;
  etag: string;
}

export interface UploadProgress {
  uploaded: number;
  total: number;
  percentage: number;
}
