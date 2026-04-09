import * as core from '@actions/core';
import { ApiClient } from './client';
import {
  DeployStatus,
  DeployStatusResponse,
} from './types';

const VALID_STATUSES: DeployStatus[] = [
  'CREATED',
  'RUNNING',
  'SUCCESS',
  'FAILED',
];

export interface PollResult {
  status: DeployStatus;
  workflowId?: string;
  errorMessage?: string;
}

export class Poller {
  private client: ApiClient;
  private interval: number;
  private timeout: number;

  constructor(client: ApiClient, interval: number, timeout: number) {
    this.client = client;
    this.interval = interval * 1000;
    this.timeout = timeout * 1000;
  }

  async poll(deployId: string): Promise<PollResult> {
    const startTime = Date.now();
    let lastStatus: DeployStatusResponse | null = null;

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
      } catch (error) {
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
