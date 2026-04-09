import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  UploadPolicyResponse,
  MultipartUploadInitResponse,
  SignMultipartUploadResponse,
  ConfirmUploadRequest,
  DeployRequest,
  DeployResponse,
  DeployStatusResponse,
} from './types';

const BASE_URL = 'https://www.mczwlt.net/api/hub';

export class ApiClient {
  private client: AxiosInstance;
  private resourceId: string;

  constructor(bearerToken: string, resourceId: string) {
    this.resourceId = resourceId;
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    });
  }

  async getUploadPolicy(
    contentType: string,
    filename: string,
    size: number
  ): Promise<UploadPolicyResponse> {
    const params = new URLSearchParams({
      contentType,
      filename,
      size: size.toString(),
    });

    const response = await this.client.get<UploadPolicyResponse>(
      `/resource/${this.resourceId}/deploy/upload-policy?${params.toString()}`
    );
    return response.data;
  }

  async initMultipartUpload(
    attachmentId: string
  ): Promise<MultipartUploadInitResponse> {
    const response = await this.client.patch<MultipartUploadInitResponse>(
      `/attachment/${attachmentId}/multipart-upload`
    );
    return response.data;
  }

  async getSignedUrl(
    attachmentId: string,
    partNumber: number
  ): Promise<SignMultipartUploadResponse> {
    const response = await this.client.get<SignMultipartUploadResponse>(
      `/attachment/${attachmentId}/sign-multipart-upload?partNumber=${partNumber}`
    );
    return response.data;
  }

  async confirmUpload(data: ConfirmUploadRequest): Promise<void> {
    await this.client.post('/attachment', data);
  }

  async deploy(data: DeployRequest): Promise<DeployResponse> {
    const response = await this.client.post<DeployResponse>(
      `/resource/${this.resourceId}/deploy`,
      data
    );
    return response.data;
  }

  async getDeployStatus(deployId: string): Promise<DeployStatusResponse> {
    const response = await this.client.get<DeployStatusResponse>(
      `/resource/${this.resourceId}/deploy/${deployId}/status`
    );
    return response.data;
  }

  isRetryableError(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      return (
        status === undefined ||
        status === 408 ||
        status === 429 ||
        (status >= 500 && status < 600)
      );
    }
    return false;
  }
}
