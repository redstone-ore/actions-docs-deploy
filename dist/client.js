"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiClient = void 0;
const axios_1 = __importDefault(require("axios"));
const BASE_URL = 'https://www.mczwlt.net/api/hub';
class ApiClient {
    client;
    resourceId;
    constructor(bearerToken, resourceId) {
        this.resourceId = resourceId;
        this.client = axios_1.default.create({
            baseURL: BASE_URL,
            headers: {
                Authorization: `Bearer ${bearerToken}`,
                'Content-Type': 'application/json',
            },
            timeout: 60000,
        });
    }
    async getUploadPolicy(contentType, filename, size) {
        const params = new URLSearchParams({
            contentType,
            filename,
            size: size.toString(),
        });
        const response = await this.client.get(`/resource/${this.resourceId}/deploy/upload-policy?${params.toString()}`);
        return response.data;
    }
    async initMultipartUpload(attachmentId) {
        const response = await this.client.patch(`/attachment/${attachmentId}/multipart-upload`);
        return response.data;
    }
    async getSignedUrl(attachmentId, partNumber) {
        const response = await this.client.get(`/attachment/${attachmentId}/sign-multipart-upload?partNumber=${partNumber}`);
        return response.data;
    }
    async confirmUpload(data) {
        await this.client.post('/attachment', data);
    }
    async deploy(data) {
        const response = await this.client.post(`/resource/${this.resourceId}/deploy`, data);
        return response.data;
    }
    async getDeployStatus(deployId) {
        const response = await this.client.get(`/resource/${this.resourceId}/deploy/${deployId}/status`);
        return response.data;
    }
    isRetryableError(error) {
        if (axios_1.default.isAxiosError(error)) {
            const axiosError = error;
            const status = axiosError.response?.status;
            return (status === undefined ||
                status === 408 ||
                status === 429 ||
                (status >= 500 && status < 600));
        }
        return false;
    }
}
exports.ApiClient = ApiClient;
//# sourceMappingURL=client.js.map