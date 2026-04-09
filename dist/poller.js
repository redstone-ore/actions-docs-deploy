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
exports.Poller = void 0;
const core = __importStar(require("@actions/core"));
const VALID_STATUSES = [
    'CREATED',
    'RUNNING',
    'SUCCESS',
    'FAILED',
];
class Poller {
    client;
    interval;
    timeout;
    constructor(client, interval, timeout) {
        this.client = client;
        this.interval = interval * 1000;
        this.timeout = timeout * 1000;
    }
    async poll(deployId) {
        const startTime = Date.now();
        let lastStatus = null;
        core.info(`Starting poll for deploy ${deployId}`);
        core.info(`Poll interval: ${this.interval / 1000}s, timeout: ${this.timeout / 1000}s`);
        while (true) {
            const elapsed = Date.now() - startTime;
            if (elapsed >= this.timeout) {
                core.error(`Polling timeout after ${elapsed / 1000}s`);
                return {
                    status: 'FAILED',
                    errorMessage: `Polling timeout after ${this.timeout / 1000} seconds`,
                    workflowId: lastStatus?.workflowId,
                };
            }
            try {
                lastStatus = await this.client.getDeployStatus(deployId);
                core.info(`Deploy status: ${lastStatus.status}`);
                if (lastStatus.workflowId) {
                    core.info(`Workflow ID: ${lastStatus.workflowId}`);
                }
                if (lastStatus.errorMessage) {
                    core.info(`Error message: ${lastStatus.errorMessage}`);
                }
                const status = lastStatus.status;
                if (status === 'SUCCESS') {
                    core.info('Deployment completed successfully');
                    return {
                        status: 'SUCCESS',
                        workflowId: lastStatus.workflowId,
                    };
                }
                if (status === 'FAILED') {
                    core.error(`Deployment failed: ${lastStatus.errorMessage || 'Unknown error'}`);
                    return {
                        status: 'FAILED',
                        errorMessage: lastStatus.errorMessage,
                        workflowId: lastStatus.workflowId,
                    };
                }
                if (status === 'CREATED' || status === 'RUNNING') {
                    core.info(`Deployment is ${status}, waiting...`);
                    await this.sleep(this.interval);
                    continue;
                }
                core.warning(`Unknown status: ${status}. Treating as error.`);
                return {
                    status: 'FAILED',
                    errorMessage: `Unknown deployment status: ${status}`,
                    workflowId: lastStatus.workflowId,
                };
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                core.warning(`Failed to get deploy status: ${errorMessage}. Retrying...`);
                if (this.client.isRetryableError(error)) {
                    await this.sleep(this.interval);
                    continue;
                }
                core.error(`Non-retryable error while polling status: ${errorMessage}`);
                return {
                    status: 'FAILED',
                    errorMessage: `Failed to get deploy status: ${errorMessage}`,
                    workflowId: lastStatus?.workflowId,
                };
            }
        }
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.Poller = Poller;
//# sourceMappingURL=poller.js.map