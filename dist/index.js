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
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const client_1 = require("./client");
const uploader_1 = require("./uploader");
const poller_1 = require("./poller");
const DEFAULT_CHUNK_SIZE = 10;
const DEFAULT_POLL_INTERVAL = 3;
const DEFAULT_POLL_TIMEOUT = 300;
const MAX_CHUNK_SIZE = 100;
const CONTENT_TYPE = 'application/zip';
async function getInputs() {
    const file = core.getInput('file', { required: true });
    const resourceId = core.getInput('resource_id', { required: true });
    const bearerToken = core.getInput('bearer_token', { required: true });
    let chunkSize = parseInt(core.getInput('chunk_size') || String(DEFAULT_CHUNK_SIZE), 10);
    if (chunkSize < 1) {
        chunkSize = DEFAULT_CHUNK_SIZE;
    }
    if (chunkSize > MAX_CHUNK_SIZE) {
        core.warning(`Chunk size ${chunkSize}MB exceeds maximum ${MAX_CHUNK_SIZE}MB, using ${MAX_CHUNK_SIZE}MB`);
        chunkSize = MAX_CHUNK_SIZE;
    }
    const pollInterval = parseInt(core.getInput('poll_interval') || String(DEFAULT_POLL_INTERVAL), 10);
    const pollTimeout = parseInt(core.getInput('poll_timeout') || String(DEFAULT_POLL_TIMEOUT), 10);
    return {
        file,
        resourceId,
        bearerToken,
        chunkSize,
        pollInterval: Math.max(1, pollInterval),
        pollTimeout: Math.max(1, pollTimeout),
    };
}
function setOutputs(deployId, status, workflowId, errorMessage) {
    core.setOutput('deploy_id', deployId);
    core.setOutput('deploy_status', status);
    if (workflowId) {
        core.setOutput('workflow_id', workflowId);
    }
    if (errorMessage) {
        core.setOutput('error_message', errorMessage);
    }
}
async function main() {
    core.info('===========================================');
    core.info('  Starting deployment process');
    core.info('===========================================');
    const inputs = await getInputs();
    core.info(`File: ${inputs.file}`);
    core.info(`Resource ID: ${inputs.resourceId}`);
    core.info(`Chunk size: ${inputs.chunkSize}MB`);
    core.info(`Poll interval: ${inputs.pollInterval}s`);
    core.info(`Poll timeout: ${inputs.pollTimeout}s`);
    const absolutePath = path.resolve(inputs.file);
    if (!fs.existsSync(absolutePath)) {
        core.setFailed(`File not found: ${inputs.file}`);
        return;
    }
    const fileStats = fs.statSync(absolutePath);
    const fileSize = fileStats.size;
    const filename = path.basename(absolutePath);
    core.info(`File: ${filename}`);
    core.info(`Size: ${fileSize} bytes`);
    if (!fileSize || fileSize === 0) {
        core.setFailed('File is empty');
        return;
    }
    const client = new client_1.ApiClient(inputs.bearerToken, inputs.resourceId);
    core.info('Step 1: Getting upload policy...');
    let policy;
    try {
        policy = await client.getUploadPolicy(CONTENT_TYPE, filename, fileSize);
        core.info(`Got upload policy. Attachment ID: ${policy._id}`);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        core.setFailed(`Failed to get upload policy: ${errorMessage}`);
        return;
    }
    core.info('Step 2: Uploading file with multipart...');
    const uploader = new uploader_1.Uploader(client, policy._id, inputs.chunkSize);
    let uploadedParts;
    try {
        uploadedParts = await uploader.uploadFile(absolutePath);
        core.info(`File uploaded. Total parts: ${uploadedParts.length}`);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        core.setFailed(`Failed to upload file: ${errorMessage}`);
        return;
    }
    core.info('Step 3: Confirming upload...');
    try {
        await client.confirmUpload({
            attachmentId: policy._id,
            parts: uploadedParts,
        });
        core.info('Upload confirmed');
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        core.setFailed(`Failed to confirm upload: ${errorMessage}`);
        return;
    }
    core.info('Step 4: Starting deployment...');
    let deployResponse;
    try {
        deployResponse = await client.deploy({ attachmentId: policy._id });
        core.info(`Deployment started. Deploy ID: ${deployResponse.deployId}`);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        core.setFailed(`Failed to start deployment: ${errorMessage}`);
        return;
    }
    core.info('Step 5: Polling deployment status...');
    const poller = new poller_1.Poller(client, inputs.pollInterval, inputs.pollTimeout);
    const result = await poller.poll(deployResponse.deployId);
    setOutputs(deployResponse.deployId, result.status, result.workflowId, result.errorMessage);
    core.info('===========================================');
    if (result.status === 'SUCCESS') {
        core.info('  Deployment completed successfully!');
    }
    else {
        core.info(`  Deployment failed: ${result.errorMessage || 'Unknown error'}`);
    }
    core.info('===========================================');
}
main().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(`Unhandled error: ${errorMessage}`);
});
//# sourceMappingURL=index.js.map